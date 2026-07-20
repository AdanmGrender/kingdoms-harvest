const db = require('../config/database');
const { SEASON_PASS } = require('../../../shared/gameConfig');

// Lazy requires (evitan ciclos con token/player/gem services, mismo patrón
// que calendarService/campaignService).
let _token, _player, _gem;
const tokenService = () => (_token ||= require('./tokenService'));
const playerService = () => (_player ||= require('./playerService'));
const gemService = () => (_gem ||= require('./gemService'));

/**
 * passService — F4 Pase de temporada (battle pass). Temporada de 30 días, 20
 * tiers × 50 pts. Riel FREE (siempre accesible) + riel PREMIUM (desbloqueado
 * gastando gemas). Ver shared/gameConfig.js → SEASON_PASS y CLAUDE.md §7.2b.
 */
const passService = {
  // Devuelve la season activa (ends_at > now); si no hay ninguna, crea una
  // nueva ('s1', o 's{N+1}' si ya hubo temporadas previas). Self-heal: se
  // llama desde getState/claimTier/unlockPremium (cualquier interacción del
  // jugador con el pase la siembra si hace falta).
  async _ensureSeason() {
    const now = new Date().toISOString();
    let active = await db('pass_seasons').where('ends_at', '>', now).orderBy('id', 'desc').first();
    if (active) return active;

    const countRows = await db('pass_seasons').count('* as count');
    const seasonKey = `s${(countRows[0]?.count || 0) + 1}`;
    const startedAt = new Date();
    const endsAt = new Date(startedAt.getTime() + SEASON_PASS.days * 24 * 60 * 60 * 1000);
    try {
      await db('pass_seasons').insert({
        season_key: seasonKey, started_at: startedAt.toISOString(), ends_at: endsAt.toISOString(),
      });
    } catch { /* carrera: otra llamada ya la creó (UNIQUE season_key) — seguimos */ }

    active = await db('pass_seasons').where('ends_at', '>', now).orderBy('id', 'desc').first();
    return active || db('pass_seasons').orderBy('id', 'desc').first();
  },

  // Siembra/realinea la fila UNIQUE(player_id) del jugador con la season
  // activa. Si el jugador venía de una season vieja (season_key distinto),
  // arranca de cero (points=0, premium=0) — el premium se paga por temporada,
  // el histórico de claims queda en pass_claims (scoped por season_key, no se
  // borra).
  async _ensurePlayerPass(playerId, seasonKey) {
    let row = await db('player_pass').where('player_id', playerId).first();
    if (!row) {
      try {
        await db('player_pass').insert({ player_id: playerId, season_key: seasonKey, points: 0, premium: 0 });
      } catch { /* carrera: fila ya existe (UNIQUE player_id) — seguimos */ }
      row = await db('player_pass').where('player_id', playerId).first();
    } else if (row.season_key !== seasonKey) {
      await db('player_pass').where('player_id', playerId).update({ season_key: seasonKey, points: 0, premium: 0 });
      row = await db('player_pass').where('player_id', playerId).first();
    }
    return row;
  },

  async getState(playerId) {
    const season = await this._ensureSeason();
    const row = await this._ensurePlayerPass(playerId, season.season_key);
    const tier = Math.min(SEASON_PASS.tiers, Math.floor(row.points / SEASON_PASS.ptsPerTier));

    const claimRows = await db('pass_claims').where({ player_id: playerId, season_key: season.season_key });
    const claims = (Array.isArray(claimRows) ? claimRows : []).map((c) => ({ tier: c.tier, track: c.track }));

    return {
      seasonKey: season.season_key,
      endsAt: season.ends_at,
      points: row.points,
      tier,
      premium: !!row.premium,
      claims,
      rewards: SEASON_PASS.rewards,
    };
  },

  // Puntos por acción del catálogo (SEASON_PASS.points). Llamado desde hooks
  // no críticos (try/catch en el call site) — si la season está vencida (o
  // todavía no existe ninguna), no-op silencioso: nadie pierde progreso
  // porque un hook incidental disparó antes de que el pase se haya sembrado.
  // Idempotencia no aplica (es acumulativo, no un claim).
  async addPoints(playerId, action) {
    const points = SEASON_PASS.points[action];
    if (!points) return;

    const season = await this._ensureSeason();
    if (new Date(season.ends_at).getTime() <= Date.now()) return; // defensivo

    await this._ensurePlayerPass(playerId, season.season_key);
    await db('player_pass')
      .where({ player_id: playerId, season_key: season.season_key })
      .increment('points', points);
  },

  // Desbloquea el riel premium de la temporada activa gastando
  // `premiumCostGems` gemas. Idempotente: si el jugador YA tiene premium en
  // esta season, rechaza SIN cobrar (chequeo antes del gasto). Todo en una
  // transacción: si el gate final falla tras el gasto (carrera), el rollback
  // devuelve las gemas también.
  async unlockPremium(playerId) {
    return db.transaction(async () => {
      const season = await this._ensureSeason();
      const row = await this._ensurePlayerPass(playerId, season.season_key);
      if (row.premium) throw new Error('Ya tenés el pase premium esta temporada');

      await gemService().spend(playerId, SEASON_PASS.premiumCostGems, 'season_pass_premium');

      const claimed = await db('player_pass')
        .where({ player_id: playerId, season_key: season.season_key, premium: 0 })
        .update({ premium: 1 });
      if (!claimed) throw new Error('Ya tenés el pase premium esta temporada');

      return { premium: true, seasonKey: season.season_key };
    });
  },

  // Reclama la recompensa de un tier en un track ('free' | 'premium').
  // Requiere: tier alcanzado (points >= tier*ptsPerTier); track premium
  // exige premium=1 en la season activa. El INSERT en pass_claims (UNIQUE
  // player+season+tier+track) es el gate de idempotencia real — el chequeo
  // previo es fast-fail. Todo en una transacción: si el award falla tras el
  // claim, el rollback revierte el INSERT (retry recuperable).
  async claimTier(playerId, tier, track) {
    if (track !== 'free' && track !== 'premium') throw new Error('Track inválido');
    if (!Number.isInteger(tier) || tier < 1 || tier > SEASON_PASS.tiers) throw new Error('Tier inválido');

    return db.transaction(async () => {
      const season = await this._ensureSeason();
      const row = await this._ensurePlayerPass(playerId, season.season_key);

      if (row.points < tier * SEASON_PASS.ptsPerTier) throw new Error('Todavía no alcanzaste ese tier');
      if (track === 'premium' && !row.premium) throw new Error('Necesitás el pase premium para reclamar ese track');

      try {
        await db('pass_claims').insert({ player_id: playerId, season_key: season.season_key, tier, track });
      } catch (err) {
        if (/UNIQUE constraint/i.test(err.message)) throw new Error('Ya reclamaste esa recompensa');
        throw err;
      }

      const reward = SEASON_PASS.rewards[tier - 1]?.[track] || {};
      await this._grantReward(playerId, reward);

      return { tier, track, reward };
    });
  },

  // Reparte el premio del tier/track. KH SOLO vía awardTokens (cap diario
  // aplica), gemas SOLO vía grantPromo (ledger propio gem_promo_grants), el
  // resto son recursos vía modifyResource. Catálogo server-side siempre
  // (SEASON_PASS.rewards), nunca del request.
  async _grantReward(playerId, reward) {
    for (const [key, amount] of Object.entries(reward)) {
      if (key === 'kh') {
        await tokenService().awardTokens(playerId, amount, 'wave_defense');
      } else if (key === 'gems') {
        await gemService().grantPromo(playerId, amount, 'season_pass_tier');
      } else {
        await playerService().modifyResource(playerId, key, amount);
      }
    }
  },
};

module.exports = passService;
