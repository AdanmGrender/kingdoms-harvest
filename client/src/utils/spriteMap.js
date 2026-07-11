/**
 * Sprite Map Configuration
 * Maps game element IDs to their sprite sheet positions.
 *
 * Sheets used:
 * - Buttons_00005_ (clean 4x4 grid, 256px cells) — UI buttons & buildings
 * - Items_00004_ (clean 4x4 grid, 256px cells) — resources & items
 * - Character_00003_ (5x3 grid, ~205x341px cells) — NPC/troop characters
 *
 * NOT used: UI_00007_ (has decorative border frame, unreliable positions)
 */

import {
  GRIM_SHEET,
  GRIM_SHEET_W,
  GRIM_SHEET_H,
  GRIM_CELL,
  GRIM_ICONS,
} from '../config/grimIconSheet.generated';

const SPRITE_BASE = '/assets/sprites';

const SHEETS = {
  buttons: `${SPRITE_BASE}/Buttons_00005_.png`,
  characters: `${SPRITE_BASE}/Character_00003_.png`,
  items: `${SPRITE_BASE}/Items_00004_.png`,
};

// Position helpers for clean grids
const pos4 = (col, row) => ({
  x: col * 256, y: row * 256, w: 256, h: 256,
  sheetW: 1024, sheetH: 1024,
});

const posChar = (col, row) => ({
  x: col * 205, y: row * 341, w: 205, h: 341,
  sheetW: 1024, sheetH: 1024,
});

/**
 * Master sprite map — only sprites with reliable positions.
 */
const SPRITE_MAP = {
  // ──── BUTTONS SHEET (4x4, 256px) ────
  // Row 0: close(X), back arrow, castle+flag, castle tower
  close:        { sheet: SHEETS.buttons, ...pos4(0, 0) },
  back:         { sheet: SHEETS.buttons, ...pos4(1, 0) },
  castle_flag:  { sheet: SHEETS.buttons, ...pos4(2, 0) },
  castle_tower: { sheet: SHEETS.buttons, ...pos4(3, 0) },
  // Row 1: backpack, barn/granary, reward bag, castle+gate
  backpack:     { sheet: SHEETS.buttons, ...pos4(0, 1) },
  barn:         { sheet: SHEETS.buttons, ...pos4(1, 1) },
  reward_bag:   { sheet: SHEETS.buttons, ...pos4(2, 1) },
  castle_gate:  { sheet: SHEETS.buttons, ...pos4(3, 1) },
  // Row 2: market stall, green farmhouse, exclamation(!), sand castle
  market_stall: { sheet: SHEETS.buttons, ...pos4(0, 2) },
  green_house:  { sheet: SHEETS.buttons, ...pos4(1, 2) },
  exclamation:  { sheet: SHEETS.buttons, ...pos4(2, 2) },
  castle_small: { sheet: SHEETS.buttons, ...pos4(3, 2) },
  // Row 3: scroll, gold medal, water+gear, settings gear
  scroll:       { sheet: SHEETS.buttons, ...pos4(0, 3) },
  medal:        { sheet: SHEETS.buttons, ...pos4(1, 3) },
  water_gear:   { sheet: SHEETS.buttons, ...pos4(2, 3) },
  settings:     { sheet: SHEETS.buttons, ...pos4(3, 3) },

  // ──── ITEMS SHEET (4x4, 256px) ────
  // Row 0: purple beet, bread, watering can, red strawberry
  beet:         { sheet: SHEETS.items, ...pos4(0, 0) },
  bread:        { sheet: SHEETS.items, ...pos4(1, 0) },
  watering_can: { sheet: SHEETS.items, ...pos4(2, 0) },
  strawberry:   { sheet: SHEETS.items, ...pos4(3, 0) },
  // Row 1: wand/rod, key, milk bottle, sunflower
  wand:         { sheet: SHEETS.items, ...pos4(0, 1) },
  key:          { sheet: SHEETS.items, ...pos4(1, 1) },
  milk:         { sheet: SHEETS.items, ...pos4(2, 1) },
  sunflower:    { sheet: SHEETS.items, ...pos4(3, 1) },
  // Row 2: blue potion, egg, sunflower(dark), blueprint scroll
  potion:       { sheet: SHEETS.items, ...pos4(0, 2) },
  egg:          { sheet: SHEETS.items, ...pos4(1, 2) },
  sunflower_alt:{ sheet: SHEETS.items, ...pos4(2, 2) },
  blueprint:    { sheet: SHEETS.items, ...pos4(3, 2) },
  // Row 3: gold heart, cookie/stone, cotton flower, blueprint alt
  heart_gold:   { sheet: SHEETS.items, ...pos4(0, 3) },
  cookie:       { sheet: SHEETS.items, ...pos4(1, 3) },
  cotton:       { sheet: SHEETS.items, ...pos4(2, 3) },
  blueprint_alt:{ sheet: SHEETS.items, ...pos4(3, 3) },

  // ──── CHARACTER SHEET (5x3, ~205x341px) ────
  // Row 0: farmer, mage(pink), knight(armor), guard(shield), wizard
  farmer:       { sheet: SHEETS.characters, ...posChar(0, 0) },
  mage:         { sheet: SHEETS.characters, ...posChar(1, 0) },
  knight:       { sheet: SHEETS.characters, ...posChar(2, 0) },
  guard:        { sheet: SHEETS.characters, ...posChar(3, 0) },
  wizard:       { sheet: SHEETS.characters, ...posChar(4, 0) },
  // Row 1: baker(basket), princess, explorer(brown), witch(purple), warrior(mace)
  baker:        { sheet: SHEETS.characters, ...posChar(0, 1) },
  princess:     { sheet: SHEETS.characters, ...posChar(1, 1) },
  explorer:     { sheet: SHEETS.characters, ...posChar(2, 1) },
  witch:        { sheet: SHEETS.characters, ...posChar(3, 1) },
  warrior:      { sheet: SHEETS.characters, ...posChar(4, 1) },
  // Row 2: farmer girl, traveler, adventurer, ranger(green)
  farmer_girl:  { sheet: SHEETS.characters, ...posChar(0, 2) },
  traveler:     { sheet: SHEETS.characters, ...posChar(1, 2) },
  adventurer:   { sheet: SHEETS.characters, ...posChar(2, 2) },
  ranger:       { sheet: SHEETS.characters, ...posChar(3, 2) },
};

/**
 * Game element ID → sprite key mapping.
 * Carefully matched to actual sprite visuals.
 */
const GAME_SPRITE_ALIASES = {
  // ── Resources (TopBar) ──
  gold: 'medal',             // gold circular badge
  kh_token: 'reward_bag',    // red bag with star = special token
  wood: 'wand',              // wooden rod/stick
  stone: 'cookie',           // brown round object
  iron: 'key',               // metallic item
  wheat: 'bread',            // bread = grain product
  water: 'watering_can',

  // ── Crops ──
  crop_wheat: 'sunflower',       // tall crop plant
  crop_carrot: 'strawberry',     // red vegetable/fruit
  crop_potato: 'cookie',         // brown round = potato
  crop_tomato: 'strawberry',     // red fruit
  crop_corn: 'sunflower_alt',    // tall plant, darker
  crop_pumpkin: 'egg',           // round orange object
  crop_grape: 'beet',            // purple fruit = grape

  // ── Animals (use related product/item, no animal sprites exist) ──
  chicken: 'egg',            // chicken → its product
  cow: 'milk',               // cow → its product
  sheep: 'cotton',           // sheep → wool/cotton

  // ── Animal Products ──
  product_egg: 'egg',
  product_milk: 'milk',
  product_wool: 'cotton',

  // ── Buildings (all from clean Buttons sheet) ──
  farm_plot: 'green_house',      // green farmhouse
  barn_building: 'barn',         // granary/barn
  mill: 'water_gear',            // gears = milling machinery
  sawmill: 'settings',           // gear = saw machinery
  smithy: 'key',                 // metalwork = key
  stable: 'barn',                // animal housing
  wall: 'castle_gate',           // fortified gate
  tower: 'castle_tower',         // defense tower
  barracks: 'castle_flag',       // military building with flag
  trap: 'exclamation',           // warning/danger
  tavern: 'market_stall',        // social gathering place
  market: 'backpack',            // trade/commerce
  embassy: 'castle_small',       // diplomatic building
  throne_room: 'medal',          // royal symbol
  library: 'scroll',             // knowledge/research

  // ── Troops (character sprites) ──
  militia: 'guard',          // light armor = basic infantry
  archer: 'mage',            // ranged attacker (wand = bow)
  cavalry: 'knight',         // heavy armor = mounted warrior
  spearman: 'warrior',       // melee with weapon
  siege_ram: 'castle_small', // targets castles

  // ── Navigation ──
  nav_farm: 'green_house',
  nav_castle: 'castle_flag',
  nav_token: 'reward_bag',
  nav_commerce: 'market_stall',
  nav_combat: 'castle_tower',

  // ── NPCs (character sprites for missions) ──
  npc_farmer: 'farmer',
  npc_baker: 'baker',
  npc_princess: 'princess',
  npc_wizard: 'wizard',
  npc_knight: 'knight',
  npc_explorer: 'explorer',
  npc_witch: 'witch',
  npc_merchant: 'traveler',

  // ── UI Elements ──
  crown: 'medal',
  trophy: 'reward_bag',
  skull: 'close',
  mission_board: 'scroll',
  caravan: 'backpack',
  settings_icon: 'settings',
  back_button: 'back',
  close_button: 'close',

  // ── Token System ──
  burn: 'reward_bag',
  wallet: 'backpack',
  referral: 'farmer',
  streak: 'medal',
  daily_task: 'exclamation',
  social_task: 'castle_flag',
};

/**
 * Game element ID → nombre del set de íconos GRIMDARK (grimIconSheet.generated).
 * Solo IDs que tienen equivalente grim; el resto sigue cayendo al legacy.
 * Los nombres del set grim (gold, wood, wheat, sword, castle, …) también
 * resuelven directo sin alias. Mientras GRIM_SHEET sea null este mapa es
 * inerte y todo usa GAME_SPRITE_ALIASES + SPRITE_MAP como siempre.
 */
const GRIM_ALIASES = {
  // ── Crops ──
  crop_wheat:   'wheat',
  crop_carrot:  'carrot',
  crop_potato:  'potato',
  crop_tomato:  'tomato',
  crop_corn:    'corn',
  crop_pumpkin: 'pumpkin',
  crop_grape:   'grape',

  // ── Animal products ──
  product_egg:  'egg',
  product_milk: 'milk',
  product_wool: 'wool',

  // ── Buildings ──
  farm_plot:     'farmhouse',
  barn_building: 'barn',
  throne_room:   'castle',
  smithy:        'sword',   // forja de armas
  embassy:       'scroll',  // diplomacia
  library:       'scroll',

  // ── Troops ──
  militia:   'sword',
  archer:    'bow',
  cavalry:   'horse',
  spearman:  'spear',
  siege_ram: 'ram',

  // ── Navigation ──
  nav_farm:     'farmhouse',
  nav_castle:   'castle',
  nav_token:    'kh_token',
  nav_commerce: 'market',
  nav_combat:   'tower',

  // ── UI / token system ──
  settings_icon: 'gear',
  settings:      'gear',
  streak:        'flame',
  burn:          'flame',
  daily_task:    'check',
  social_task:   'star',
  mission_board: 'scroll',
  reward:        'reward_bag',
  trophy:        'medal',
};

/** Resuelve un nombre contra el sheet grim. Devuelve null si no hay arte. */
function getGrimSprite(id) {
  if (!GRIM_SHEET) return null; // arte aún no generado → legacy
  const grimName = GRIM_ICONS[id] ? id : GRIM_ALIASES[id];
  const cell = grimName && GRIM_ICONS[grimName];
  if (!cell) return null;
  return {
    sheet: GRIM_SHEET,
    x: cell.col * GRIM_CELL,
    y: cell.row * GRIM_CELL,
    w: GRIM_CELL,
    h: GRIM_CELL,
    sheetW: GRIM_SHEET_W,
    sheetH: GRIM_SHEET_H,
  };
}

/**
 * Get sprite data for a game element.
 * Resolves against the grimdark icon sheet FIRST (once its art exists),
 * then falls back to the legacy sheets: direct match, then alias lookup.
 */
function getSprite(id) {
  const grim = getGrimSprite(id);
  if (grim) return grim;
  if (SPRITE_MAP[id]) return SPRITE_MAP[id];
  const alias = GAME_SPRITE_ALIASES[id];
  if (alias && SPRITE_MAP[alias]) return SPRITE_MAP[alias];
  return null;
}

export { SPRITE_MAP, GAME_SPRITE_ALIASES, GRIM_ALIASES, SHEETS, getSprite };
export default SPRITE_MAP;
