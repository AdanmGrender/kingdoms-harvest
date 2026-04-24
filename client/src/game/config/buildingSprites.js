/**
 * Maps each player building to a Kenney medieval-rts structure texture key.
 *
 * The old `buildings.png` spritesheet had very small sprites centered in 64×64
 * frames with huge white padding — after chroma-key most of each frame was
 * transparent and buildings appeared near-invisible in-world. Kenney's
 * structure PNGs fill the full 64×64 natively and carry their own alpha, so
 * we can drop the legacy sheet entirely for player buildings.
 *
 * Tile-ID choices mirror the procedural STRUCT_POOLS in IsoMapGenerator.js so
 * player buildings and organic world structures share the same visual
 * language (a tavern looks like a house, a tower looks like a watchtower).
 */
// Visual audit (2026-04-24) — tile IDs chosen after inspecting each PNG:
//   01: tall orange tower       02: stone gate w/ twin towers
//   03: side-view house          05: small stone pentagon
//   06: stone fort w/ archway    09/10/16/17/18: green-roof houses
//   11/12: windmill variants     13: tall watchtower
//   14/15: grave crosses (avoid for buildings)
//   22: columned temple          23: green dome pavilion
export const BUILDING_SPRITES = {
  throne_room: 'iso_struct_2',  // stone gate + twin towers — regal keep
  barn:        'iso_struct_9',  // green-roof wood barn
  mill:        'iso_struct_11', // windmill
  sawmill:     'iso_struct_17', // tent-style wood house
  smithy:      'iso_struct_6',  // stone fort w/ archway (smoky)
  market:      'iso_struct_3',  // side-view house w/ chimney
  tavern:      'iso_struct_23', // green dome pavilion
  barracks:    'iso_struct_22', // columned temple (military)
  tower:       'iso_struct_1',  // tall orange stone tower
};

const FALLBACK = 'iso_struct_16';

export function getBuildingSprite(buildingId) {
  return BUILDING_SPRITES[buildingId] || FALLBACK;
}
