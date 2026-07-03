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
    } else {
      // Refrescar campos de display (re-theme grimdark 2026-07-03) sin tocar
      // estado de juego (miembros, territorios)
      await db('factions').where('id', faction.id).update({
        name: faction.name,
        icon: faction.icon,
        color: faction.color,
        description: faction.description,
      });
    }
  }
  console.log('Facciones inicializadas');
}

// World map: 25 territories on a 5×5 grid. The original 9 inner tiles
// (0..2)×(0..2) keep their exact coords so any existing territory_id
// references survive intact; the seed adds 16 new outer-ring tiles.
// Names re-themed grimdark 2026-07-03 — coords are the stable key.
//
// Each has a fixed defense strength (used by combatService when generating
// NPC armies) and a resource bonus the owning faction gets via passive
// tribute every hour.
const SEED_TERRITORIES = [
  // ─── Original 3×3 inner core (coords unchanged from previous seed) ───
  { name: 'Páramo Dorado',        grid_x: 0, grid_y: 0, type: 'plains',   defense_strength: 60,  resources_bonus: { wheat: 5 } },
  { name: 'Bosque Calcinado',     grid_x: 1, grid_y: 0, type: 'forest',   defense_strength: 80,  resources_bonus: { wood: 5 } },
  { name: 'Picos del Aullido',    grid_x: 2, grid_y: 0, type: 'mountain', defense_strength: 100, resources_bonus: { stone: 5 } },
  { name: 'Cañón del Río Gris',   grid_x: 0, grid_y: 1, type: 'plains',   defense_strength: 70,  resources_bonus: { water: 5 } },
  { name: 'Cruce de Convoyes',    grid_x: 1, grid_y: 1, type: 'plains',   defense_strength: 120, resources_bonus: { gold: 8 } },
  { name: 'Pozo Minero IX',       grid_x: 2, grid_y: 1, type: 'mountain', defense_strength: 110, resources_bonus: { iron: 5 } },
  { name: 'Pantano Maldito',      grid_x: 0, grid_y: 2, type: 'swamp',    defense_strength: 90,  resources_bonus: { gold: 5 } },
  { name: 'Costa de Ceniza',      grid_x: 1, grid_y: 2, type: 'coast',    defense_strength: 75,  resources_bonus: { water: 8 } },
  { name: 'Ruinas Olvidadas',     grid_x: 2, grid_y: 2, type: 'ruins',    defense_strength: 130, resources_bonus: { gold: 10 } },

  // ─── New outer ring (16 territories) ───
  // Eastern column (x=3)
  { name: 'Selva Mutante',        grid_x: 3, grid_y: 0, type: 'forest',   defense_strength: 90,  resources_bonus: { wood: 6 } },
  { name: 'Zoco del Óxido',       grid_x: 3, grid_y: 1, type: 'plains',   defense_strength: 100, resources_bonus: { gold: 7 } },
  { name: 'Bahía Saqueadora',     grid_x: 3, grid_y: 2, type: 'coast',    defense_strength: 95,  resources_bonus: { gold: 6 } },
  { name: 'Dunas Irradiadas',     grid_x: 3, grid_y: 3, type: 'sand',     defense_strength: 65,  resources_bonus: { iron: 3 } },
  { name: 'Puesto Fronterizo',    grid_x: 3, grid_y: 4, type: 'sand',     defense_strength: 85,  resources_bonus: { gold: 6 } },

  // Far east column (x=4)
  { name: 'Acantilados Negros',   grid_x: 4, grid_y: 0, type: 'mountain', defense_strength: 95,  resources_bonus: { iron: 5 } },
  { name: 'Cordillera Negra',     grid_x: 4, grid_y: 1, type: 'mountain', defense_strength: 115, resources_bonus: { stone: 6 } },
  { name: 'Campos de Fermento',   grid_x: 4, grid_y: 2, type: 'plains',   defense_strength: 80,  resources_bonus: { wheat: 7 } },
  { name: 'Oasis Sagrado',        grid_x: 4, grid_y: 3, type: 'sand',     defense_strength: 100, resources_bonus: { water: 9, gold: 4 } },
  { name: 'Confín del Mundo',     grid_x: 4, grid_y: 4, type: 'ruins',    defense_strength: 145, resources_bonus: { gold: 12 } },

  // Southern row (y=3, x=0..2)
  { name: 'Tundra Polar',         grid_x: 0, grid_y: 3, type: 'snow',     defense_strength: 70,  resources_bonus: { stone: 4 } },
  { name: 'Glaciares Rotos',      grid_x: 1, grid_y: 3, type: 'snow',     defense_strength: 85,  resources_bonus: { water: 6 } },
  { name: 'Cumbre Eterna',        grid_x: 2, grid_y: 3, type: 'mountain', defense_strength: 105, resources_bonus: { iron: 4 } },

  // Far south row (y=4, x=0..2)
  { name: 'Refugio del Norte',    grid_x: 0, grid_y: 4, type: 'snow',     defense_strength: 80,  resources_bonus: { wood: 4 } },
  { name: 'Templo Caído',         grid_x: 1, grid_y: 4, type: 'ruins',    defense_strength: 140, resources_bonus: { gold: 11 } },
  { name: 'Capital en Ruinas',    grid_x: 2, grid_y: 4, type: 'plains',   defense_strength: 150, resources_bonus: { gold: 12, wheat: 4 } },
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
    } else if (exists.name !== t.name) {
      // Refrescar solo el nombre (re-theme) — nunca tocar owner ni estado
      await db('territories')
        .where({ grid_x: t.grid_x, grid_y: t.grid_y })
        .update({ name: t.name });
    }
  }
  console.log('Territorios inicializados');
}

module.exports = { seedFactions, seedTerritories };
