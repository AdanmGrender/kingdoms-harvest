import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  computeFormation, enemyList, faceCoverage, groundY, lyingBox, lyingBoxes, hudToWorld, laneLimits, formationFits, ENEMY_HEIGHT_FRAC, WORLD, HUD_TOP, ENEMY_TOP,
  ENEMY_TOP_SOLO, LANE_MAX, LANE_GAP, FLOOR_MARGIN, FOOT_MARGIN, HERO_H, ROWS, BANNER_ZONE_BOTTOM, SHRINK_MIN,
} from '../game/combat/formation';
import { MAX_ASPECT } from '../utils/viewport';
import {
  heroArt, enemyArt, bgArt, isBossNode, collectAssetKeys, textureUrl, spriteGeom, bgImageRowToWorldY, bgCoverScale,
  bgImageColToWorldX, FALLBACK, HERO_ART, ENEMY_ART, BG_ART, BG_GROUND_Y_FRAC, BG_FLOOR_IMAGE_FRAC, BG_FLOOR_OBSTACLES,
  SPRITE_GEOM, BG_IMAGE, ATTACK_FX,
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
// Vistas de la hoja (T10.6) y las bajas que la decisión del 2026-11-09 suma a V2/V3 (H2).
const VISTAS = ['412x860', '360x800', '1280x800'];
const BAJAS = ['360x740', '375x667'];
const PEOR = '360x800';   // sin medida en tiempo de ejecución, la formación usa el peor caso de las 3 vistas
// Marco del panel (espejo de --kh-frame-h: alto ≤ 2,1 × ancho, centrado): el escenario lo llena y el lienzo va en FIT.
const marco = (vp) => { const [vw, vh] = vp.split('x').map(Number); const h = Math.min(vh, vw * MAX_ASPECT); return { w: vw, h, top: (vh - h) / 2 }; };
const zonaDe = (vp) => { const fr = marco(vp); return hudToWorld({ stage: { top: 0, width: fr.w, height: fr.h }, viewH: fr.h }).zoneBottom; };
const hudDe = (vp, m) => ({ bottom: HUD.porViewport[vp].B, top: m === 1 ? HUD.porViewport[vp].T1 : HUD.porViewport[vp].TN, zoneBottom: zonaDe(vp) });

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
// `vp`: pantalla de hud_medidas.json, o directamente sus bordes { B, T1, TN } (marcos muy bajos de H-c)
function checkFormation(f, node, n, m, vp = PEOR) {
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
  // H1: los márgenes se miden contra lo medido, no contra constantes del módulo: piso real del fondo
  // (calibracion_suelo.json) y bordes reales del HUD de la pantalla (hud_medidas.json). Márgenes ≥ 0.
  const g = CALIB[bgArt(node)].groundY;
  const hud = typeof vp === 'string' ? HUD.porViewport[vp] : vp;
  for (const r of present) {
    expect(f.lanes[r] - g, `${vp} ${r}: margen sobre el piso ${g}`).toBeGreaterThanOrEqual(0);
    expect(hud.B - f.lanes[r], `${vp} ${r}: margen bajo los botones ${hud.B}`).toBeGreaterThanOrEqual(0);
  }
  // V3: cabezas (tope de la silueta) de los enemigos bajo las barras medidas
  const T = m === 1 ? hud.T1 : hud.TN;
  for (const b of f.enemies) expect(b.alpha.y - T, `${vp} ${b.id}: margen bajo las barras ${T}`).toBeGreaterThanOrEqual(0);
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
  // lo mismo con las escuadras de siluetas más anchas (rogue) y más angostas (ranger): un `it` por escuadra y
  // configuración (20 formaciones cada uno), así ninguno depende de la carga de la máquina (B-1 de la ronda 3)
  for (const [nombre, cls] of [['rogue', SQUADS.rogue], ['ranger', SQUADS.ranger]]) {
    for (const node of CONFIGS) {
      it(`escuadra ${nombre} · ${label(node)}: n 1–5 × m 1–4`, () => {
        for (let n = 1; n <= 5; n++) for (let m = 1; m <= 4; m++) checkFormation(form(node, n, m, cls), node, n, m);
      });
    }
  }
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
  it('escuadras con huecos (solo slots 4–5, o 1 + 4–5) también caen en carriles válidos', () => {
    for (const slots of [[4, 5], [5], [1, 4, 5], [2, 5], [3, 4]]) {
      const hs = slots.map((slot) => hero(slot));
      for (const node of [null, NODES.find((x) => x.id === 'a1n9')]) {
        const f = computeFormation(hs, enemies(2), { node, boss: !!node && isBossNode(node) });
        for (const b of f.heroes) {
          expect(Number.isFinite(b.lane), `${slots}`).toBe(true);
          expect(b.lane).toBeLessThanOrEqual(LANE_MAX);
          expect(b.lane).toBeGreaterThanOrEqual(CALIB[bgArt(node)].groundY + FLOOR_MARGIN);
          expect(b.x).toBeGreaterThanOrEqual(0);
          expect(b.x + b.w).toBeLessThanOrEqual(WORLD.w);
        }
        for (const e of f.enemies) expect(e.lane).toBeLessThan(Math.min(...f.heroes.map((b) => b.lane)));
      }
    }
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

describe('V3: topes reales del HUD (hud_medidas.json)', () => {
  it('sin medida en tiempo de ejecución valen los del peor caso de las 3 vistas de la hoja', () => {
    expect(HUD_TOP).toBeLessThanOrEqual(HUD.Bmin);
    expect(HUD.Bmin - HUD_TOP).toBeLessThan(1);
    expect(LANE_MAX).toBe(HUD_TOP - FOOT_MARGIN);
    expect(ENEMY_TOP_SOLO).toBeGreaterThanOrEqual(HUD.Tmax_1enemigo);
    expect(ENEMY_TOP).toBeGreaterThanOrEqual(HUD.Tmax_2omas);
  });
});

describe('H2: carriles con el borde REAL de los botones y de las barras de cada pantalla (medido en tiempo de ejecución)', () => {
  // Matriz R24 de 280 (14 configuraciones × n 1–5 × m 1–4) × 3 escuadras en cada pantalla, con sus bordes medidos.
  // Un `it` por pantalla y configuración (60 formaciones cada uno): con la máquina cargada, el `it` por pantalla de 840
  // formaciones se pasaba de los 5 s (B-1 de la review ronda 3).
  for (const vp of [...VISTAS, ...BAJAS]) {
    for (const node of CONFIGS) {
      it(`${vp} · ${label(node)}: n 1–5 × m 1–4 × escuadras mixta, rogue y ranger, con sus bordes medidos`, () => {
        for (const cls of Object.values(SQUADS)) {
          for (let n = 1; n <= 5; n++) {
            for (let m = 1; m <= 4; m++) {
              const f = computeFormation(squad(n, cls), enemies(m), { node, boss: !!node && isBossNode(node), hud: hudDe(vp, m) });
              checkFormation(f, node, n, m, vp);
              expect(f.factor, `${vp} ${label(node)} n${n} m${m}`).toBe(1);   // H-c: en las pantallas de la hoja no se achica
            }
          }
        }
      });
    }
  }
  it('412×860, 360×800 y 1280×800: con su borde medido la formación es idéntica a la de siempre (nada visible cambia)', () => {
    for (const vp of VISTAS) {
      for (const node of CONFIGS) {
        for (let m = 1; m <= 4; m++) {
          const base = form(node, 5, m);
          const conHud = computeFormation(squad(5), enemies(m), { node, boss: !!node && isBossNode(node), hud: hudDe(vp, m) });
          expect(conHud, `${vp} ${label(node)} m${m}`).toEqual(base);
        }
      }
    }
  });
  it('la franja del cartel (B1) se mide en el marco del panel: el peor caso de las 3 vistas cabe en BANNER_ZONE_BOTTOM', () => {
    expect(marco('360x800')).toEqual({ w: 360, h: 756, top: 22 });       // tope de aspecto 2,1: bandas de 22 arriba y abajo
    expect(marco('412x860').top).toBe(0);
    const z = Object.fromEntries(VISTAS.map((vp) => [vp, zonaDe(vp)]));
    expect(z['412x860']).toBeCloseTo(654.8, 1);
    expect(z['1280x800']).toBeCloseTo(660.05, 1);
    expect(z['360x800']).toBeCloseTo(663.26, 1);
    for (const vp of VISTAS) expect(z[vp], vp).toBeLessThanOrEqual(BANNER_ZONE_BOTTOM);
    expect(BANNER_ZONE_BOTTOM - Math.max(...Object.values(z))).toBeLessThan(1);
  });
  it('el carril va al px de mundo más cercano: el ruido de subpíxel de la medida no mueve a nadie', () => {
    // 360×800 medido con DPR 2 (generar_evidencia_hoja.mjs) y con DPR 3 (medir_hud.mjs): el mismo 1320 que sin medida
    for (const bottom of [1327.5056, 1328.1, HUD_TOP]) expect(laneLimits({ bottom }).laneMax, `${bottom}`).toBe(LANE_MAX);
    // 375×667: 1271,95 → 1264, y el margen sobre los botones sigue ≥ 7,5
    const l = laneLimits({ bottom: 1271.949 });
    expect(l.laneMax).toBe(1264);
    expect(1271.949 - l.laneMax).toBeGreaterThanOrEqual(FOOT_MARGIN - 0.5);
    expect(laneLimits().laneMax).toBe(LANE_MAX);
  });
  it('B-3: una medida 0, negativa, no finita o fuera del lienzo no es una medida: vuelven las constantes', () => {
    const def = laneLimits();
    for (const v of [0, -10, -1e6, WORLD.h, 1e6, NaN, Infinity, -Infinity]) {
      expect(laneLimits({ bottom: v }).laneMax, `bottom ${v}`).toBe(def.laneMax);
      expect(laneLimits({ top: v }).top1, `top ${v}`).toBe(def.top1);
      expect(laneLimits({ top: v }).topN, `top ${v}`).toBe(def.topN);
      expect(laneLimits({ zoneBottom: v }).zoneBottom, `zoneBottom ${v}`).toBe(def.zoneBottom);
    }
    // hudToWorld no devuelve bordes fuera del lienzo: botones en y 0 o por encima, barras por debajo de todo
    const st = { top: 0, width: 412, height: 860 };
    expect(hudToWorld({ stage: st, buttonsTop: 0, barsBottom: 101 })).toEqual({ top: 202 });
    expect(hudToWorld({ stage: st, buttonsTop: -20 })).toBeNull();
    expect(hudToWorld({ stage: st, barsBottom: 900 })).toBeNull();                 // 1800 del mundo: fuera
    expect(hudToWorld({ stage: st, buttonsTop: 686, barsBottom: 0 })).toEqual({ bottom: 1372 });
    expect(hudToWorld({ stage: st, buttonsTop: 686, viewH: -5 })).toEqual({ bottom: 1372 });
  });
  it('B-3: con una medida que no deja sitio a la formación (botones en 600, barras en 1500, franja en 1700) vuelven las constantes', () => {
    for (const hud of [{ bottom: 600 }, { top: 1500 }, { zoneBottom: 1700 }, { bottom: 600, top: 1500, zoneBottom: 1700 }]) {
      for (const node of CONFIGS) {
        for (const m of [1, 2, 4]) {
          const opts = { node, boss: !!node && isBossNode(node) };
          const conHud = computeFormation(squad(5), enemies(m), { ...opts, hud });
          expect(formationFits(conHud), `${JSON.stringify(hud)} ${label(node)} m${m}`).toBe(true);
          expect(conHud, `${JSON.stringify(hud)} ${label(node)} m${m}`).toEqual(computeFormation(squad(5), enemies(m), opts));
        }
      }
    }
    // la medida buena se sigue usando: 375×667 sube a los héroes a 1264
    expect(computeFormation(squad(5), enemies(3), { node: NODES[0], hud: hudDe('375x667', 3) }).lanes.HF).toBe(1264);
  });
  // con cualquier combinación de medidas raras, la formación siempre cabe (si la medida no deja sitio, se descarta)
  for (const node of CONFIGS) {
    it(`B-3 · ${label(node)}: barrido de medidas absurdas o extremas, la formación siempre cabe`, () => {
      for (const bottom of [-10, 0, 600, 900, 1250, 1500, 2000]) {
        for (const top of [-5, 0, 300, 1500]) {
          for (const zoneBottom of [0, 661, 1700]) {
            for (const m of [1, 4]) {
              const f = computeFormation(squad(5), enemies(m), { node, boss: !!node && isBossNode(node), hud: { bottom, top, zoneBottom } });
              expect(formationFits(f), `${label(node)} m${m} ${bottom}/${top}/${zoneBottom}`).toBe(true);
            }
          }
        }
      }
    });
  }
  it('las vistas de la hoja (hoja_medidas.json) no cambian: mismos carriles y altos con su borde medido, factor 1', () => {
    const MED = JSON.parse(fs.readFileSync(path.join(HOJA, 'hoja_medidas.json'), 'utf8'));
    const ESC = {
      '1enemigo': [{ id: 'a1n3', act: 1, type: 'combat' }, 1], '3enemigos': [{ id: 'a1n7', act: 1, type: 'combat' }, 3],
      '4enemigos_veil': [{ id: 'a2n10', act: 2, type: 'boss', isBoss: true }, 4], jefe: [{ id: 'a1n9', act: 1, type: 'boss', isBoss: true }, 1],
    };
    const SQUAD = ['warrior', 'mage', 'ranger', 'paladin', 'rogue'];   // aria, lyra, elena, viktor, shadow
    let vistas = 0;
    for (const vp of [...VISTAS, ...BAJAS]) {
      for (const [key, [node, m]] of Object.entries(ESC)) {
        const v = MED[`${vp}_${key}`];
        const f = computeFormation(squad(5, SQUAD), enemies(m), { node, boss: !!node.isBoss, hud: v.crudo.hudMedido });
        expect(f.lanes, `${vp} ${key}`).toEqual(v.crudo.lanes);
        expect(f.factor, `${vp} ${key}`).toBe(1);
        for (const a of v.crudo.actores) {
          const b = [...f.heroes, ...f.enemies].find((x) => x.id === a.id);
          expect(b.h, `${vp} ${key} ${a.id}`).toBeCloseTo(a.dibujado.alto, 6);
          expect(b.cx, `${vp} ${key} ${a.id}`).toBeCloseTo(a.cx, 6);
        }
        vistas += 1;
      }
    }
    expect(vistas).toBe(20);
  });
  it('360×740 y 375×667: los héroes suben hasta quedar sobre los botones de esa pantalla', () => {
    for (const vp of BAJAS) {
      const f = computeFormation(squad(5), enemies(3), { node: NODES[0], hud: hudDe(vp, 3) });
      expect(f.lanes.HF).toBeLessThanOrEqual(HUD.porViewport[vp].B);
      expect(f.lanes.HF).toBeLessThan(form(NODES[0], 5, 3).lanes.HF);
    }
  });
  it('hudToWorld: rectángulos de pantalla → y del mundo (lienzo FIT y centrado en el escenario)', () => {
    // 360×740: escenario 360×740 (k = 740/1720), botones con «¡TAP!» desde y 566, barras hasta 138 (hud_medidas.json)
    const h = hudToWorld({ stage: { top: 0, width: 360, height: 740 }, buttonsTop: 566, barsBottom: 138 });
    expect(h.bottom).toBeCloseTo(566 / (740 / 1720), 6);
    expect(h.top).toBeCloseTo(138 / (740 / 1720), 6);
    expect(Math.abs(h.bottom - HUD.porViewport['360x740'].B)).toBeLessThan(1);
    // 1280×800: k por el alto, el lienzo arranca arriba del escenario
    const d = hudToWorld({ stage: { top: 0, width: 1248, height: 800 }, buttonsTop: 626 });
    expect(Math.abs(d.bottom - HUD.porViewport['1280x800'].B)).toBeLessThan(1);
    // escenario más alto que el lienzo (FIT por el ancho): se descuenta la franja de arriba
    const c = hudToWorld({ stage: { top: 10, width: 412, height: 900 }, buttonsTop: 700 });
    expect(c.bottom).toBeCloseTo((700 - (10 + (900 - 1720 * 0.5) / 2)) / 0.5, 6);
    // en el marco del panel: 360×800 → marco de 756 desde y 22; el lienzo arranca 2,27 px más abajo dentro del marco
    const m8 = hudToWorld({ stage: { top: 0, width: 360, height: 756 }, buttonsTop: 604 - 22, barsBottom: 123 - 22, viewH: 756 });
    const k8 = 360 / 824;
    const top8 = (756 - 1720 * k8) / 2;
    expect(m8.bottom).toBeCloseTo((582 - top8) / k8, 6);
    expect(Math.abs(m8.bottom - HUD.porViewport['360x800'].B)).toBeLessThan(1.5);   // botonesTopCss va redondeado al px
    expect(m8.zoneBottom).toBeCloseTo((0.34 * 756 + 35 - top8) / k8, 6);
    expect(hudToWorld({ stage: { top: 0, width: 0, height: 0 }, buttonsTop: 10 })).toBeNull();
    expect(hudToWorld()).toBeNull();
  });
});

// H-c (decisión del owner del 2026-11-09): marcos muy bajos. Bordes de un marco de 375 de ancho y `alto` px CSS, como los
// mide el panel: el lienzo en FIT dentro del marco, la pila de abajo (botones con «¡TAP!», nombres y «Avanzar») ocupa
// 174 px CSS y las barras terminan en 102 (1 enemigo) o 139 (2 o más) px CSS, como en 375×667 (hud_medidas.json).
const marcoBajo = (alto, m) => {
  const stage = { left: 0, top: 0, width: 375, height: alto };
  const h = hudToWorld({ stage, buttonsTop: alto - 174, barsBottom: m === 1 ? 102 : 139, viewH: alto });
  return { hud: h, bordes: { B: h.bottom, T1: hudToWorld({ stage, barsBottom: 102 }).top, TN: hudToWorld({ stage, barsBottom: 139 }).top } };
};
describe('H-c: en marcos muy bajos la formación se achica en proporción (factor < 1 solo cuando no entra)', () => {
  for (const alto of [657, 625, 611]) {
    for (const node of CONFIGS) {
      it(`marco de ${alto} px CSS · ${label(node)}: matriz R24 (n 1–5 × m 1–4 × 3 escuadras) con su separación, piso, cabezas bajo las barras y pies sobre los botones`, () => {
        for (const cls of Object.values(SQUADS)) {
          for (let n = 1; n <= 5; n++) {
            for (let m = 1; m <= 4; m++) {
              const { hud, bordes } = marcoBajo(alto, m);
              const opts = { node, boss: !!node && isBossNode(node) };
              const f = computeFormation(squad(n, cls), enemies(m), { ...opts, hud });
              checkFormation(f, node, n, m, bordes);
              expect(f.factor).toBeGreaterThanOrEqual(SHRINK_MIN);
              expect(f.factor).toBeLessThanOrEqual(1);
              // el mismo factor para héroes y enemigos: las proporciones de V1 se mantienen
              const base = computeFormation(squad(n, cls), enemies(m), opts);
              for (const b of [...f.heroes, ...f.enemies]) {
                const b0 = [...base.heroes, ...base.enemies].find((x) => x.id === b.id);
                expect(b.h / b0.h, `${alto} ${label(node)} n${n} m${m} ${b.id}`).toBeCloseTo(f.factor, 6);
              }
            }
          }
        }
      });
    }
  }
  it('el factor baja solo donde hace falta: con 657 el bruto de a1n3 entra entero; el jefe de la catedral a 611 se achica', () => {
    const jefe = NODES.find((x) => x.id === 'a1n9');
    const f = (alto, m, node = jefe) => computeFormation(squad(5), enemies(m), { node, boss: true, hud: marcoBajo(alto, m).hud });
    expect(f(611, 1).factor).toBeLessThan(1);
    expect(f(611, 1).factor).toBeLessThanOrEqual(f(657, 1).factor);
    expect(computeFormation(squad(5), enemies(1), { node: NODES[0], hud: marcoBajo(657, 1).hud }).factor).toBe(1);   // a1n3: entra
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

describe('B3: tendidos (V6) — largo ×0,9, todos hacia el mismo lado, solape ≤ 10 % dentro de la fila', () => {
  // un `it` por configuración: 1–5 héroes × 1–4 enemigos × las tres escuadras
  for (const node of CONFIGS) {
    it(`${label(node)}: 1–5 héroes × 1–4 enemigos × las tres escuadras`, () => {
      for (const cls of Object.values(SQUADS)) {
        for (let n = 1; n <= 5; n++) {
          for (let m = 1; m <= 4; m++) {
            const f = form(node, n, m, cls);
            const rows = {};
            const lyings = lyingBoxes(f);
            for (const b of [...f.heroes, ...f.enemies]) {
              const L = lyings[b.id];
              expect(L.w).toBeCloseTo(lyingBox(b).w, 10);                   // conserva el largo ×0,9
              (rows[b.row] = rows[b.row] || []).push(L);
            }
            for (const list of Object.values(rows)) {
              expect(new Set(list.map((L) => L.dir)).size).toBe(1);          // todos hacia el mismo lado
              for (const L of list) {
                expect(L.x).toBeGreaterThanOrEqual(0);
                expect(L.x + L.w).toBeLessThanOrEqual(WORLD.w);
              }
              for (let i = 0; i < list.length; i++) {
                for (let j = i + 1; j < list.length; j++) {
                  const [a, b] = [list[i], list[j]];
                  const ov = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
                  expect(ov / Math.min(a.w, b.w), `${label(node)} ${a.id}×${b.id}`).toBeLessThanOrEqual(0.1);
                  // sin cabeza sobre cabeza: la cabeza de uno no cae dentro del otro cuerpo
                  expect(a.head > b.x && a.head < b.x + b.w, `${a.id} cabeza sobre ${b.id}`).toBe(false);
                  expect(b.head > a.x && b.head < a.x + a.w, `${b.id} cabeza sobre ${a.id}`).toBe(false);
                }
              }
            }
          }
        }
      }
    });
  }
});

describe('B4: los pies de cada fila de enemigos caen sobre piso real (obstáculos del fondo por columnas)', () => {
  it('crypt: el altar (x > 71 %) y el carro (x < 16,5 %) están calibrados con su piso real', () => {
    expect(BG_FLOOR_OBSTACLES.crypt.map((o) => [o.x0, o.x1, o.floor])).toEqual([[0, 0.165, 0.6], [0.71, 1, 0.585]]);
    for (const o of BG_FLOOR_OBSTACLES.crypt) expect(bgImageRowToWorldY(o.floor)).toBeGreaterThan(CALIB.crypt.groundY);
  });
  // un `it` por configuración: 1, 2, 3 y 4 enemigos × 1–5 héroes × las tres escuadras
  let revisados = 0;
  for (const node of CONFIGS) {
    it(`${label(node)}: con 1–4 enemigos y las tres escuadras, ningún pie pisa un obstáculo por encima de su piso`, () => {
      const obs = BG_FLOOR_OBSTACLES[bgArt(node)] || [];
      for (const cls of Object.values(SQUADS)) {
        for (let n = 1; n <= 5; n++) {
          for (let m = 1; m <= 4; m++) {
            for (const e of form(node, n, m, cls).enemies) {
              // los pies son las columnas con alfa del 6 % inferior de la silueta (hoja_alfa.json), centrados en la caja
              const g = spriteGeom('enemy', e.art, 'idle');
              const s = e.h / g.H;
              expect(e.feet.x0).toBeCloseTo(e.cx + (g.pl - g.W / 2) * s, 6);
              expect(e.feet.x1).toBeCloseTo(e.cx + (g.pr + 1 - g.W / 2) * s, 6);
              for (const o of obs) {
                const x0 = bgImageColToWorldX(o.x0).min;
                const x1 = bgImageColToWorldX(o.x1).max;
                const encima = e.feet.x1 > x0 && e.feet.x0 < x1;
                if (encima) expect(e.lane, `${label(node)} n${n} m${m} ${e.id} sobre «${o.que}»`).toBeGreaterThanOrEqual(bgImageRowToWorldY(o.floor));
                revisados += 1;
              }
            }
          }
        }
      }
    });
  }
  it('la revisión de obstáculos no quedó vacía (crypt los tiene)', () => {
    expect(revisados).toBeGreaterThan(0);
  });
  it('crypt con 2, 3 y 4 enemigos: el de la derecha ya no pisa el altar y todos quedan sobre la calle', () => {
    const crypt = NODES.find((x) => x.id === 'a1n7');
    const altar = bgImageColToWorldX(0.71).min;
    const carro = bgImageColToWorldX(0.165).max;
    for (const m of [2, 3, 4]) {
      const f = form(crypt, 5, m);
      for (const e of f.enemies) {
        expect(e.feet.x1, `m${m} ${e.id}`).toBeLessThanOrEqual(altar);
        expect(e.feet.x0, `m${m} ${e.id}`).toBeGreaterThanOrEqual(carro);
        expect(e.lane).toBeGreaterThanOrEqual(CALIB.crypt.groundY);
      }
    }
  });
});

describe('H1: los datos de geometría están atados a sus mediciones', () => {
  const ALFA = JSON.parse(fs.readFileSync(path.join(HOJA, 'hoja_alfa.json'), 'utf8'));
  it('SPRITE_GEOM (l, r, t, b y pies) = hoja_alfa.json, medido sobre los webp', () => {
    for (const key of Object.keys(SPRITE_GEOM)) {
      const [kind, art, pose] = key.split(':');
      const m = ALFA[`${kind === 'hero' ? 'heroes' : 'enemies'}/${art}_${pose}`];
      const g = spriteGeom(kind, art, pose);
      expect([g.W, g.H, g.l, g.r, g.t, g.b, g.pl, g.pr], key).toEqual([m.W, m.H, m.l, m.r, m.t, m.b, m.pl, m.pr]);
    }
  });
  it('ATTACK_FX: el cuadro del tirador termina en la boca del arma y su envolvente = hoja_alfa.json (`casco`)', () => {
    for (const [art, fx] of Object.entries(ATTACK_FX)) {
      const m = ALFA[`heroes/${art}_attack`];
      expect(fx.crop, art).toEqual([0, 0, fx.muzzle[0], m.H]);
      expect(fx.hull, art).toEqual(m.casco);
      // la envolvente cabe en el cuadro y llega a la boca del arma
      for (const [u, v] of fx.hull) {
        expect(u).toBeGreaterThanOrEqual(0);
        expect(u).toBeLessThanOrEqual(fx.crop[2]);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(m.H);
      }
      expect(Math.max(...fx.hull.map(([u]) => u))).toBe(fx.muzzle[0]);
    }
  });
});
