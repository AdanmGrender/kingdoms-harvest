exports.up = async function (db) {
  await db.raw('ALTER TABLE "territories" ADD COLUMN IF NOT EXISTS "conquered_at" TEXT DEFAULT NULL');
  await db.raw('ALTER TABLE "territories" ADD COLUMN IF NOT EXISTS "conqueror_player_id" BIGINT DEFAULT NULL');

  const existing = await db('territories').first();
  if (existing) return;

  await db('territories').insert([
    // Plains — moderate defense, wheat + gold bonus
    { name: 'Llanura del Rey',    grid_x: 30,  grid_y: 30,  type: 'plains',   defense_strength: 60,  resources_bonus: JSON.stringify({ wheat: 5, gold: 2 }) },
    { name: 'Valle Dorado',       grid_x: 80,  grid_y: 25,  type: 'plains',   defense_strength: 80,  resources_bonus: JSON.stringify({ wheat: 5, gold: 2 }) },
    { name: 'Praderas del Sur',   grid_x: 50,  grid_y: 90,  type: 'plains',   defense_strength: 100, resources_bonus: JSON.stringify({ wheat: 5, gold: 2 }) },
    { name: 'Campos Libres',      grid_x: 110, grid_y: 60,  type: 'plains',   defense_strength: 120, resources_bonus: JSON.stringify({ wheat: 5, gold: 2 }) },
    { name: 'Tierras Altas',      grid_x: 20,  grid_y: 70,  type: 'plains',   defense_strength: 150, resources_bonus: JSON.stringify({ wheat: 5, gold: 2 }) },
    // Forest — wood production
    { name: 'Bosque Oscuro',      grid_x: 45,  grid_y: 50,  type: 'forest',   defense_strength: 70,  resources_bonus: JSON.stringify({ wood: 8 }) },
    { name: 'Arboleda Sagrada',   grid_x: 90,  grid_y: 80,  type: 'forest',   defense_strength: 110, resources_bonus: JSON.stringify({ wood: 8 }) },
    { name: 'El Gran Bosque',     grid_x: 130, grid_y: 40,  type: 'forest',   defense_strength: 140, resources_bonus: JSON.stringify({ wood: 8 }) },
    { name: 'Floresta del Norte', grid_x: 60,  grid_y: 15,  type: 'forest',   defense_strength: 180, resources_bonus: JSON.stringify({ wood: 8 }) },
    // Mountain — stone + iron
    { name: 'Pico Nevado',        grid_x: 15,  grid_y: 20,  type: 'mountain', defense_strength: 90,  resources_bonus: JSON.stringify({ stone: 6, iron: 4 }) },
    { name: 'Minas del Hierro',   grid_x: 100, grid_y: 50,  type: 'mountain', defense_strength: 160, resources_bonus: JSON.stringify({ stone: 6, iron: 4 }) },
    { name: 'Ciudadela Rocosa',   grid_x: 135, grid_y: 100, type: 'mountain', defense_strength: 220, resources_bonus: JSON.stringify({ stone: 6, iron: 4 }) },
    // Coastal — gold + bread
    { name: 'Puerto Norte',       grid_x: 70,  grid_y: 5,   type: 'coastal',  defense_strength: 130, resources_bonus: JSON.stringify({ gold: 10, bread: 3 }) },
    { name: 'Bahía del Tesoro',   grid_x: 145, grid_y: 75,  type: 'coastal',  defense_strength: 200, resources_bonus: JSON.stringify({ gold: 10, bread: 3 }) },
    // Ruins — rare crystal + gold
    { name: 'Templo Olvidado',    grid_x: 35,  grid_y: 110, type: 'ruins',    defense_strength: 250, resources_bonus: JSON.stringify({ crystal: 1, gold: 5 }) },
    { name: 'Ciudad Perdida',     grid_x: 120, grid_y: 15,  type: 'ruins',    defense_strength: 300, resources_bonus: JSON.stringify({ crystal: 1, gold: 5 }) },
  ]);
};

exports.down = async function (db) {
  await db.raw('ALTER TABLE "territories" DROP COLUMN IF EXISTS "conquered_at"');
  await db.raw('ALTER TABLE "territories" DROP COLUMN IF EXISTS "conqueror_player_id"');
  await db('territories').delete();
};
