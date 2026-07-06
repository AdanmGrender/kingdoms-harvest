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
  // Previously fell through to FALLBACK and looked identical in-world.
  house:       'iso_struct_4',  // standard HOUSE pool variant
  mine:        'iso_struct_8',  // rocky stub from RUINS pool reads as a pit
  stable:      'iso_struct_10', // BARN-pool variant — wide low roof
  wall:        'iso_struct_5',  // short stone pentagon — wall segment
  trap:        'iso_struct_19', // jagged ruins — fits a hidden trap
  embassy:     'iso_struct_7',  // fancier HOUSE-pool building
  library:     'iso_struct_15', // CHURCH-pool variant w/ tall door
};

const FALLBACK = 'iso_struct_16';

/**
 * Slots de arte por edificio: BootScene carga assets/game/buildings/<id>.png
 * como textura `bld_<id>` (gen_placeholders los genera siempre; el arte IA
 * final sobrescribe el PNG). Si la textura existe se prefiere sobre el
 * stand-in Kenney — así el arte gotea edificio por edificio sin tocar código.
 * @param {Phaser.Scene} scene — opcional; sin escena devuelve el mapa legacy.
 */
export function getBuildingSprite(buildingId, scene) {
  const slot = `bld_${buildingId}`;
  if (scene?.textures?.exists(slot)) return slot;
  return BUILDING_SPRITES[buildingId] || FALLBACK;
}

/**
 * Luces falsas por edificio (GlowLights.addGlow). dx/dy en píxeles desde el
 * punto de anclaje del sprite del edificio. Colores de la paleta grimdark
 * (docs/art-style.md): velas naranja, holo teal, forja roja.
 */
export const BUILDING_LIGHTS = {
  throne_room: [{ dx: 0,  dy: -26, color: 0x4fd8c8, radius: 46 },
                { dx: -18, dy: -6, color: 0xe8933a, radius: 16 },
                { dx: 18,  dy: -6, color: 0xe8933a, radius: 16 }], // holo + antorchas
  smithy:      [{ dx: 0,  dy: -12, color: 0xff3a20, radius: 38 }], // tubos de forja
  tavern:      [{ dx: -10, dy: -16, color: 0xe8933a, radius: 30 },
                { dx: 12,  dy: -10, color: 0xe8933a, radius: 24 }], // velas
  tower:       [{ dx: 0,  dy: -34, color: 0xff2020, radius: 18 }], // LED centinela
  embassy:     [{ dx: 0,  dy: -22, color: 0x4fd8c8, radius: 28 }], // antenas
  library:     [{ dx: 0,  dy: -14, color: 0x4fd8c8, radius: 26 }], // pantallas teal
  mill:        [{ dx: 0,  dy: -10, color: 0xe8933a, radius: 22 }], // horno de raciones
  barracks:    [{ dx: -14, dy: -10, color: 0xe8933a, radius: 18 },
                { dx: 14,  dy: -10, color: 0xe8933a, radius: 18 }], // antorchas del patio
  market:      [{ dx: 0,  dy: -8,  color: 0xe8933a, radius: 22 }], // faroles del bazar
  house:       [{ dx: 0,  dy: -12, color: 0xe8933a, radius: 16 }], // ventana encendida
  barn:        [{ dx: 0,  dy: -8,  color: 0xff3a20, radius: 14 }], // luz roja de puerta
};
