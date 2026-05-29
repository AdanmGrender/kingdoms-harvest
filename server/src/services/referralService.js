const db = require('../config/database');
const { TOKEN_CONFIG } = require('../../../shared/tokenConfig');
const tokenService = require('./tokenService');

const referralService = {
  /**
   * Procesar referido cuando un nuevo jugador se registra con codigo
   */
  async processReferral(inviterId, refereeId) {
    if (String(inviterId) === String(refereeId)) {
      throw new Error('No podes referirte a vos mismo');
    }

    // Verify inviter exists
    const inviter = await db('players').where('telegram_id', inviterId).first();
    if (!inviter) throw new Error('Invitador no encontrado');

    // Check referee not already referred
    const existing = await db('referrals').where('referee_id', refereeId).first();
    if (existing) return; // Silently ignore if already referred

    // Create referral
    await db('referrals').insert({
      inviter_id: inviterId,
      referee_id: refereeId,
      bonus_paid: 0,
      total_commission: 0,
      created_at: new Date().toISOString(),
    });

    // Award signup bonuses
    await tokenService.ensureTokenRecord(inviterId);
    await tokenService.ensureTokenRecord(refereeId);

    // Inviter bonus — atomic increment avoids read-modify-write race
    await db('player_tokens').where('player_id', inviterId).increment({
      balance:      TOKEN_CONFIG.REFERRAL_SIGNUP_BONUS_INVITER,
      total_earned: TOKEN_CONFIG.REFERRAL_SIGNUP_BONUS_INVITER,
    });

    // Referee bonus — atomic increment
    await db('player_tokens').where('player_id', refereeId).increment({
      balance:      TOKEN_CONFIG.REFERRAL_SIGNUP_BONUS_REFEREE,
      total_earned: TOKEN_CONFIG.REFERRAL_SIGNUP_BONUS_REFEREE,
    });

    // Mark bonus paid
    await db('referrals').where({ inviter_id: inviterId, referee_id: refereeId })
      .update({ bonus_paid: 1 });

    return {
      success: true,
      inviterBonus: TOKEN_CONFIG.REFERRAL_SIGNUP_BONUS_INVITER,
      refereeBonus: TOKEN_CONFIG.REFERRAL_SIGNUP_BONUS_REFEREE,
    };
  },

  /**
   * Estadisticas de referidos de un jugador
   */
  async getReferralStats(playerId) {
    const referrals = await db('referrals').where('inviter_id', playerId);

    const totalCommission = referrals.reduce((acc, r) => acc + (r.total_commission || 0), 0);

    // Get referee names
    const refereeList = [];
    for (const ref of referrals) {
      const referee = await db('players').where('telegram_id', ref.referee_id).first();
      if (referee) {
        refereeList.push({
          name: referee.display_name,
          level: referee.level,
          commission: ref.total_commission || 0,
          joinedAt: ref.created_at,
        });
      }
    }

    return {
      totalReferrals: referrals.length,
      totalCommission,
      referees: refereeList,
    };
  },

  /**
   * Contar referidos (para verificacion de tareas sociales)
   */
  async getReferralCount(playerId) {
    const result = await db('referrals')
      .where('inviter_id', playerId)
      .count('* as count');
    return result[0]?.count || 0;
  },

  /**
   * Generar link de referido
   */
  generateReferralLink(playerId) {
    const botUsername = process.env.BOT_USERNAME || 'kingdomharvestbot';
    return `https://t.me/${botUsername}?start=ref_${playerId}`;
  },
};

module.exports = referralService;
