const db = require('../config/database');
const { TOKEN_CONFIG, getDailyCap, getStreakMultiplier } = require('../../../shared/tokenConfig');
const playerService = require('./playerService');
const cache = require('../config/cache');
// Lazy-loaded to avoid circular dependencies — eventService, prestigeService,
// and notificationService all touch tokens during their flows.
let _prestigeService = null;
function getPrestigeService() {
  if (!_prestigeService) _prestigeService = require('./prestigeService');
  return _prestigeService;
}
let _notificationService = null;
function getNotifService() {
  if (!_notificationService) _notificationService = require('./notificationService');
  return _notificationService;
}

// Single-flight del procesador de retiros (ver processPendingWithdrawals): evita
// que dos corridas del cron se solapen compartiendo el seqno del hot wallet.
let _wdRunning = false;

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

    const prestigeMultipliers = await getPrestigeService().getMultipliers(playerId);
    const dailyCap = Math.floor(getDailyCap(player.level) * (prestigeMultipliers.daily_token_cap ?? 1));
    const remaining = Math.max(0, dailyCap - tokenData.daily_earned_today);

    if (remaining <= 0) {
      return { awarded: 0, balance: tokenData.balance, dailyRemaining: 0, capped: true };
    }

    // Apply streak multiplier + active seasonal event kh_bonus (golden_caravan
    // adds +10%). Stacked multiplicatively: streak × (1 + event). Player at
    // daily cap still gets nothing extra — cap exists for a reason.
    const multiplier = getStreakMultiplier(streak?.current_streak || 0);
    let eventBonus = 0;
    try {
      const eventService = require('./eventService');
      eventBonus = await eventService.getMultiplier('kh_bonus');
      // Lluvia de Energía (tormenta disforme F2): +KH mientras dura
      eventBonus += await require('./stormService').getModifier('kh_bonus');
    } catch {}
    const boostedAmount = Math.floor(baseAmount * multiplier * (1 + eventBonus));

    // Mint con clamp del cap DENTRO del UPDATE atómico. Antes el monto se
    // recortaba contra un `remaining` leído arriba, con varios `await` de por
    // medio: dos awardTokens concurrentes podían leer el mismo
    // daily_earned_today y ambos otorgar hasta `remaining`, superando el cap
    // (TOCTOU). Ahora el recorte se evalúa contra el valor VIVO de la fila.
    // SQLite evalúa el RHS de todos los SET con el valor PREVIO de la fila, así
    // que los tres MIN() otorgan el mismo monto. MIN/MAX escalares (SQLite).
    const clamp = 'MIN(?, MAX(0, ? - daily_earned_today))';
    await db('player_tokens').where('player_id', playerId).update({
      balance:            db.raw(`balance + ${clamp}`, [boostedAmount, dailyCap]),
      total_earned:       db.raw(`total_earned + ${clamp}`, [boostedAmount, dailyCap]),
      daily_earned_today: db.raw(`daily_earned_today + ${clamp}`, [boostedAmount, dailyCap]),
    });

    // Releer para el monto realmente otorgado (exacto salvo carrera; el cap ya
    // quedó garantizado por el UPDATE atómico de arriba).
    const after = await db('player_tokens').where('player_id', playerId).first();
    const awarded = Math.max(0, after.daily_earned_today - tokenData.daily_earned_today);

    // Pay referral commission (async, don't block)
    this.payReferralCommission(playerId, awarded).catch((err) => {
      console.error('[Token] Referral commission error:', err.message);
    });

    // Invalidate leaderboard cache — player's total_earned changed
    cache.del('leaderboard').catch(() => {});

    return {
      awarded,
      balance: after.balance,
      dailyRemaining: Math.max(0, dailyCap - after.daily_earned_today),
      capped: awarded < boostedAmount,
    };
  },

  /**
   * Pagar comision de referido (5% de los tokens ganados por el referee)
   * Sujeto a dos caps:
   *   1. Per-referee lifetime cap (REFERRAL_COMMISSION_CAP_PER_REFEREE)
   *   2. Daily cap across all referrals (REFERRAL_DAILY_COMMISSION_CAP)
   */
  async payReferralCommission(refereeId, tokensEarned) {
    const referral = await db('referrals').where('referee_id', refereeId).first();
    if (!referral || !referral.inviter_id) return;

    const referee = await db('players').where('telegram_id', refereeId).first();
    if (!referee || referee.level < TOKEN_CONFIG.REFERRAL_MIN_LEVEL_FOR_COMMISSION) return;

    // Cap 1: per-referee lifetime limit
    const lifetimeRemaining = TOKEN_CONFIG.REFERRAL_COMMISSION_CAP_PER_REFEREE - (referral.total_commission || 0);
    if (lifetimeRemaining <= 0) return;

    let commission = Math.floor(tokensEarned * TOKEN_CONFIG.REFERRAL_COMMISSION_RATE);
    commission = Math.min(commission, lifetimeRemaining);
    if (commission <= 0) return;

    // Cap 2: inviter's daily commission limit (reset at UTC midnight)
    await this.ensureTokenRecord(referral.inviter_id);
    const inviterTokens = await db('player_tokens').where('player_id', referral.inviter_id).first();

    const now = new Date();
    let commissionToday = inviterTokens.commission_today || 0;
    const resetAt = inviterTokens.commission_reset_at ? new Date(inviterTokens.commission_reset_at) : null;

    if (!resetAt || resetAt <= now) {
      commissionToday = 0;
      const nextReset = new Date(now);
      nextReset.setUTCHours(24, 0, 0, 0);
      await db('player_tokens').where('player_id', referral.inviter_id).update({
        commission_today: 0,
        commission_reset_at: nextReset.toISOString(),
      });
    }

    const dailyRemaining = TOKEN_CONFIG.REFERRAL_DAILY_COMMISSION_CAP - commissionToday;
    if (dailyRemaining <= 0) return;

    commission = Math.min(commission, dailyRemaining);
    if (commission <= 0) return;

    await db('player_tokens').where('player_id', referral.inviter_id).update({
      balance:          db.raw('balance + ?', [commission]),
      total_earned:     db.raw('total_earned + ?', [commission]),
      commission_today: db.raw('commission_today + ?', [commission]),
    });

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
    if (!player) throw new Error('Jugador no encontrado');

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

    // Atomic update — avoids read-modify-write race
    await db('player_tokens').where('player_id', playerId).update({
      balance:            db.raw('balance + ?', [finalTokens]),
      total_earned:       db.raw('total_earned + ?', [finalTokens]),
      daily_earned_today: db.raw('daily_earned_today + ?', [finalTokens]),
    });

    return {
      success: true,
      burned: { resourceId, amount: finalBurned },
      tokensAwarded: finalTokens,
      balance: tokenData.balance + finalTokens, // approximate; client should refresh
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
    // Format validation: EQ/UQ prefix + base64url body (route-level regex is primary guard)
    if (!walletAddress || !/^(EQ|UQ)[A-Za-z0-9_-]{46,48}$/.test(walletAddress)) {
      throw new Error('Dirección de wallet TON inválida');
    }
    // Validar checksum real + restringir a basechain (workchain 0): los payouts
    // van a wallets normales; una address de masterchain (-1) sería un error.
    // (L4: la titularidad real NO se prueba acá — requeriría TON Connect
    // ton_proof; si el jugador vincula una address que no controla, solo se
    // perjudica a sí mismo. Documentado como mejora futura.)
    const { Address } = require('@ton/ton');
    let parsed;
    try { parsed = Address.parse(walletAddress); }
    catch { throw new Error('Dirección de wallet TON inválida'); }
    if (parsed.workChain !== 0) {
      throw new Error('La dirección debe ser de la basechain (workchain 0)');
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
    if (!player) throw new Error('Jugador no encontrado');
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

    // Descuento de balance + registro del retiro en UNA transacción (L1): si el
    // proceso muere entre el descuento y el insert, la transacción revierte y el
    // jugador NO queda con el balance descontado sin request. decrementIfEnough
    // sigue siendo atómico (un solo statement con guard balance>=amount).
    const requestId = await db.transaction(async (trx) => {
      const affected = await trx('player_tokens')
        .where('player_id', playerId)
        .decrementIfEnough('balance', amount);
      if (!affected) throw new Error('Balance insuficiente');
      await trx('player_tokens')
        .where('player_id', playerId)
        .increment('total_withdrawn', amount);

      const [{ id }] = await trx('withdrawal_requests').insert({
        player_id: playerId,
        amount,
        ton_amount: tonAmount,
        wallet_address: tokenData.wallet_address,
        status: 'pending',
        created_at: new Date().toISOString(),
      }).returning('id');
      return id;
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
    // Kill-switch operativo (parseo laxo: false/0/no/off pausan; default on).
    const sw = String(process.env.WITHDRAWALS_ENABLED ?? '').toLowerCase();
    if (['false', '0', 'no', 'off'].includes(sw)) return;
    // Single-flight a nivel proceso: node-cron NO impide reentradas y una corrida
    // dura hasta ~5min (poll de confirmación). Dos corridas solapadas leerían el
    // MISMO seqno del hot wallet → una podría marcar 'completed' un retiro cuyo
    // TON no salió, y ambas duplicarían el baseline del tope diario. Serializar.
    if (_wdRunning) { console.warn('[TON] payout ya en curso; se saltea esta corrida'); return; }
    _wdRunning = true;
    try {
      await this._processWithdrawalsInner();
    } finally {
      _wdRunning = false;
    }
  },

  async _processWithdrawalsInner() {
    const nowIso = () => new Date().toISOString();

    // 0) 'processing' colgados (crash entre broadcast y confirmación): NUNCA se
    //    reenvían (el TON pudo salir) → a needs_review para revisión humana.
    const staleCutoff = Date.now() - TOKEN_CONFIG.WITHDRAWAL_PROCESSING_STALE_MIN * 60 * 1000;
    const processing = await db('withdrawal_requests').where('status', 'processing');
    for (const r of (Array.isArray(processing) ? processing : [])) {
      const claimedMs = r.claimed_at ? new Date(r.claimed_at).getTime() : 0;
      if (!claimedMs || claimedMs >= staleCutoff) continue;
      const moved = await db('withdrawal_requests')
        .where({ id: r.id, status: 'processing' })
        .update({ status: 'needs_review', processed_at: nowIso(),
          admin_note: `processing colgado; revisar cadena por seqno=${r.seqno ?? '?'}` });
      if (moved) getNotifService().notify(r.player_id, 'withdrawals',
        '⏳ Tu retiro quedó en revisión manual. Te avisamos apenas se confirme.');
    }

    // 1) Tope diario de payout on-chain (acota el daño ante exploit/robo del
    //    hot wallet). Suma el TON de completados en las últimas 24h.
    const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    // Contar completados Y needs_review: un 'needs_review' pudo haber ENVIADO
    // el TON (envío incierto), así que se cuenta de forma conservadora contra el
    // tope diario para que el kill-switch económico no se deflacte.
    const doneToday = await db('withdrawal_requests')
      .whereIn('status', ['completed', 'needs_review'])
      .where('processed_at', '>', dayAgo);
    let tonToday = (Array.isArray(doneToday) ? doneToday : [])
      .reduce((s, r) => s + (parseFloat(r.ton_amount) || 0), 0);

    const pending = await db('withdrawal_requests')
      .where('status', 'pending')
      .orderBy('id', 'asc')
      .limit(5);

    for (const request of pending) {
      const reqTon = parseFloat(request.ton_amount) || 0;

      // Diferir (NO fallar) si excede el tope diario — se reintenta después.
      if (tonToday + reqTon > TOKEN_CONFIG.MAX_DAILY_TON_PAYOUT) {
        console.warn(`[TON] Tope diario alcanzado (${tonToday}/${TOKEN_CONFIG.MAX_DAILY_TON_PAYOUT} TON); difiriendo retiro #${request.id}`);
        continue;
      }

      // Claim atómico pending→processing (evita doble envío entre cron/workers).
      const claimed = await db('withdrawal_requests')
        .where({ id: request.id, status: 'pending' })
        .update({ status: 'processing', claimed_at: nowIso() });
      if (!claimed) continue;
      await db('withdrawal_requests').where('id', request.id).increment('attempts', 1);

      try {
        // Persistir el seqno usado ANTES del broadcast (reconciliación si el
        // proceso muere entre el envío y la confirmación).
        const persistSeqno = (seqno) =>
          db('withdrawal_requests').where('id', request.id).update({ seqno });

        const txHash = await this.sendTON(request.wallet_address, request.ton_amount, persistSeqno);

        await db('withdrawal_requests').where('id', request.id).update({
          status: 'completed', tx_hash: txHash, processed_at: nowIso(),
        });
        tonToday += reqTon;

        const network = process.env.TON_NETWORK || 'testnet';
        const explorerBase = network === 'mainnet'
          ? 'https://tonscan.org/tx' : 'https://testnet.tonscan.org/tx';
        getNotifService().notify(request.player_id, 'withdrawals',
          `💰 ¡Retiro completado! ${request.amount} KH → ${request.ton_amount} TON enviados.\n🔗 ${explorerBase}/${txHash}`);
        console.log(`[TON] Withdrawal #${request.id} completed: ${txHash}`);

      } catch (err) {
        if (err && err.presend) {
          // Falló ANTES de broadcastear (el TON NO se movió): seguro reintegrar.
          await db('player_tokens').where('player_id', request.player_id).increment('balance', request.amount);
          await db('player_tokens').where('player_id', request.player_id).decrement('total_withdrawn', request.amount);
          await db('withdrawal_requests').where('id', request.id).update({
            status: 'failed', admin_note: err.message, processed_at: nowIso(),
          });
          // Mensaje genérico al jugador (no filtrar err.message interno del
          // preflight/RPC); el detalle queda en admin_note + logs server-side.
          getNotifService().notify(request.player_id, 'withdrawals',
            `⚠️ Tu retiro de ${request.amount} KH no se pudo procesar. El balance fue reintegrado; probá de nuevo más tarde.`);
          console.error(`[TON] Withdrawal #${request.id} pre-send fail (reintegrado):`, err.message);
        } else {
          // INCIERTO: el envío pudo salir. NO completar, NO reintegrar (evita
          // doble pago) → needs_review; lo resuelve un humano con el seqno.
          await db('withdrawal_requests').where('id', request.id).update({
            status: 'needs_review', admin_note: err.message, processed_at: nowIso(),
          });
          getNotifService().notify(request.player_id, 'withdrawals',
            '⏳ Tu retiro quedó en revisión manual. Te avisamos apenas se confirme.');
          console.error(`[TON] Withdrawal #${request.id} INCIERTO (needs_review, sin reintegro):`, err.message);
        }
      }
    }
  },

  /**
   * Enviar TON desde hot wallet usando @ton/ton (SDK oficial).
   * Retorna el hash real de la transacción on-chain obtenido por polling.
   */
  async sendTON(toAddress, tonAmountStr, onSeqno) {
    const { TonClient, WalletContractV4, internal, toNano, Address, SendMode } = require('@ton/ton');
    const { mnemonicToWalletKey } = require('@ton/crypto');
    const { loadSecret } = require('../config/secrets');

    // presend(err): marca que el fallo ocurrió ANTES de broadcastear → el TON no
    // se movió y el caller puede reintegrar el balance con seguridad. Todo lo
    // que ocurre después del sendTransfer NO lleva este flag (incierto).
    const presend = (msg) => { const e = new Error(msg); e.presend = true; return e; };

    // ── PREFLIGHT (seguro de fallar: no se movió dinero) ──
    let parsedAddress;
    try { parsedAddress = Address.parse(toAddress); }
    catch { throw presend('Dirección TON inválida'); }

    const tonAmount = parseFloat(tonAmountStr);
    if (isNaN(tonAmount) || tonAmount < 0.01) {
      throw presend('Monto TON demasiado pequeño (mínimo 0.01 TON)');
    }

    const network  = process.env.TON_NETWORK || 'testnet';
    const apiKey   = process.env.TON_API_KEY  || undefined;
    const endpoint = network === 'mainnet'
      ? 'https://toncenter.com/api/v2/jsonRPC'
      : 'https://testnet.toncenter.com/api/v2/jsonRPC';

    const mnemonic = loadSecret('TON_HOT_WALLET_MNEMONIC');
    if (!mnemonic) throw presend('Hot wallet no configurado');

    let contract, key, wallet, seqnoBefore;
    try {
      const client = new TonClient({ endpoint, apiKey });
      key      = await mnemonicToWalletKey(mnemonic.trim().split(/\s+/));
      wallet   = WalletContractV4.create({ publicKey: key.publicKey, workchain: 0 });
      contract = client.open(wallet);

      // Balance del hot wallet ≥ monto + colchón de gas. Si no alcanza, NO
      // arriesgamos el envío (y es seguro reintegrar: aún no se envió nada).
      const balance = await contract.getBalance();
      const needed  = toNano(tonAmountStr) + toNano(String(TOKEN_CONFIG.WITHDRAWAL_GAS_BUFFER_TON));
      if (balance < needed) throw presend('Saldo del hot wallet insuficiente para el envío');

      seqnoBefore = await contract.getSeqno();
    } catch (e) {
      // Cualquier fallo de red/lectura en el preflight es pre-envío → seguro.
      throw e.presend ? e : presend(`preflight: ${e.message}`);
    }

    // Persistir el seqno ANTES de broadcastear (reconciliación post-crash).
    if (onSeqno) { try { await onSeqno(seqnoBefore); } catch { /* best-effort */ } }

    // ── PUNTO DE NO RETORNO: a partir de acá el TON puede estar en vuelo. Un
    //    fallo aquí NO lleva el flag presend → el caller va a needs_review. ──
    await contract.sendTransfer({
      secretKey: key.secretKey,
      seqno:     seqnoBefore,
      messages: [
        internal({
          to:     parsedAddress,
          value:  toNano(tonAmountStr),
          bounce: false,
          body:   'KH Token Withdrawal',
        }),
      ],
      sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
    });

    // Confirmación por incremento de seqno (máx 60s). SIN pseudo-hash: si no
    // confirma, _waitForTx lanza y el retiro va a needs_review (jamás se marca
    // completado con un hash inventado).
    return this._waitForTx(contract, wallet.address, seqnoBefore, parsedAddress, 60_000);
  },

  /**
   * Poll until seqno increments then fetch the real tx hash from TonCenter.
   * Returns a tonscan-compatible hash string.
   */
  async _waitForTx(contract, walletAddress, seqnoBefore, toAddress, timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    const POLL_INTERVAL_MS = 3000;

    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      try {
        const seqnoNow = await contract.getSeqno();
        if (seqnoNow > seqnoBefore) {
          // El seqno avanzó → el tx se incluyó. Traemos varias tx recientes y
          // elegimos la que ENVÍA a nuestra dirección destino (L3): evita
          // registrar el hash de otro egreso del hot wallet (top-up de gas,
          // envío manual). Si no se puede emparejar, cae al más reciente.
          const txs = await contract.getTransactions({ limit: 5 });
          if (!txs || txs.length === 0) {
            throw new Error('tx confirmada (seqno avanzó) pero no se pudo leer el hash');
          }
          const match = this._pickTxToDest(txs, toAddress);
          if (!match) console.warn('[TON] no se pudo emparejar el tx por destino; usando el más reciente');
          // hash() → Buffer; base64url es el formato de los exploradores TON.
          return Buffer.from((match || txs[0]).hash()).toString('base64url');
        }
      } catch (e) {
        if (/no se pudo leer el hash/.test(e.message)) throw e;
        // Error de red transitorio en el polling → seguir intentando.
      }
    }
    // Sin confirmación dentro del tiempo límite: el envío pudo salir igual.
    throw new Error('confirmación on-chain no obtenida dentro del tiempo límite');
  },

  /** Elige el tx cuyo mensaje saliente interno va a `toAddress` (L3). Tolerante
   *  al shape del SDK: cualquier error → null (el caller cae al más reciente). */
  _pickTxToDest(txs, toAddress) {
    if (!toAddress) return null;
    for (const tx of txs) {
      try {
        const outs = tx.outMessages;
        const msgs = outs && typeof outs.values === 'function' ? outs.values() : [];
        for (const m of msgs) {
          const dest = m && m.info && m.info.dest;
          if (dest && typeof dest.equals === 'function' && dest.equals(toAddress)) return tx;
        }
      } catch { /* shape inesperado → siguiente tx */ }
    }
    return null;
  },

  /**
   * Leaderboard de tokens — uses a batch JOIN to avoid N+1 queries
   */
  async getTokenLeaderboard() {
    const cached = await cache.get('leaderboard');
    if (cached) return cached;

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

    const result = tokens
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

    await cache.set('leaderboard', result, 60);
    return result;
  },
};

module.exports = tokenService;
