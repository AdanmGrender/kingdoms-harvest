const db = require('../config/database');
const { TECH_BRANCHES } = require('../../../shared/gameConfig');
const buildingService = require('./buildingService');

// F5 idle: tiempo real por tier — base 30 min × nivel de la tech (nivel 1 =
// 30 min … nivel 5 = 2.5 h). La biblioteca y los Susurros del Vacío lo acortan.
const RESEARCH_BASE_MS = 30 * 60 * 1000;

const techService = {
  async getResearch(playerId) {
    const rows = await db('player_research').where('player_id', playerId);
    const now = new Date();

    // Auto-complete finished research
    const justCompleted = [];
    for (const row of rows) {
      if (row.is_researching && row.research_complete_at && new Date(row.research_complete_at) <= now) {
        await db('player_research').where('id', row.id).update({
          is_researching: false,
          completed_at: row.research_complete_at,
          research_complete_at: null,
        });
        row.is_researching = false;
        row.completed_at = row.research_complete_at;
        row.research_complete_at = null;
        justCompleted.push(row);
      }
    }
    if (justCompleted.length > 0) {
      const achievementService = require('./achievementService');
      achievementService.checkAndUnlock(playerId, 'research', justCompleted.length).catch(() => {});
    }

    // Build enriched response
    const completedSet = new Set(rows.filter((r) => r.completed_at).map((r) => r.tech_id));
    const inProgress = rows.find((r) => r.is_researching);

    const branches = Object.values(TECH_BRANCHES).map((branch) => ({
      id: branch.id,
      name: branch.name,
      icon: branch.icon,
      techs: Object.values(branch.techs).map((tech) => ({
        id: tech.id || Object.keys(branch.techs).find((k) => branch.techs[k] === tech),
        name: tech.name,
        effect: tech.effect,
        cost: tech.cost,
        level: tech.level,
        completed: completedSet.has(Object.keys(branch.techs).find((k) => branch.techs[k] === tech) ||
          tech.id),
        inProgress: inProgress?.tech_id === (Object.keys(branch.techs).find((k) => branch.techs[k] === tech)),
        completeAt: inProgress?.research_complete_at,
      })),
    }));

    return { branches, inProgress: inProgress || null };
  },

  async startResearch(playerId, branchId, techId) {
    const branch = TECH_BRANCHES[branchId];
    if (!branch) throw new Error('Rama de investigación no válida');

    const tech = branch.techs[techId];
    if (!tech) throw new Error('Tecnología no válida');

    // Verify Library exists
    const library = await db('player_buildings')
      .where({ player_id: playerId, building_id: 'library', is_building: false })
      .first();
    if (!library) throw new Error('Necesitás construir la Biblioteca para investigar');

    // Check not already researching
    const inProgress = await db('player_research')
      .where({ player_id: playerId, is_researching: true })
      .first();
    if (inProgress) throw new Error('Ya estás investigando algo. Esperá que termine.');

    // Check not already completed
    const existing = await db('player_research')
      .where({ player_id: playerId, tech_id: techId })
      .first();
    if (existing?.completed_at) throw new Error('Ya investigaste esta tecnología');

    // Check level requirement (library level must be >= tech.level)
    if (library.level < tech.level) {
      throw new Error(`Necesitás Biblioteca nivel ${tech.level} para esta tecnología`);
    }

    // Pay costs
    await buildingService.payResources(playerId, tech.cost);

    const now = new Date();
    const levelBonus = library.level * 0.1; // 10% faster per library level
    // Susurros del Vacío (tormenta disforme F2): la investigación se acelera
    const stormSpeed = await require('./stormService').getModifier('research_speed');
    const researchTime = Math.floor((RESEARCH_BASE_MS * tech.level) / (1 + levelBonus + stormSpeed));
    const completeAt = new Date(now.getTime() + researchTime);

    if (existing) {
      await db('player_research').where('id', existing.id).update({
        is_researching: true,
        research_complete_at: completeAt.toISOString(),
      });
    } else {
      await db('player_research').insert({
        player_id: playerId,
        branch_id: branchId,
        tech_id: techId,
        is_researching: true,
        research_complete_at: completeAt.toISOString(),
      });
    }

    return {
      success: true,
      techId,
      techName: tech.name,
      researchTime,
      completeAt: completeAt.toISOString(),
      message: `Investigando ${tech.name}... Listo en ${Math.round(researchTime / 60000)} min.`,
    };
  },

  /**
   * Returns a flat Set of completed tech IDs for a player (used by other services)
   */
  async getCompletedTechs(playerId) {
    const rows = await db('player_research')
      .where({ player_id: playerId })
      .whereNotNull('completed_at');
    return new Set(rows.map((r) => r.tech_id));
  },
};

module.exports = techService;
