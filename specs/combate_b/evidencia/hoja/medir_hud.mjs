// T10.6 — Límites REALES del HUD en coordenadas del mundo 824×1720, por viewport y por nº de enemigos:
//   T = borde inferior del bloque de barras de vida (ninguna cabeza puede quedar por encima: V3)
//   B = borde superior de la fila de botones de héroe, incluida la etiqueta «¡TAP!» (ningún pie por debajo: V3)
// Estado sintético (5 héroes con energía llena, como en las capturas de la hoja) sobre el combate real del cliente.
// Uso: KH_PREVIEW_URL=http://localhost:5175 node medir_hud.mjs  → hud_medidas.json
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const NM = process.env.KH_NODE_MODULES || 'D:/Proyectos/kingdoms-harvest/node_modules';
const req = createRequire(path.join(NM, 'x.js'));
const { chromium } = req('playwright');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const URL_ = process.env.KH_PREVIEW_URL || 'http://localhost:5175';
const VPS = [
  { w: 412, h: 860, dpr: 2, name: '412x860' },
  { w: 360, h: 800, dpr: 3, name: '360x800' },
  { w: 1280, h: 800, dpr: 1.5, name: '1280x800' },
];

async function abrir(browser, vp) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: vp.dpr, isMobile: vp.w < 800, hasTouch: true });
  await ctx.addInitScript(() => {
    localStorage.setItem('kh_device_id', 'captura-combate-b-0001');
    localStorage.setItem('kh_combat_quality', 'medium');
    localStorage.setItem('kh_tutorial_done', '1');
    localStorage.setItem('kh_ambient_fx', 'false');
  });
  const page = await ctx.newPage();
  await page.goto(URL_, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__gameStore, null, { timeout: 30000 });
  await page.evaluate(() => window.__gameStore.getState().enterGame());
  await page.waitForFunction(() => window.__phaserGame && window.__phaserGame.scene.isActive('HubSceneB'), null, { timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => { const s = window.__gameStore.getState(); s.dismissOfflineReport && s.dismissOfflineReport(); });
  return { ctx, page };
}

const out = {};
const browser = await chromium.launch({ headless: true, args: ['--ignore-gpu-blocklist', '--use-angle=d3d11'] });
try {
  for (const vp of VPS) {
    const { ctx, page } = await abrir(browser, vp);
    out[vp.name] = {};
    for (const m of [1, 2, 3, 4]) {
      await page.evaluate(() => { const s = window.__gameStore.getState(); s.clearActiveRun && s.clearActiveRun(); s.clearOverlay && s.clearOverlay(); });
      await page.waitForTimeout(300);
      await page.evaluate((m) => {
        const hero = (slot, cls, name) => ({ slot, heroId: null, class: cls, name, atk: 60, hp: 200, maxHp: 200, energy: 100, energyMax: 100, alive: true, def: 0, spd: 0 });
        const enemies = Array.from({ length: m }, (_, i) => ({ id: `e${i}`, name: `E${i}`, hp: 600, maxHp: 900, dps: 40, def: 0, spd: 0 }));
        window.__gameStore.setState({
          activeRun: {
            runId: -1,
            node: { id: 'a1n3', name: 'Merodeadores del Páramo', type: 'combat', act: 1 },
            state: { engine: 2, round: 1, maxRounds: 10, shield: 0, log: [], events: [], enemies, enemy: enemies[0],
              heroes: [hero(1, 'warrior', 'Guarnición'), hero(2, 'mage', 'Lyra'), hero(3, 'ranger', 'Finn'), hero(4, 'paladin', 'Viktor'), hero(5, 'rogue', 'Shadow')] },
          },
        });
        window.__gameStore.getState().setOverlay('combat_instance', {});
      }, m);
      await page.waitForTimeout(1500);
      out[vp.name][m] = await page.evaluate(() => {
        const bars = document.querySelector('[data-enemy-bars]');
        const panel = bars && bars.closest('.fixed');
        const cv = panel && panel.querySelector('canvas');
        if (!cv) return { error: 'sin lienzo' };
        const cr = cv.getBoundingClientRect();
        const k = cr.width / 824;
        const toW = (y) => +((y - cr.top) / k).toFixed(1);
        const heroBtns = [...panel.querySelectorAll('button')].filter((b) => b.getBoundingClientRect().width > 0 && !b.classList.contains('kh-close') && !/Avanzar/.test(b.innerText));
        const heroTop = Math.min(...heroBtns.flatMap((b) => [b, ...b.querySelectorAll('*')]).map((e) => e.getBoundingClientRect().top));
        const adv = [...panel.querySelectorAll('button')].find((b) => /Avanzar/.test(b.innerText));
        return {
          lienzo: { x: Math.round(cr.left), y: Math.round(cr.top), w: Math.round(cr.width), h: Math.round(cr.height), escala: +k.toFixed(4) },
          barrasBottomCss: Math.round(bars.getBoundingClientRect().bottom),
          botonesTopCss: Math.round(heroTop),
          avanzarTopCss: adv ? Math.round(adv.getBoundingClientRect().top) : null,
          T: toW(bars.getBoundingClientRect().bottom),
          B: toW(heroTop),
          nBotonesHeroe: heroBtns.length,
        };
      });
      console.log(vp.name, `m=${m}`, JSON.stringify(out[vp.name][m]));
    }
    await ctx.close();
  }
} finally {
  await browser.close();
}
const resumen = {
  Tmax_1enemigo: Math.max(...Object.values(out).map((v) => v[1].T)),
  Tmax_2omas: Math.max(...Object.values(out).flatMap((v) => [v[2].T, v[3].T, v[4].T])),
  Bmin: Math.min(...Object.values(out).flatMap((v) => [1, 2, 3, 4].map((m) => v[m].B))),
};
fs.writeFileSync(path.join(HERE, 'hud_medidas.json'), JSON.stringify({ resumen, porViewport: out }, null, 1));
console.log('resumen', JSON.stringify(resumen));
