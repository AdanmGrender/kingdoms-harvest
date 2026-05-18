const db = require('../config/database');
const { TOKEN_CONFIG, getDailyCap, getStreakMultiplier } = require('../../../shared/tokenConfig');
const playerService = require('./playerService');

const tokenService = {
  /**
   * Crear registro de tokens si no existe (llamado en initPlayer)
   */
  async ensureTokenRecord(playerId) {
    const existing = await db('player_tokens').where('player_id', playerId).first();
    if (!existing) {
      const now = new Date();
      const resetAt = new Date(now);
      resetAt.setUTCHours(24, 0, 0, 0); // midnight UTC next day
      await db('player_tokens').insert({
        player_id: playerId,
        balance: 0,
        total_earned: 0,
        total_withdrawn: 0,
        daily_earned_today: 0,
        daily_reset_at: resetAt.toISOString(),
      });
    }
  },

  /**
   * Obtener info completa de tokens del jugador
   */
  async getTokenInfo(playerId) {
    await this.ensureTokenRecord(playerId);
    await this.checkAndResetDaily(playerId);

    const tokenData = await db('player_tokens').where('player_id', playerId).first();
    const player = await db('players').where('telegram_id', playerId).first();
    if (!player) throw new Error('Jugador no encontrado');
    const streak = await db('player_streaks').where('player_id', playerId).first();

    const dailyCap = getDailyCap(player.level);
    const currentStreak = streak?.current_streak || 0;
    const multiplier = getStreakMultiplier(currentStreak);

    return {
      balance: tokenData.balance,
      totalEarned: tokenData.total_earned,
      totalWithdrawn: tokenData.total_withdrawn,
      dailyEarnedToday: tokenData.daily_earned_today,
      dailyCap,
      dailyRemaining: Math.max(0, dailyCap - tokenData.daily_earned_today),
      streakMultiplier: multiplier,
      currentStreak,
      walletAddress: tokenData.wallet_address || null,
      walletLinked: !!tokenData.wallet_address,
    };
  },

  /**
   * CORE: Otorgar tokens al jugador respetando daily cap + streak multiplier
   * Retorna { awarded, balance, dailyRemaining }
   */
  async awardTokens(playerId, baseAmount, source) {
    await this.ensureTokenRecord(playerId);
    await this.checkAndResetDaily(playerId);

    const tokenData = await db('player_tokens').where('player_id', playerId).first();
    const player = await db('players').where('telegram_id', playerId).first();
    if (!player) throw new Error('Jugador no encontrado');
    const streak = await db('player_streaks').where('player_id', playerId).first();

    const dailyCap = getDailyCap(player.level);
    const remaining = Math.max(0, dailyCap - tokenData.daily_earned_today);

    if (remaining <= 0) {
      return { awarded: 0, balance: tokenData.balance, dailyRemaining: 0, capped: true };
    }

    // Apply streak multiplier
    const multiplier = getStreakMultiplier(streak?.current_streak || 0);
    const boostedAmount = Math.floor(baseAmount * multiplier);

    // Clamp to daily remaining
    const awarded = Math.min(boostedAmount, remaining);

    // Update balance
    await db('player_tokens').where('player_id', playerId).update({
      balance: tokenData.balance + awarded,
      total_earned: tokenData.total_earned + awarded,
      daily_earned_today: tokenData.daily_earned_today + awarded,
    });

    // Pay referral commission (async, don't block)
    this.payReferralCommission(playerId, awarded).catch((err) => {
      console.error('[Token] Referral commission error:', err.message);
    });

    return {
      awarded,
      balance: tokenData.balance + awarded,
      dailyRemaining: remaining - awarded,
      capped: awarded < boostedAmount,
    };
  },

  /**
   * Pagar comision de referido (5% de los tokens ganados por el referee)
   */
  async payReferralCommission(refereeId, tokensEarned) {
    // Check if referee has a referrer
    const referral = await db('referrals').where('referee_id', refereeId).first();
    if (!referral || !referral.inviter_id) return;

    // Referee must be at least level 3 for commission to flow
    const referee = await db('players').where('telegram_id', refereeId).first();
    if (!referee || referee.level < TOKEN_CONFIG.REFERRAL_MIN_LEVEL_FOR_COMMISSION) return;

    const commission = Math.floor(tokensEarned * TOKEN_CONFIG.REFERRAL_COMMISSION_RATE);
    if (commission <= 0) return;

    // Award commission to inviter (bypasses daily cap — it's passive income)
    await this.ensureTokenRecord(referral.inviter_id);
    await db('player_tokens').where('player_id', referral.inviter_id).increment('balance', commission);
    await db('player_tokens').where('player_id', referral.inviter_id).increment('total_earned', commission);

    // Track commission total
    await db('referrals').where('id', referral.id).increment('total_commission', commission);
  },

  /**
   * Quemar recursos in-game por tokens (hybrid economy)
   */
  async burnResourcesForTokens(playerId, resourceId, quantity) {
    const burnRate = TOKEN_CONFIG.BURN_RATES[resourceId];
    if (!burnRate) throw new Error('Ese recurso no se puede quemar por tokens');
    if (quantity < burnRate.amount) {
      throw new Error(`Necesitas al menos ${burnRate.amount} ${resourceId} para quemar`);
    }

    // Calculate how many burn units
    const units = Math.floor(quantity / burnRate.amount);
    const actualBurned = units * burnRate.amount;
    const tokensToAward = units * burnRate.tokens;

    // Check burn daily limit
    await this.ensureTokenRecord(playerId);
    await this.checkAndResetDaily(playerId);
    const tokenData = await db('player_tokens').where('player_id', playerId).first();
    const player = await db('players').where('telegram_id', playerId).first();

    const dailyCap = getDailyCap(player.level);
    const remaining = Math.max(0, dailyCap - tokenData.daily_earned_today);
    const cappedTokens = Math.min(tokensToAward, remaining, TOKEN_CONFIG.BURN_DAILY_LIMIT);

    if (cappedTokens <= 0) {
      throw new Error('Ya alcanzaste el limite diario de tokens');
    }

    // Recalculate actual units to burn based on capped tokens
    const actualUnits = Math.ceil(cappedTokens / burnRate.tokens);
    const finalBurned = actualUnits * burnRate.amount;
    const finalTokens = actualUnits * burnRate.tokens;

    // Deduct resources
    try {
      await playerService.modifyResource(playerId, resourceId, -finalBurned);
    } catch {
      throw new Error(`No tenes suficiente ${resourceId}`);
    }

    // Award tokens
    await db('player_tokens').where('player_id', playerId).update({
      balance: tokenData.balance + finalTokens,
      total_earned: tokenData.total_earned + finalTokens,
      daily_earned_today: tokenData.daily_earned_today + finalTokens,
    });

    return {
      success: true,
      burned: { resourceId, amount: finalBurned },
      tokensAwarded: finalTokens,
      balance: tokenData.balance + finalTokens,
      message: `Quemaste ${finalBurned}x ${resourceId} y obtuviste ${finalTokens} KH Tokens!`,
    };
  },

  /**
   * Resetear daily si expiro
   */
  async checkAndResetDaily(playerId) {
    const tokenData = await db('player_tokens').where('player_id', playerId).first();
    if (!tokenData || !tokenData.daily_reset_at) return;

    const now = new Date();
    if (new Date(tokenData.daily_reset_at) <= now) {
      const resetAt = new Date(now);
      resetAt.setUTCHours(24, 0, 0, 0);
      await db('player_tokens').where('player_id', playerId).update({
        daily_earned_today: 0,
        daily_reset_at: resetAt.toISOString(),
      });
    }
  },

  /**
   * Vincular wallet TON
   */
  async linkWallet(playerId, walletAddress) {
    // Basic TON address validation (EQ or UQ prefix, ~48 chars)
    if (!walletAddress || !/^(EQ|UQ)[A-Za-z0-9_-]{46,48}$/.test(walletAddress)) {
      throw new Error('Direccion de wallet TON invalida');
    }

    await this.ensureTokenRecord(playerId);
    await db('player_tokens').where('player_id', playerId).update({
      wallet_address: walletAddress,
      wallet_linked_at: new Date().toISOString(),
    });

    return { success: true, message: 'Wallet vinculada correctamente!' };
  },

  /**
   * Solicitar retiro de tokens
   */
  async requestWithdrawal(playerId, amount) {
    if (!Number.isInteger(amount) || amount < TOKEN_CONFIG.WITHDRAWAL_MIN_TOKENS) {
      throw new Error(`El minimo para retirar es ${TOKEN_CONFIG.WITHDRAWAL_MIN_TOKENS} KH Tokens`);
    }

    const tokenData = await db('player_tokens').where('player_id', playerId).first();
    if (!tokenData) throw new Error('No tenes registro de tokens');
    if (!tokenData.wallet_address) throw new Error('Primero vincula tu wallet TON');
    if (tokenData.balance < amount) throw new Error('Balance insuficiente');

    // Check player level
    const player = await db('players').where('telegram_id', playerId).first();
    if (player.level < TOKEN_CONFIG.MIN_LEVEL_FOR_WITHDRAWAL) {
      throw new Error(`Necesitas nivel ${TOKEN_CONFIG.MIN_LEVEL_FOR_WITHDRAWAL} para retirar`);
    }

    // Check account age
    if (player.created_at) {
      const daysSinceCreation = (Date.now() - new Date(player.created_at).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceCreation < TOKEN_CONFIG.MIN_ACCOUNT_AGE_DAYS) {
        throw new Error(`Tu cuenta debe tener al menos ${TOKEN_CONFIG.MIN_ACCOUNT_AGE_DAYS} dias`);
      }
    }

    // Check cooldown
    const lastWithdrawal = await db('withdrawal_requests')
      .where({ player_id: playerId })
      .whereIn('status', ['pending', 'processing', 'completed'])
      .orderBy('id', 'desc')
      .first();

    if (lastWithdrawal && lastWithdrawal.created_at) {
      const hoursSince = (Date.now() - new Date(lastWithdrawal.created_at).getTime()) / (1000 * 60 * 60);
      if (hoursSince < TOKEN_CONFIG.WITHDRAWAL_COOLDOWN_HOURS) {
        const remaining = Math.ceil(TOKEN_CONFIG.WITHDRAWAL_COOLDOWN_HOURS - hoursSince);
        throw new Error(`Debes esperar ${remaining} horas para otro retiro`);
      }
    }

    // Calculate TON amount after fee
    const fee = Math.floor(amount * TOKEN_CONFIG.WITHDRAWAL_FEE_RATE);
    const netAmount = amount - fee;
    const tonAmount = (netAmount * TOKEN_CONFIG.TOKEN_TO_TON_RATE).toFixed(6);

    // Atomically deduct balance — safe against concurrent withdrawal requests.
    // decrementIfEnough only updates if balance >= amount (single SQL statement).
    const affected = await db('player_tokens')
      .where('player_id', playerId)
      .decrementIfEnough('balance', amount);
    if (!affected) throw new Error('Balance insuficiente');
    await db('player_tokens')
      .where('player_id', playerId)
      .increment('total_withdrawn', amount);

    // Create withdrawal request
    const [requestId] = await db('withdrawal_requests').insert({
      player_id: playerId,
      amount,
      ton_amount: tonAmount,
      wallet_address: tokenData.wallet_address,
      status: 'pending',
      created_at: new Date().toISOString(),
    });

    return {
      success: true,
      requestId,
      amount,
      fee,
      tonAmount,
      message: `Retiro solicitado: ${amount} KH Tokens (-${fee} fee) = ${tonAmount} TON`,
    };
  },

  /**
   * Historial de retiros
   */
  async getWithdrawalHistory(playerId) {
    return db('withdrawal_requests')
      .where('player_id', playerId)
      .orderBy('id', 'desc')
      .limit(20);
  },

  /**
   * Procesar retiros pendientes (llamado desde cron cada 5 min)
   */
  async processPendingWithdrawals() {
    const pending = await db('withdrawal_requests')
      .where('status', 'pending')
      .orderBy('id', 'asc')
      .limit(5);

    for (const request of pending) {
      try {
        // Atomic status claim — only proceeds if status is still 'pending'.
        // Returns 0 if another process already claimed it, preventing duplicate TON sends.
        const claimed = await db('withdrawal_requests')
          .where({ id: request.id, status: 'pending' })
          .update({ status: 'processing' });
        if (!claimed) continue;

        // Send TON via hot wallet
        const txHash = await this.sendTON(request.wallet_address, request.ton_amount);

        // Mark completed
        await db('withdrawal_requests').where('id', request.id).update({
          status: 'completed',
          tx_hash: txHash,
          processed_at: new Date().toISOString(),
        });

        console.log(`[TON] Withdrawal #${request.id} completed: ${txHash}`);
      } catch (err) {
        console.error(`[TON] Withdrawal #${request.id} failed:`, err.message);

        // Refund balance atomically — no read-modify-write
        await db('player_tokens')
          .where('player_id', request.player_id)
          .increment('balance', request.amount);
        await db('player_tokens')
          .where('player_id', request.player_id)
          .decrement('total_withdrawn', request.amount);

        await db('withdrawal_requests').where('id', request.id).update({
          status: 'failed',
          admin_note: err.message,
          processed_at: new Date().toISOString(),
        });
      }
    }
  },

  /**
   * Enviar TON desde hot wallet usando @ton/ton (SDK oficial)
   * Returns pseudo transaction hash (real on-chain hash requires polling TonCenter — ⚠️ Known)
   */
  async sendTON(toAddress, tonAmountStr) {
    const { TonClient, WalletContractV4, internal, toNano, SendMode } = require('@ton/ton');
    const { mnemonicToWalletKey } = require('@ton/crypto');
    const { loadSecret } = require('../config/secrets');

    const network = process.env.TON_NETWORK || 'testnet';
    const apiKey  = process.env.TON_API_KEY  || undefined;
    const endpoint = network === 'mainnet'
      ? 'https://toncenter.com/api/v2/jsonRPC'
      : 'https://testnet.toncenter.com/api/v2/jsonRPC';

    const client = new TonClient({ endpoint, apiKey });

    const mnemonic = loadSecret('TON_HOT_WALLET_MNEMONIC');
    if (!mnemonic) throw new Error('Hot wallet not configured');

    const key      = await mnemonicToWalletKey(mnemonic.split(' '));
    const wallet   = WalletContractV4.create({ publicKey: key.publicKey, workchain: 0 });
    const contract = client.open(wallet);

    const seqno = await contract.getSeqno();

    await contract.sendTransfer({
      secretKey: key.secretKey,
      seqno,
      messages: [
        internal({
          to:     toAddress,
          value:  toNano(tonAmountStr),
          bounce: false,
          body:   'KH Token Withdrawal',
        }),
      ],
      sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
    });

    // Real on-chain hash requires polling TonCenter API — ⚠️ Known limitation
    const hash = require('crypto')
      .createHash('sha256')
      .update(`${toAddress}:${tonAmountStr}:${Date.now()}`)
      .digest('hex')
      .slice(0, 16);

    return `ton_${hash}`;
  },

  /**
   * Leaderboard de tokens — uses a batch JOIN to avoid N+1 queries
   */
  async getTokenLeaderboard() {
    const tokens = await db('player_tokens')
      .orderBy('total_earned', 'desc')
      .limit(50);

    if (tokens.length === 0) return [];

    // Fetch all players in a single query instead of N individual lookups
    const playerIds = tokens.map((t) => t.player_id);
    const players = await db('players').whereIn('telegram_id', playerIds);
    const playerMap = {};
    for (const p of players) {
      playerMap[p.telegram_id] = p;
    }

    return tokens
      .filter((t) => playerMap[t.player_id])
      .map((t) => {
        const player = playerMap[t.player_id];
        return {
          displayName: player.display_name,
          level: player.level,
          totalEarned: t.total_earned,
          balance: t.balance,
        };
      });
  },
};

module.exports = tokenService;
