const db = require('../config/database');
const { CODEX } = require('../../../shared/gameConfig');

// Caché por jugador (TTL 30s): el códice se lee en cada snapshot de combate y
// la cantidad de héroes únicos cambia rara vez (solo al invocar un héroe nuevo).
const _cache = new Map(); // playerId -> { mult, ts }
const TTL_MS = 30_000;

/**
 * codexService — F6 Códice de colección. Bono pasivo de ATK de escuadra por
 * héroes ÚNICOS poseídos (hero_id distinto en player_heroes). NO acuña dinero:
 * solo escala el ATK del snapshot de combate server-side.
 */
const codexService = {
  // COUNT(DISTINCT hero_id) en JS: el roster por jugador es acotado, así que
  // traer las filas y contar con un Set evita SQL crudo.
  async getUniqueCount(playerId) {
    const rows = await db('player_heroes').where('player_id', playerId);
    return new Set((Array.isArray(rows) ? rows : []).map((r) => r.hero_id)).size;
  },

  _stepsFor(unique) {
    return Math.min(CODEX.maxSteps, Math.floor(unique / CODEX.heroesPerStep));
  },

  // Multiplicador de ATK: 1 + pasos × atkPerStep, cap a maxSteps pasos.
  async getAtkMult(playerId) {
    const cached = _cache.get(playerId);
    if (cached && Date.now() - cached.ts < TTL_MS) return cached.mult;
    const unique = await this.getUniqueCount(playerId);
    const mult = 1 + this._stepsFor(unique) * CODEX.atkPerStep;
    _cache.set(playerId, { mult, ts: Date.now() });
    return mult;
  },

  // Estado para el panel de UI (conteo + bono actual/máximo, en %).
  async getState(playerId) {
    const unique = await this.getUniqueCount(playerId);
    const steps = this._stepsFor(unique);
    return {
      unique,
      heroesPerStep: CODEX.heroesPerStep,
      bonusPct: Math.round(steps * CODEX.atkPerStep * 100),
      maxPct: Math.round(CODEX.maxSteps * CODEX.atkPerStep * 100),
      nextAt: steps < CODEX.maxSteps ? (steps + 1) * CODEX.heroesPerStep : null,
    };
  },
};

module.exports = codexService;
