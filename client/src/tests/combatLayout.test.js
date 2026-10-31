import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  computeFormation, enemyList, ENEMY_HEIGHT_FRAC, WORLD, HUD_TOP,
} from '../game/combat/formation';
import {
  heroArt, enemyArt, bgArt, collectAssetKeys, textureUrl, FALLBACK, HERO_ART, ENEMY_ART, BG_ART,
} from '../game/combat/artMap';

// shared/ es CommonJS fuera de la raíz de Vite: se lee solo en el test.
// eslint-disable-next-line no-undef
const { HEROES, CAMPAIGN } = require('../../../shared/gameConfig.js');

const hero = (slot, extra = {}) => ({ slot, heroId: `x${slot}`, class: 'warrior', ...extra });
const heroes = (n) => Array.from({ length: n }, (_, i) => hero(i + 1));
const enemies = (m) => Array.from({ length: m }, (_, i) => ({ id: `e${i}`, hp: 100 }));
const inter = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe('R24/R25: formación', () => {
  for (let n = 1; n <= 5; n++) {
    for (let m = 1; m <= 4; m++) {
      it(`${n} héroes × ${m} enemigos: sin solapes y dentro de 824×1720`, () => {
        const f = computeFormation(heroes(n), enemies(m));
        const all = [...f.heroes, ...f.enemies];
        expect(f.heroes).toHaveLength(n);
        expect(f.enemies).toHaveLength(m);
        for (const b of all) {
          expect(b.x).toBeGreaterThanOrEqual(0);
          expect(b.y).toBeGreaterThanOrEqual(0);
          expect(b.x + b.w).toBeLessThanOrEqual(WORLD.w);
          expect(b.y + b.h).toBeLessThanOrEqual(WORLD.h);
        }
        for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) expect(inter(all[i], all[j]), `${all[i].id}×${all[j].id}`).toBe(false);
        for (const b of f.heroes) expect(b.y + b.h).toBeLessThanOrEqual(HUD_TOP);
      });
    }
  }
  it('slots 1–3 al frente y 4–5 atrás; ids h<slot>', () => {
    const f = computeFormation(heroes(5), enemies(1));
    expect(f.heroes.map((b) => [b.id, b.row])).toEqual([['h1', 'front'], ['h2', 'front'], ['h3', 'front'], ['h4', 'back'], ['h5', 'back']]);
    expect(f.heroes[3].y).toBeLessThan(f.heroes[0].y);
  });
  it('heroId:null (Guarnición) → arte warrior', () => {
    const f = computeFormation([{ slot: 1, heroId: null, class: 'warrior' }], enemies(1));
    expect(f.heroes[0].art).toBe('warrior');
    expect(heroArt(null, 'warrior')).toBe('warrior');
    expect(heroArt({ heroId: null })).toBe('warrior');
  });
  it('R25: estado v1 (solo enemy) → 1 enemigo con id e0; state.enemies de 4 → 4', () => {
    expect(enemyList({ enemy: { hp: 10 } })).toEqual([{ hp: 10, id: 'e0' }]);
    expect(enemyList({ enemies: [{ id: 'e0' }], enemy: { hp: 1 } })).toHaveLength(1);
    const four = enemyList({ enemies: enemies(4) });
    expect(four).toHaveLength(4);
    expect(computeFormation(heroes(3), four).enemies).toHaveLength(4);
    expect(enemyList({})).toEqual([]);
    expect(computeFormation([], []).enemies).toEqual([]);
    expect(computeFormation(undefined, undefined).heroes).toEqual([]);
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
  it('paladin y rogue (sin arte aún) → warrior; las demás clases, su propia clave', () => {
    expect(heroArt('viktor', 'paladin')).toBe('warrior');
    expect(heroArt('shadow', 'rogue')).toBe('warrior');
    expect(heroArt('lyra', 'mage')).toBe('mage');
    expect(heroArt('finn', 'ranger')).toBe('ranger');
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
