const db = require('../config/database');
const { LOGIN_CALENDAR } = require('../../../shared/gameConfig');

// Lazy requires (evitan ciclos con token/player/gem services)
let _token, _player, _gem;
const tokenService = () => (_token ||= require('./tokenService'));
const playerService = () => (_player ||= require('./playerService'));
const gemService = () => (_gem ||= require('./gemService'));

const todayUTC = () => new Date().toISOString().slice(0, 10);

/**
 * calendarService — F2 Calendario de login 7 días. Ciclo reclamable UNA vez
 * por día UTC (si se saltea un día no se rompe: el ciclo simplemente avanza
 * al reclamar). Coexiste con las rachas (streaks) — no las toca.
 */
const calendarService = {
  // Siembra la fila si falta (try/catch por si otra llamada concurrente ya
  // la creó, mismo patrón que campaignService._claimSweep).
  async _ensureSeeded(playerId) {
    const existing = await db('login_calendar').where('player_id', playerId).first();
    if (existing) return existing;
    try {
      await db('login_calendar').insert({ player_id: playerId, cycle_day: 1, last_claim_date: '' });
    } catch { /* fila ya existe (UNIQUE player_id) — seguimos */ }
    return db('login_calendar').where('player_id', playerId).first();
  },

  async getState(playerId) {
    const row = await this._ensureSeeded(playerId);
    return {
      cycleDay: row.cycle_day,
      claimedToday: row.last_claim_date === todayUTC(),
      rewards: LOGIN_CALENDAR,
    };
  },

  // Claim atómico + recompensa, todo en UNA transacción (patrón `_clearNode`):
  // el UPDATE condicional (`last_claim_date != hoy`) es el gate — su `.count`
  // decide si hubo claim, nunca una lectura previa por separado. El día
  // premiado es el `cycle_day` LEÍDO ANTES del update (el jugador reclama el
  // día en el que estaba parado, no el siguiente). Si el award falla después
  // del claim, el rollback revierte el UPDATE también — retry recuperable.
  async claim(playerId) {
    return db.transaction(async () => {
      const row = await this._ensureSeeded(playerId);
      const day = row.cycle_day;
      const today = todayUTC();

      const claimed = await db('login_calendar')
        .where({ player_id: playerId })
        .where('last_claim_date', '!=', today)
        .update({
          cycle_day: db.raw('(cycle_day % 7) + 1'),
          last_claim_date: today,
        });
      if (!claimed) throw new Error('Ya reclamaste hoy');

      const reward = LOGIN_CALENDAR[day - 1];
      await this._grantReward(playerId, reward);

      return { day, reward, nextDay: (day % 7) + 1 };
    });
  },

  // Reparte el premio del día. KH SOLO vía awardTokens (cap diario aplica),
  // gemas SOLO vía grantPromo (ledger propio), el resto son recursos vía
  // modifyResource. Server-side siempre: el catálogo sale de LOGIN_CALENDAR,
  // nunca del request.
  async _grantReward(playerId, reward) {
    for (const [key, amount] of Object.entries(reward)) {
      if (key === 'day') continue;
      if (key === 'kh') {
        await tokenService().awardTokens(playerId, amount, 'wave_defense');
      } else if (key === 'gems') {
        await gemService().grantPromo(playerId, amount, 'login_calendar_d7');
      } else {
        await playerService().modifyResource(playerId, key, amount);
      }
    }
  },
};

module.exports = calendarService;
