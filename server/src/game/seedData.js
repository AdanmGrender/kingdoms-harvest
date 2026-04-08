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

module.exports = { seedFactions };
