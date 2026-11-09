import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { computeFormation, lyingBoxes, hudToWorld, BANNER_ZONE } from '../game/combat/formation';
import { placeResultBanner, silhouettesCss, worldToCss, BANNER_CENTER, BANNER_MAX_H } from '../game/combat/resultLayout';

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
const BANNER_H = 64;   // compacto: 8 + 44 («Volver») + 8 + 2 × 2 de borde
// eslint-disable-next-line no-undef
const { CAMPAIGN } = require('../../../shared/gameConfig.js');
const NODES = CAMPAIGN.filter((n) => ['combat', 'wave', 'boss'].includes(n.type));

function escena(vp, node, m) {
  const [vw, vh] = VP[vp];
  const med = HUD.porViewport[vp][m === 1 ? 1 : 4];
  const c = med.lienzo;
  const stage = { left: c.x, top: c.y, width: c.w, height: c.h };   // el lienzo mismo: FIT exacto
  const map = worldToCss(stage);
  // lo que mide el panel en esa pantalla: bordes del HUD y franja del cartel (H2, B1)
  const hud = {
    bottom: HUD.resumen.porViewport[vp].B, top: m === 1 ? HUD.resumen.porViewport[vp].T1 : HUD.resumen.porViewport[vp].TN,
    zoneBottom: hudToWorld({ stage, viewH: vh }).zoneBottom,
  };
  const enemies = Array.from({ length: m }, (_, i) => ({ id: `e${i}` }));
  const f = computeFormation(heroes, enemies, { node, boss: !!node.isBoss, hud });
  const w = Math.min(360, vw - 48);
  const banner = { x0: (vw - w) / 2, x1: (vw + w) / 2, h: BANNER_H };
  const avoid = [
    { x: 0, y: med.botonesTopCss, w: vw, h: med.avanzarTopCss - med.botonesTopCss },   // fila de botones de héroe
    { x: 0, y: 0, w: vw, h: med.barrasBottomCss },                                      // título y barras
  ];
  return { vw, vh, map, f, banner, avoid };
}

const inter = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

describe('Cartel de resultado: posición en las 4 formaciones × 5 pantallas', () => {
  it('el cartel compacto mide ≤ 70 px CSS', () => {
    expect(BANNER_H).toBeLessThanOrEqual(BANNER_MAX_H);
    expect(BANNER_CENTER).toBe(0.34);
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
        const r = { x: banner.x0, y: p.cy - banner.h / 2, w: banner.x1 - banner.x0, h: banner.h };
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
        const r = { x: banner.x0, y: p.cy - banner.h / 2, w: banner.x1 - banner.x0, h: banner.h };
        for (const s of sil.filter((x) => x.side === 'h')) expect(inter(r, s.rect), `${vp} ${name}: cartel sobre ${s.id}`).toBe(0);
        for (const a of avoid) expect(inter(r, a)).toBe(0);
        expect(p.faceCut, `${vp} ${name}: corta caras`).toBe(0);
      });
    }
  }
  it('victoria en los 13 nodos reales × 1–4 enemigos × 5 pantallas: siempre hay sitio sin tocar ninguna silueta', () => {
    for (const vp of Object.keys(VP)) {
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
    }
  });
  it('si no hay sitio libre en el tercio medio, avisa (ok = false) y elige el que menos tapa', () => {
    const sil = [{ id: 'x', side: 'h', alive: true, rect: { x: 0, y: 0, w: 400, h: 1000 }, face: null }];
    const p = placeResultBanner({ outcome: 'victory', sil, viewH: 900, banner: { x0: 20, x1: 380, h: 60 } });
    expect(p.ok).toBe(false);
    expect(p.cy).toBeGreaterThanOrEqual(300);
  });
});
