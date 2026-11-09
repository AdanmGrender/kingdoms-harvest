import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  computeFormation, enemyList, faceCoverage, groundY, ENEMY_HEIGHT_FRAC, WORLD, HUD_TOP, ENEMY_TOP, ENEMY_TOP_SOLO,
  LANE_MAX, LANE_GAP, FLOOR_MARGIN, FOOT_MARGIN, HERO_H, ROWS,
} from '../game/combat/formation';
import {
  heroArt, enemyArt, bgArt, isBossNode, collectAssetKeys, textureUrl, spriteGeom, bgImageRowToWorldY, bgCoverScale,
  FALLBACK, HERO_ART, ENEMY_ART, BG_ART, BG_GROUND_Y_FRAC, BG_FLOOR_IMAGE_FRAC, SPRITE_GEOM, BG_IMAGE,
} from '../game/combat/artMap';

// shared/ es CommonJS fuera de la raíz de Vite: se lee solo en el test.
// eslint-disable-next-line no-undef
const { HEROES, CAMPAIGN } = require('../../../shared/gameConfig.js');

const hero = (slot, extra = {}) => ({ slot, heroId: `x${slot}`, class: 'warrior', ...extra });
const heroes = (n) => Array.from({ length: n }, (_, i) => hero(i + 1));
const enemies = (m) => Array.from({ length: m }, (_, i) => ({ id: `e${i}`, hp: 100 }));
const inter = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

// Evidencia medida que fija los números del layout (specs/combate_b/evidencia/hoja/).
const HOJA = path.resolve(__dirname, '..', '..', '..', 'specs', 'combate_b', 'evidencia', 'hoja');
const CALIB = JSON.parse(fs.readFileSync(path.join(HOJA, 'calibracion_suelo.json'), 'utf8'));
const HUD = JSON.parse(fs.readFileSync(path.join(HOJA, 'hud_medidas.json'), 'utf8')).resumen;

// Las 14 configuraciones de la matriz R24: los 13 nodos de combate reales + «sin nodo» (crypt + bruto).
const NODES = CAMPAIGN.filter((n) => ['combat', 'wave', 'boss'].includes(n.type));
const CONFIGS = [null, ...NODES];
const SQUADS = {
  mixto: ['warrior', 'mage', 'ranger', 'paladin', 'rogue'],
  rogue: ['rogue', 'rogue', 'rogue', 'rogue', 'rogue'], // las siluetas más anchas
  ranger: ['ranger', 'ranger', 'ranger', 'ranger', 'ranger'],
};
const squad = (n, cls = SQUADS.mixto) => Array.from({ length: n }, (_, i) => hero(i + 1, { class: cls[i] }));
const form = (node, n, m, cls) => computeFormation(squad(n, cls), enemies(m), { node, boss: !!node && isBossNode(node) });
const label = (node) => (node ? `${node.id} (${bgArt(node)})` : 'sin nodo (crypt)');

/** Verifica una formación contra R24 enmendado, V2 enmendada y los topes reales del HUD (V3). */
function checkFormation(f, node, n, m) {
  const all = [...f.heroes, ...f.enemies];
  expect(f.heroes).toHaveLength(n);
  expect(f.enemies).toHaveLength(m);
  // dentro de 824×1720
  for (const b of all) {
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.y).toBeGreaterThanOrEqual(0);
    expect(b.x + b.w).toBeLessThanOrEqual(WORLD.w);
    expect(b.y + b.h).toBeLessThanOrEqual(WORLD.h);
  }
  // R24 (enmienda 2026-11-08): cero intersección DENTRO de cada fila
  const rows = {};
  for (const b of all) (rows[b.row] = rows[b.row] || []).push(b);
  for (const list of Object.values(rows)) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) expect(inter(list[i], list[j]), `${list[i].id}×${list[j].id}`).toBe(false);
    }
  }
  // V2: un carril por fila, en orden de atrás (arriba) a adelante (abajo), y el pie (fila inferior con alfa) sobre él
  const present = ROWS.filter((r) => rows[r]);
  for (const r of present) {
    for (const b of rows[r]) {
      expect(b.lane).toBe(f.lanes[r]);
      expect(b.anchor.y).toBe(b.lane);
      expect(Math.abs(b.alpha.y + b.alpha.h - b.lane)).toBeLessThan(1e-6);
      expect(b.depth).toBe(b.lane); // la fila de abajo se dibuja delante
    }
  }
  for (let i = 1; i < present.length; i++) expect(f.lanes[present[i]] - f.lanes[present[i - 1]]).toBeGreaterThanOrEqual(LANE_GAP);
  // V2: todos los carriles sobre el piso transitable de SU fondo (calibración medida) y sobre los botones reales
  const g = CALIB[bgArt(node)].groundY;
  for (const r of present) {
    expect(f.lanes[r], `${r} ≥ piso ${g}`).toBeGreaterThanOrEqual(g + FLOOR_MARGIN);
    expect(f.lanes[r]).toBeLessThanOrEqual(LANE_MAX);
  }
  // V3: cabezas de los enemigos bajo las barras
  for (const b of f.enemies) expect(b.y).toBeGreaterThanOrEqual(m === 1 ? ENEMY_TOP_SOLO : ENEMY_TOP);
  // legibilidad: las caras de los héroes nunca quedan tapadas
  const cov = faceCoverage(f);
  for (const b of f.heroes) expect(cov[b.id], `cara de ${b.id}`).toBe(0);
}

describe('R24 (por fila) + V2 (carriles) + V3: 14 configuraciones × n = 1…5 × m = 1…4 = 280 combinaciones', () => {
  for (const node of CONFIGS) {
    for (let n = 1; n <= 5; n++) {
      for (let m = 1; m <= 4; m++) {
        it(`${label(node)}: ${n} héroes × ${m} enemigos`, () => checkFormation(form(node, n, m), node, n, m));
      }
    }
  }
  it('lo mismo con las escuadras de siluetas más anchas (rogue) y más angostas (ranger)', () => {
    for (const cls of [SQUADS.rogue, SQUADS.ranger]) {
      for (const node of CONFIGS) for (let n = 1; n <= 5; n++) for (let m = 1; m <= 4; m++) checkFormation(form(node, n, m, cls), node, n, m);
    }
  });
  it('slots 1–3 al frente (HF) y 4–5 atrás (HB, más arriba); ids h<slot>', () => {
    const f = computeFormation(heroes(5), enemies(1));
    expect(f.heroes.map((b) => [b.id, b.row])).toEqual([['h1', 'HF'], ['h2', 'HF'], ['h3', 'HF'], ['h4', 'HB'], ['h5', 'HB']]);
    expect(f.lanes.HB).toBeLessThan(f.lanes.HF);
    // los traseros asoman entre los delanteros (ladrillo)
    const [h1, h2, h3, h4, h5] = f.heroes;
    expect(h4.cx).toBeGreaterThan(h1.cx);
    expect(h4.cx).toBeLessThan(h2.cx);
    expect(h5.cx).toBeGreaterThan(h2.cx);
    expect(h5.cx).toBeLessThan(h3.cx);
  });
  it('heroId:null (Guarnición) → arte warrior', () => {
    const f = computeFormation([{ slot: 1, heroId: null, class: 'warrior' }], enemies(1));
    expect(f.heroes[0].art).toBe('warrior');
    expect(heroArt(null, 'warrior')).toBe('warrior');
    expect(heroArt({ heroId: null })).toBe('warrior');
  });
  it('R25: estado v1 (solo enemy) → 1 enemigo con id e0; state.enemies de 4 → 4 escalonados en dos carriles', () => {
    expect(enemyList({ enemy: { hp: 10 } })).toEqual([{ hp: 10, id: 'e0' }]);
    expect(enemyList({ enemies: [{ id: 'e0' }], enemy: { hp: 1 } })).toHaveLength(1);
    const four = enemyList({ enemies: enemies(4) });
    expect(four).toHaveLength(4);
    const f = computeFormation(heroes(3), four);
    expect(f.enemies).toHaveLength(4);
    expect(f.enemies.map((b) => b.row)).toEqual(['EB', 'EB', 'EF', 'EF']);
    expect(f.lanes.EB).toBeLessThan(f.lanes.EF);
    expect(enemyList({})).toEqual([]);
    expect(computeFormation([], []).enemies).toEqual([]);
    expect(computeFormation(undefined, undefined).heroes).toEqual([]);
  });
  it('un enemigo solo o un jefe usan un único carril (EF)', () => {
    expect(computeFormation(heroes(5), enemies(1)).enemies[0].row).toBe('EF');
    const boss = computeFormation(heroes(5), enemies(1), { node: { id: 'a1n9', type: 'boss', act: 1 }, boss: true });
    expect(boss.enemies[0].row).toBe('EF');
    expect(Object.keys(boss.lanes).sort()).toEqual(['EF', 'HB', 'HF']);
  });
  it('más de 4 enemigos se recortan a 4', () => {
    expect(computeFormation(heroes(1), enemies(7)).enemies).toHaveLength(4);
  });
});

describe('R27: topes de tamaño del enemigo (F9)', () => {
  it('ENEMY_HEIGHT_FRAC = {normal 0.29, boss 0.36} y la caja = fracción × 1720', () => {
    expect(ENEMY_HEIGHT_FRAC).toEqual({ normal: 0.29, boss: 0.36 });
    const n = computeFormation(heroes(3), enemies(1)).enemies[0];
    const b = computeFormation(heroes(3), enemies(1), { boss: true }).enemies[0];
    expect(n.h).toBe(Math.round(0.29 * 1720));
    expect(b.h).toBe(Math.round(0.36 * 1720));
    expect(computeFormation(heroes(1), enemies(1), { boss: { type: 'boss' } }).enemies[0].h).toBe(b.h);
  });
  it('un grupo nunca supera el tope de un enemigo único', () => {
    for (let m = 2; m <= 4; m++) for (const e of computeFormation(heroes(3), enemies(m)).enemies) expect(e.h).toBeLessThanOrEqual(Math.round(0.29 * 1720));
  });
});

describe('R30: mapa de arte exhaustivo', () => {
  const NODES = CAMPAIGN.filter((n) => ['combat', 'wave', 'boss'].includes(n.type));
  it('18 héroes y 13 nodos de combate', () => {
    expect(Object.keys(HEROES)).toHaveLength(18);
    expect(NODES).toHaveLength(13);
  });
  it('cada heroId resuelve a una clave de arte existente', () => {
    for (const [id, h] of Object.entries(HEROES)) {
      const k = heroArt(id, h.class);
      expect(Object.keys(HERO_ART), `${id}:${h.class}`).toContain(k);
    }
  });
  it('S1 (T8): cada clase, incluidas paladin y rogue, resuelve a su propia clave (antes → warrior hasta que existiera su arte; design.md:105)', () => {
    expect(heroArt('viktor', 'paladin')).toBe('paladin');
    expect(heroArt('shadow', 'rogue')).toBe('rogue');
    expect(heroArt('lyra', 'mage')).toBe('mage');
    expect(heroArt('finn', 'ranger')).toBe('ranger');
    expect(heroArt('x', 'warrior')).toBe('warrior');
    expect(heroArt(null, 'zzz')).toBe('warrior');
  });
  it('Q4: mapeo enemigo ↔ nodo (design.md:175) + a2n7/a2n10 (§11); el resto cae a bruto', () => {
    const want = {
      a1n3: 'bruto', a1n7: 'carroneros', a1n4: 'aullador', a1n8: 'aullador', a1n5: 'boss_heraldo',
      a1n9: 'boss_devorador', a2n5: 'coloso', a2n7: 'sin_rostro', a2n10: 'voz_del_velo',
      a2n2: 'bruto', a2n4: 'bruto', a2n8: 'bruto', a2n9: 'bruto',
    };
    for (const n of NODES) expect(enemyArt(n), n.id).toBe(want[n.id]);
    expect(Object.keys(ENEMY_ART).sort()).toEqual(['aullador', 'boss_devorador', 'boss_heraldo', 'bruto', 'carroneros', 'coloso', 'sin_rostro', 'voz_del_velo']);
  });
  it('fondos por acto+tipo: 6 fondos distintos y los 13 nodos cubiertos', () => {
    const want = { '1:combat': 'crypt', '1:wave': 'moor', '1:boss': 'cathedral', '2:combat': 'ashfield', '2:wave': 'veil_marsh', '2:boss': 'veil_gate' };
    for (const n of NODES) expect(bgArt(n), n.id).toBe(want[`${n.act}:${n.type}`]);
    expect(new Set(NODES.map((n) => bgArt(n)))).toEqual(new Set(Object.keys(BG_ART)));
    expect(bgArt({ id: 'a2n4', type: 'wave' })).toBe('veil_marsh'); // el acto sale del id si falta `act`
    expect(bgArt({ type: 'wave' })).toBe('crypt'); // sin acto → por tipo
  });
  it('cada nodo resuelve enemigo y fondo existentes', () => {
    for (const n of NODES) {
      expect(Object.keys(ENEMY_ART), n.id).toContain(enemyArt(n));
      expect(Object.keys(BG_ART), n.id).toContain(bgArt(n));
    }
  });
  it('ids desconocidos → fallback explícito, sin lanzar', () => {
    for (const bad of ['zzz', null, undefined, 42, {}, '__proto__', 'constructor', 'toString']) {
      expect(heroArt(bad)).toBe(FALLBACK.hero);
      expect(heroArt(bad, bad)).toBe(FALLBACK.hero);
      expect(enemyArt(bad)).toBe(FALLBACK.enemy);
      expect(bgArt(bad)).toBe(FALLBACK.bg);
      expect(enemyArt({ id: bad, type: bad })).toBe(FALLBACK.enemy);
    }
    expect(FALLBACK).toEqual({ hero: 'warrior', enemy: 'bruto', bg: 'crypt' });
  });
});

describe('R32: collectAssetKeys', () => {
  const node = { id: 'a1n3', type: 'combat' };
  it('3 héroes + 1 enemigo → ≤ 3×2 + 2 + 1 claves, sin repetir', () => {
    const state = { heroes: [hero(1, { class: 'warrior' }), hero(2, { class: 'mage' }), hero(3, { class: 'ranger' })], enemy: { hp: 1 } };
    const keys = collectAssetKeys(state, node);
    expect(keys.length).toBeLessThanOrEqual(3 * 2 + 2 + 1);
    expect(new Set(keys.map((k) => k.key)).size).toBe(keys.length);
    expect(keys.map((k) => k.key)).toEqual(expect.arrayContaining(['hero:warrior:idle', 'hero:mage:attack', 'enemy:bruto:hit', 'bg:crypt']));
  });
  it('héroes de la misma clase comparten textura', () => {
    const state = { heroes: [hero(1), hero(2), hero(3), hero(4), hero(5)] };
    expect(collectAssetKeys(state, node).filter((k) => k.key.startsWith('hero:'))).toHaveLength(2);
  });
  it('estado/nodo ausentes no lanzan y devuelven al menos enemigo y fondo', () => {
    const keys = collectAssetKeys(undefined, undefined);
    expect(keys.map((k) => k.key)).toEqual(expect.arrayContaining(['enemy:bruto:idle', 'bg:crypt']));
  });
});

describe('R28/R29: nada de /assets/game/', () => {
  const root = path.resolve(__dirname, '..');
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
  it('barrido de client/src/game/combat/** y CombatStage.jsx = 0 coincidencias (el panel se barre en T7)', () => {
    const files = [...walk(path.join(root, 'game', 'combat'))];
    for (const f of ['components/campaign/CombatStage.jsx']) {
      const p = path.join(root, f);
      if (fs.existsSync(p)) files.push(p);
    }
    expect(files.length).toBeGreaterThan(3);
    const bad = files.filter((f) => /assets\/game\//.test(fs.readFileSync(f, 'utf8')));
    expect(bad.map((f) => path.relative(root, f))).toEqual([]);
  });
  it('todas las urls del mapa están bajo /assets/b/ y los archivos existen en public/', () => {
    const pub = path.resolve(root, '..', 'public');
    const state = { heroes: Object.values(HEROES).map((h, i) => ({ slot: (i % 5) + 1, heroId: h.id, class: h.class })), enemy: { hp: 1 } };
    for (const n of CAMPAIGN.filter((x) => ['combat', 'wave', 'boss'].includes(x.type))) {
      for (const k of collectAssetKeys(state, n)) {
        expect(k.url.startsWith('/assets/b/')).toBe(true);
        expect(fs.existsSync(path.join(pub, k.url)), k.url).toBe(true);
      }
    }
    expect(textureUrl('hero', 'zzz', 'idle')).toBe('/assets/b/heroes/warrior_idle.webp');
    expect(textureUrl('enemy', 'zzz', 'hit')).toBe('/assets/b/enemies/bruto_hit.webp');
    expect(textureUrl('bg', 'zzz')).toBe('/assets/b/bg/combat_crypt.webp');
  });
});


describe('V1: escalas', () => {
  const solo = Math.round(0.29 * 1720);
  it('héroe delantero = 0,60–0,70 del común solo; trasera = 0,80–0,85 de la delantera', () => {
    const f = computeFormation(squad(5), enemies(1), { node: { id: 'a1n3', type: 'combat', act: 1 } });
    const front = f.heroes.find((b) => b.row === 'HF');
    const back = f.heroes.find((b) => b.row === 'HB');
    expect(front.h).toBe(HERO_H);
    expect(front.h / solo).toBeGreaterThanOrEqual(0.6);
    expect(front.h / solo).toBeLessThanOrEqual(0.7);
    expect(back.h / front.h).toBeGreaterThanOrEqual(0.8);
    expect(back.h / front.h).toBeLessThanOrEqual(0.85);
    expect(f.enemies[0].h).toBe(solo);
  });
  it('jefe = 1,8–2,2 × héroe', () => {
    for (const id of ['a1n5', 'a1n9', 'a2n5', 'a2n10']) {
      const node = NODES.find((x) => x.id === id);
      const r = form(node, 5, 1).enemies[0].h / HERO_H;
      expect(r, id).toBeGreaterThanOrEqual(1.8);
      expect(r, id).toBeLessThanOrEqual(2.2);
    }
  });
  it('con 3–4 enemigos ningún común baja de 0,9 × héroe (y ninguno pasa el tope de uno solo)', () => {
    for (const node of CONFIGS) {
      for (const m of [3, 4]) {
        for (const e of form(node, 5, m).enemies) {
          expect(e.h / HERO_H).toBeGreaterThanOrEqual(0.9);
          expect(e.h).toBeLessThanOrEqual(solo);
        }
      }
    }
  });
});

describe('V2: piso calibrado por fondo (BG_GROUND_Y_FRAC = calibracion_suelo.json)', () => {
  it('cada fondo: fila de la imagen → y del mundo con la transformación de la escena = la calibración medida', () => {
    expect(Object.keys(BG_FLOOR_IMAGE_FRAC).sort()).toEqual(Object.keys(BG_ART).sort());
    for (const [bg, c] of Object.entries(CALIB)) {
      expect(BG_FLOOR_IMAGE_FRAC[bg], bg).toBe(c.imagenFrac);
      expect(bgImageRowToWorldY(BG_FLOOR_IMAGE_FRAC[bg]), bg).toBe(c.groundY);
      expect(BG_GROUND_Y_FRAC[bg], bg).toBe(c.frac);
      expect(Math.round(BG_GROUND_Y_FRAC[bg] * 1720), bg).toBe(c.groundY);
    }
    // la escala de la escena (cover × 1,04) es la que se usó para calibrar
    expect(bgCoverScale(BG_IMAGE.w, BG_IMAGE.h)).toBeCloseTo((1720 / 1935) * 1.04, 10);
  });
  it('los seis pisos son distintos: el test no mira una constante única', () => {
    expect(new Set(Object.values(CALIB).map((c) => c.groundY)).size).toBe(6);
    for (const node of NODES) expect(groundY(node), node.id).toBe(CALIB[bgArt(node)].groundY);
  });
  it('los enemigos pisan su piso: el carril de atrás nunca queda sobre la línea de suelo', () => {
    for (const node of NODES) {
      const f = form(node, 5, 4);
      expect(f.lanes.EB, node.id).toBeGreaterThan(CALIB[bgArt(node)].groundY);
    }
  });
});

describe('V3: topes reales del HUD (hud_medidas.json, 412×860 / 360×800 / 1280×800)', () => {
  it('HUD_TOP = borde superior real de los botones de héroe (peor caso) y los pies quedan por encima', () => {
    expect(HUD_TOP).toBeLessThanOrEqual(HUD.Bmin);
    expect(HUD.Bmin - HUD_TOP).toBeLessThan(1);
    expect(LANE_MAX).toBe(HUD_TOP - FOOT_MARGIN);
  });
  it('las cabezas de los enemigos quedan por debajo de las barras de vida medidas', () => {
    expect(ENEMY_TOP_SOLO).toBeGreaterThanOrEqual(HUD.Tmax_1enemigo);
    expect(ENEMY_TOP).toBeGreaterThanOrEqual(HUD.Tmax_2omas);
  });
});

describe('Geometría de las texturas (SPRITE_GEOM)', () => {
  // ancho y alto del encabezado de un webp (VP8X / VP8L / VP8)
  const webpSize = (file) => {
    const b = fs.readFileSync(file);
    const fourcc = b.toString('ascii', 12, 16);
    if (fourcc === 'VP8X') return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
    if (fourcc === 'VP8L') {
      const v = b.readUInt32LE(21);
      return { w: 1 + (v & 0x3fff), h: 1 + ((v >> 14) & 0x3fff) };
    }
    return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
  };
  const pub = path.resolve(__dirname, '..', '..', 'public');
  it('cada textura de héroe y enemigo tiene geometría coherente y W×H iguales a su webp', () => {
    const keys = [
      ...Object.entries(HERO_ART).flatMap(([k, poses]) => poses.map((p) => ['hero', k, p])),
      ...Object.entries(ENEMY_ART).flatMap(([k, poses]) => poses.map((p) => ['enemy', k, p])),
    ];
    expect(Object.keys(SPRITE_GEOM).sort()).toEqual(keys.map(([kind, k, p]) => `${kind}:${k}:${p}`).sort());
    for (const [kind, k, p] of keys) {
      const g = spriteGeom(kind, k, p);
      expect(g.l).toBeGreaterThanOrEqual(0);
      expect(g.r).toBeLessThan(g.W);
      expect(g.l).toBeLessThan(g.r);
      expect(g.t).toBeGreaterThanOrEqual(0);
      expect(g.b).toBeLessThan(g.H);
      expect(g.t).toBeLessThan(g.b);
      expect(g.ox).toBeGreaterThan(0);
      expect(g.ox).toBeLessThan(1);
      expect(g.oy).toBeCloseTo((g.b + 1) / g.H, 10);
      if (p === 'idle') expect(g.ox).toBe(0.5);
      expect(webpSize(path.join(pub, textureUrl(kind, k, p))), `${kind}:${k}:${p}`).toEqual({ w: g.W, h: g.H });
    }
  });
  it('arte desconocido → geometría del fallback (sin lanzar)', () => {
    expect(spriteGeom('enemy', 'zzz', 'hit')).toEqual(spriteGeom('enemy', FALLBACK.enemy, 'idle'));
    expect(spriteGeom('hero', 'zzz')).toEqual(spriteGeom('hero', FALLBACK.hero, 'idle'));
  });
});
