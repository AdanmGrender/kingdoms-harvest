// ========================================
// KINGDOMS HARVEST - Token Economy Config
// KH Token: farmeable through gameplay, withdrawable as TON
// ========================================

const TOKEN_CONFIG = {
  // -- Daily Cap --
  // Formula: BASE + (level * PER_LEVEL)
  // Level 1 = 60/day, Level 10 = 150/day, Level 50 = 550/day
  DAILY_CAP_BASE: 50,
  DAILY_CAP_PER_LEVEL: 10,

  // -- Passive Token Drip per Action --
  TOKENS_PER_HARVEST: 2,
  TOKENS_PER_MISSION_COMPLETE: 5,
  TOKENS_PER_PVE_WIN: 3,
  TOKENS_PER_PVP_WIN: 8,
  TOKENS_PER_SALE: 1,

  // -- Resource Burn -> Token Minting --
  BURN_RATES: {
    gold: { amount: 500, tokens: 5 },
    crystal: { amount: 1, tokens: 10 },
    relic: { amount: 1, tokens: 15 },
    blueprint: { amount: 1, tokens: 12 },
  },
  BURN_DAILY_LIMIT: 50,

  // -- Referral --
  REFERRAL_SIGNUP_BONUS_INVITER: 25,
  REFERRAL_SIGNUP_BONUS_REFEREE: 10,
  REFERRAL_COMMISSION_RATE: 0.05,            // 5% of referee's token earnings
  REFERRAL_MIN_LEVEL_FOR_COMMISSION: 3,      // referee must be lvl 3+ for commission
  REFERRAL_COMMISSION_CAP_PER_REFEREE: 500,  // lifetime KH cap earned from any single referee
  REFERRAL_DAILY_COMMISSION_CAP: 200,        // max KH/day from all referral commissions combined

  // -- Streak Multipliers --
  // Key = minimum streak day, Value = multiplier
  // Uses highest matching key <= current streak
  STREAK_MULTIPLIERS: {
    1: 1.0,
    3: 1.1,
    5: 1.2,
    7: 2.0,
    14: 2.5,
    21: 3.0,
    30: 5.0,
  },

  // -- Daily Tasks (regenerated each day) --
  DAILY_TASKS: [
    { id: 'harvest_5', desc: 'Cosecha 5 cultivos', icon: '🌾', action: 'harvest', target: 5, reward: 10 },
    { id: 'sell_3', desc: 'Vende 3 veces', icon: '🏪', action: 'sell', target: 3, reward: 8 },
    { id: 'battle_win_1', desc: 'Gana 1 batalla', icon: '⚔️', action: 'battle_win', target: 1, reward: 12 },
    { id: 'mission_1', desc: 'Completa 1 mision', icon: '📋', action: 'mission_complete', target: 1, reward: 10 },
    { id: 'login', desc: 'Inicia sesion', icon: '👋', action: 'login', target: 1, reward: 3 },
    { id: 'captcha_daily', desc: 'Resuelve el desafio del dia', icon: '🧩', action: 'captcha', target: 1, reward: 5 },
  ],

  // -- Social Tasks (one-time) --
  SOCIAL_TASKS: [
    { id: 'join_channel', desc: 'Unite al canal de Telegram', icon: '📢', reward: 50, channel: '@KingdomsHarvestOfficial' },
    { id: 'invite_1', desc: 'Invita 1 amigo', icon: '👤', reward: 25, requiredInvites: 1 },
    { id: 'invite_5', desc: 'Invita 5 amigos', icon: '👥', reward: 100, requiredInvites: 5 },
    { id: 'invite_10', desc: 'Invita 10 amigos', icon: '🎉', reward: 250, requiredInvites: 10 },
  ],

  // -- Withdrawal --
  WITHDRAWAL_MIN_TOKENS: 500,
  WITHDRAWAL_COOLDOWN_HOURS: 24,
  TOKEN_TO_TON_RATE: 0.0001, // 1 KH Token = 0.0001 TON
  WITHDRAWAL_FEE_RATE: 0.05, // 5% fee
  MIN_ACCOUNT_AGE_DAYS: 7,
  MIN_LEVEL_FOR_WITHDRAWAL: 5,
};

// Helper: get daily cap for a player level
function getDailyCap(level) {
  return TOKEN_CONFIG.DAILY_CAP_BASE + level * TOKEN_CONFIG.DAILY_CAP_PER_LEVEL;
}

// Helper: get streak multiplier for current streak
function getStreakMultiplier(streak) {
  const tiers = Object.keys(TOKEN_CONFIG.STREAK_MULTIPLIERS)
    .map(Number)
    .sort((a, b) => b - a);
  for (const tier of tiers) {
    if (streak >= tier) return TOKEN_CONFIG.STREAK_MULTIPLIERS[tier];
  }
  return 1.0;
}

module.exports = { TOKEN_CONFIG, getDailyCap, getStreakMultiplier };
