import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { computeFormation, lyingBoxes, hudToWorld, BANNER_ZONE, BREATH } from '../game/combat/formation';
import { placeResultBanner, silhouettesCss, worldToCss, BANNER_CENTER, BANNER_MAX_H } from '../game/combat/resultLayout';
import { MAX_ASPECT } from '../utils/viewport';

// Cartel de resultado (V8 + B1/B2 de la revisión visual ronda 2, decisión del owner del 2026-11-09), con la geometría
// real de cada pantalla medida en hud_medidas.json (lienzo, botones y barras) y las 4 formaciones de la hoja.
const HOJA = path.resolve(__dirname, '..', '..', '..', 'specs', 'combate_b', 'evidencia', 'hoja');
const HUD = JSON.parse(fs.readFileSync(path.join(HOJA, 'hud_medidas.json'), 'utf8'));
const VP = { '412x860': [412, 860], '360x800': [360, 800], '1280x800': [1280, 800], '360x740': [360, 740], '375x667': [375, 667] };
const CLASSES = ['warrior', 'mage', 'ranger', 'paladin', 'rogue'];
const heroes = CLASSES.map((c, i) => ({ slot: i + 1, heroId: `x${i}`, class: c }));
const FORMS = [
  ['1 bruto', { id: 'a1n3', type: 'combat', act: 1 }, 1],
  ['3 carroñeros', { id: 'a1n7', type: 'combat', act: 1 }, 3],
  ['4 Voz del Velo', { id: 'a2n10', type: 'boss', act: 2, isBoss: true }, 4],
  ['jefe', { id: 'a1n9', type: 'boss', act: 1, isBoss: true }, 1],
];
// Alto real del cartel compacto (su caja de maquetación) y su sombra dura de 4 px: hoja_medidas.json da 68 en las 40
// vistas de victoria y derrota (el test de abajo lo verifica contra la medida).
const BANNER_H = 68;
const SHADOW = 4;
const MEDIDAS = JSON.parse(fs.readFileSync(path.join(HOJA, 'hoja_medidas.json'), 'utf8'));
// eslint-disable-next-line no-undef
const { CAMPAIGN } = require('../../../shared/gameConfig.js');
const NODES = CAMPAIGN.filter((n) => ['combat', 'wave', 'boss'].includes(n.type));

// Todo en el MARCO del panel, como lo mide el panel: con el tope de aspecto (espejo de --kh-frame-h, alto ≤ 2,1 ×
// ancho, centrado) 360×800 da un marco de 756 desde y 22; el escenario llena el marco y el lienzo va en FIT dentro.
function escena(vp, node, m) {
  const [vw, vh] = VP[vp];
  const fh = Math.min(vh, vw * MAX_ASPECT);
  const ft = (vh - fh) / 2;
  const med = HUD.porViewport[vp][m === 1 ? 1 : 4];
  const stage = { left: 0, top: 0, width: vw, height: fh };
  const map = worldToCss(stage);
  // lo que mide el panel en esa pantalla: bordes del HUD y franja del cartel (H2, B1)
  const hud = {
    bottom: HUD.resumen.porViewport[vp].B, top: m === 1 ? HUD.resumen.porViewport[vp].T1 : HUD.resumen.porViewport[vp].TN,
    zoneBottom: hudToWorld({ stage, viewH: fh }).zoneBottom,
  };
  const enemies = Array.from({ length: m }, (_, i) => ({ id: `e${i}` }));
  const f = computeFormation(heroes, enemies, { node, boss: !!node.isBoss, hud });
  const w = Math.min(408, vw) - 48;                                  // maxWidth 408 con px-6
  const banner = { x0: (vw - w) / 2, x1: (vw + w) / 2, h: BANNER_H, shadow: SHADOW };
  const avoid = [
    { x: 0, y: med.botonesTopCss - ft, w: vw, h: med.avanzarTopCss - med.botonesTopCss },   // fila de botones de héroe
    { x: 0, y: 0, w: vw, h: med.barrasBottomCss - ft },                                      // título y barras
  ];
  return { vw, vh: fh, ft, map, f, banner, avoid };
}

const inter = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

describe('Cartel de resultado: posición en las 4 formaciones × 5 pantallas', () => {
  it('el cartel compacto mide ≤ 70 px CSS (medido en las vistas de la hoja)', () => {
    expect(BANNER_H).toBeLessThanOrEqual(BANNER_MAX_H);
    expect(BANNER_CENTER).toBe(0.34);
    const altos = Object.values(MEDIDAS).filter((v) => v && v.crudo && v.crudo.cartel).map((v) => v.crudo.cartel.alto);
    expect(altos.length).toBeGreaterThanOrEqual(40);
    for (const a of altos) expect(a).toBeLessThanOrEqual(BANNER_H);
  });
  for (const vp of Object.keys(VP)) {
    for (const [name, node, m] of FORMS) {
      it(`${vp} · ${name} · victoria: en el tercio medio, cerca del 34 %, sin tocar ninguna silueta (ni caídos) ni el HUD`, () => {
        const { vh, map, f, banner, avoid } = escena(vp, node, m);
        const alive = Object.fromEntries([...f.heroes.map((b) => [b.id, true]), ...f.enemies.map((b) => [b.id, false])]);
        const sil = silhouettesCss(f, alive, map);
        const p = placeResultBanner({ outcome: 'victory', sil, avoid, viewH: vh, banner });
        expect(p.ok).toBe(true);
        expect(p.cy).toBeGreaterThanOrEqual(vh / 3);
        expect(p.cy).toBeLessThanOrEqual((2 * vh) / 3);
        expect(Math.abs(p.cy / vh - 0.34), `centro al ${((100 * p.cy) / vh).toFixed(1)} %`).toBeLessThanOrEqual(0.02);
        const r = { x: banner.x0, y: p.cy - banner.h / 2, w: banner.x1 - banner.x0, h: banner.h + SHADOW };
        for (const s of sil) expect(inter(r, s.rect), `${vp} ${name}: cartel sobre ${s.id}`).toBe(0);
        for (const a of avoid) expect(inter(r, a)).toBe(0);
        // los caídos se miden tendidos (lyingBoxes)
        const L = lyingBoxes(f);
        for (const e of f.enemies) expect(sil.find((s) => s.id === e.id).rect.y).toBeCloseTo(map.y0 + L[e.id].y * map.k, 6);
      });
      it(`${vp} · ${name} · derrota: no tapa a los héroes tendidos ni el HUD y no corta caras de enemigos`, () => {
        const { vh, map, f, banner, avoid } = escena(vp, node, m);
        const alive = Object.fromEntries([...f.heroes.map((b) => [b.id, false]), ...f.enemies.map((b) => [b.id, true])]);
        const sil = silhouettesCss(f, alive, map);
        const p = placeResultBanner({ outcome: 'defeat', sil, avoid, viewH: vh, banner });
        expect(p.ok).toBe(true);
        expect(p.cy).toBeGreaterThanOrEqual(vh / 3);
        expect(p.cy).toBeLessThanOrEqual((2 * vh) / 3);
        const r = { x: banner.x0, y: p.cy - banner.h / 2, w: banner.x1 - banner.x0, h: banner.h + SHADOW };
        for (const s of sil.filter((x) => x.side === 'h')) expect(inter(r, s.rect), `${vp} ${name}: cartel sobre ${s.id}`).toBe(0);
        for (const a of avoid) expect(inter(r, a)).toBe(0);
        expect(p.faceCut, `${vp} ${name}: corta caras`).toBe(0);
        // H-b (review ronda 3): la cara se mide por su cuenta, no con el `faceCut` de la función bajo prueba: 35 % superior
        // de la caja alfa de cada enemigo de pie, con lo que crece al respirar (escala y hasta BREATH.y desde el pie)
        for (const e of f.enemies) {
          const grow = (BREATH.y - 1) * e.alpha.h;
          const cara = { x: e.alpha.x, y: e.alpha.y - grow, w: e.alpha.w, h: 0.35 * e.alpha.h + grow };
          const css = { x: map.x0 + cara.x * map.k, y: map.y0 + cara.y * map.k, w: cara.w * map.k, h: cara.h * map.k };
          expect(inter(r, css), `${vp} ${name}: cartel sobre la cara de ${e.id}`).toBe(0);
        }
      });
    }
  }
  // un `it` por pantalla: 13 nodos reales × 1–4 enemigos
  for (const vp of Object.keys(VP)) {
    it(`${vp} · victoria y derrota en los 13 nodos reales × 1–4 enemigos: siempre hay sitio sin tocar lo prohibido`, () => {
      for (const node of NODES) {
        for (let m = 1; m <= 4; m++) {
          const { vh, map, f, banner, avoid } = escena(vp, node, m);
          const alive = Object.fromEntries([...f.heroes.map((b) => [b.id, true]), ...f.enemies.map((b) => [b.id, false])]);
          const p = placeResultBanner({ outcome: 'victory', sil: silhouettesCss(f, alive, map), avoid, viewH: vh, banner });
          expect(p.ok, `${vp} ${node.id} m${m}`).toBe(true);
          expect(Math.abs(p.cy / vh - BANNER_ZONE.center), `${vp} ${node.id} m${m}`).toBeLessThanOrEqual(0.02);
          const dr = placeResultBanner({
            outcome: 'defeat', avoid, viewH: vh, banner,
            sil: silhouettesCss(f, Object.fromEntries([...f.heroes.map((b) => [b.id, false]), ...f.enemies.map((b) => [b.id, true])]), map),
          });
          expect(dr.ok, `derrota ${vp} ${node.id} m${m}`).toBe(true);
        }
      }
    });
  }
  it('quien sigue de pie se mide con la envolvente de la respiración (caja y cara crecen hacia arriba 1,4 % del alto)', () => {
    const { map, f } = escena('412x860', FORMS[0][1], 1);
    const [e0] = f.enemies;
    const s = silhouettesCss(f, { e0: true }, map).find((x) => x.id === 'e0');
    const grow = 0.014 * e0.alpha.h;
    expect(s.rect.y).toBeCloseTo(map.y0 + (e0.alpha.y - grow) * map.k, 6);
    expect(s.rect.y + s.rect.h).toBeCloseTo(map.y0 + (e0.alpha.y + e0.alpha.h) * map.k, 6);   // el pie no se mueve
    expect(s.face.y).toBeCloseTo(s.rect.y, 6);
    expect(s.face.y + s.face.h).toBeCloseTo(map.y0 + (e0.alpha.y + 0.35 * e0.alpha.h) * map.k, 6);   // borde de abajo de la cara en reposo
  });
  it('si no hay sitio libre en el tercio medio, avisa (ok = false) y elige el que menos tapa', () => {
    const sil = [{ id: 'x', side: 'h', alive: true, rect: { x: 0, y: 0, w: 400, h: 1000 }, face: null }];
    const p = placeResultBanner({ outcome: 'victory', sil, viewH: 900, banner: { x0: 20, x1: 380, h: 60 } });
    expect(p.ok).toBe(false);
    expect(p.cy).toBeGreaterThanOrEqual(300);
  });
});
