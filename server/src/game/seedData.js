const { FACTIONS } = require('../../../shared/gameConfig');

async function seedFactions(db) {
  for (const faction of Object.values(FACTIONS)) {
    const exists = await db('factions').where('id', faction.id).first();
    if (!exists) {
      await db('factions').insert({
        id: faction.id,
        name: faction.name,
        icon: faction.icon,
        color: faction.color,
        description: faction.description,
        bonus: JSON.stringify(faction.bonus),
        total_members: 0,
        territory_count: 0,
      });
    }
  }
  console.log('Facciones inicializadas');
}

// Initial world map: 9 territories on a 3×3 grid. Each has a fixed defense
// strength (used by combatService when generating NPC armies) and a
// resource bonus the owning faction gets via passive territory rewards.
// Names + types kept in sync with the medieval theme.
const SEED_TERRITORIES = [
  { name: 'Llanura Dorada',   grid_x: 0, grid_y: 0, type: 'plains',   defense_strength: 60,  resources_bonus: { wheat: 5 } },
  { name: 'Bosque Antiguo',   grid_x: 1, grid_y: 0, type: 'forest',   defense_strength: 80,  resources_bonus: { wood: 5 } },
  { name: 'Picos Helados',    grid_x: 2, grid_y: 0, type: 'mountain', defense_strength: 100, resources_bonus: { stone: 5 } },
  { name: 'Valle del Río',    grid_x: 0, grid_y: 1, type: 'plains',   defense_strength: 70,  resources_bonus: { water: 5 } },
  { name: 'Cruce de Caminos', grid_x: 1, grid_y: 1, type: 'plains',   defense_strength: 120, resources_bonus: { gold: 8 } },
  { name: 'Mina Profunda',    grid_x: 2, grid_y: 1, type: 'mountain', defense_strength: 110, resources_bonus: { iron: 5 } },
  { name: 'Pantano Maldito',  grid_x: 0, grid_y: 2, type: 'swamp',    defense_strength: 90,  resources_bonus: { gold: 5 } },
  { name: 'Costa Salada',     grid_x: 1, grid_y: 2, type: 'coast',    defense_strength: 75,  resources_bonus: { water: 8 } },
  { name: 'Ruinas Olvidadas', grid_x: 2, grid_y: 2, type: 'ruins',    defense_strength: 130, resources_bonus: { gold: 10 } },
];

async function seedTerritories(db) {
  for (const t of SEED_TERRITORIES) {
    const exists = await db('territories')
      .where({ grid_x: t.grid_x, grid_y: t.grid_y })
      .first();
    if (!exists) {
      await db('territories').insert({
        ...t,
        owner_faction_id: null,
        resources_bonus: JSON.stringify(t.resources_bonus),
      });
    }
  }
  console.log('Territorios inicializados');
}

module.exports = { seedFactions, seedTerritories };
