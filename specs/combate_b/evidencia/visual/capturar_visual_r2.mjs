// Captura de la revisión visual ronda 2 (T10.6) (visual-reviewer): fotogramas de acción en combate real a1n3 (v2) y
// escena sintética con un héroe muerto. Uso: node capturar_visual_r2.mjs (server :3001 + vite :5173, db sembrada).
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const NM = process.env.KH_NODE_MODULES || 'D:/Proyectos/kingdoms-harvest/node_modules';
const req = createRequire(path.join(NM, 'x.js'));
const { chromium } = req('playwright');
const sharp = req('sharp');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'run2'); fs.mkdirSync(OUT, { recursive: true });
const URL_ = 'http://localhost:5173';
const shot = async (page, name) => { const b = await page.screenshot({ type: 'png' }); await sharp(b).webp({ quality: 85 }).toFile(path.join(OUT, name + '.webp')); };
const browser = await chromium.launch({ headless: true, args: ['--ignore-gpu-blocklist', '--use-angle=d3d11'] });
async function nueva(w, h, dpr, quality = 'medium') {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, isMobile: true, hasTouch: true });
  await ctx.addInitScript(({ q }) => { localStorage.setItem('kh_device_id', 'captura-combate-b-0001'); localStorage.setItem('kh_combat_quality', q); localStorage.setItem('kh_tutorial_done', '1'); localStorage.setItem('kh_ambient_fx', 'false'); }, { q: quality });
  const page = await ctx.newPage();
  await page.goto(URL_, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__gameStore, null, { timeout: 30000 });
  await page.evaluate(() => window.__gameStore.getState().enterGame());
  await page.waitForFunction(() => window.__phaserGame && window.__phaserGame.scene.isActive('HubSceneB'), null, { timeout: 60000 });
  await page.waitForTimeout(2500);
  await page.evaluate(() => { const s = window.__gameStore.getState(); s.dismissOfflineReport && s.dismissOfflineReport(); });
  return { ctx, page };
}
const modo = process.argv[2] || 'real';
if (modo === 'real') {
  const { ctx, page } = await nueva(412, 860, 2);
  await page.evaluate(() => window.__gameStore.getState().loadCampaignMap());
  const r = await page.evaluate(async () => { const s = window.__gameStore.getState(); const r = await s.enterNode('a1n3'); if (r.kind === 'combat') s.setOverlay('combat_instance', {}); return r.kind; });
  console.log('entrada', r);
  await page.waitForTimeout(2500);
  let ultima = -1, t = 0, n = 0;
  const t0 = Date.now();
  while (Date.now() - t0 < 60000 && n < 14) {
    await shot(page, `real_f${String(n).padStart(2, '0')}`); n++;
    await page.waitForTimeout(700);
    const done = await page.evaluate(() => /¡Victoria!|Derrota/.test(document.body.innerText));
    if (done) { await shot(page, 'real_fin'); break; }
  }
  await ctx.close();
} else {
  const [w, h, dpr] = (process.argv[3] || '412x860x2').split('x').map(Number);
  const { ctx, page } = await nueva(w, h, dpr);
  await page.evaluate(() => {
    const mk = (i, nm, hp) => ({ id: `e${i}`, name: nm, hp, maxHp: 900, dps: 40, def: 0, spd: 0 });
    const hero = (slot, cls, name, alive) => ({ slot, heroId: null, class: cls, name, atk: 60, hp: alive ? 200 : 0, maxHp: 200, energy: 100, energyMax: 100, alive, def: 0, spd: 0 });
    const enemies = [mk(0, 'Bruto', 600), mk(1, 'Acólito', 0)];
    window.__gameStore.setState({ activeRun: { runId: -1, node: { id: 'a1n3', name: 'Merodeadores del Páramo', type: 'combat' },
      state: { engine: 2, round: 3, maxRounds: 8, isBoss: false, shield: 0, log: [], events: [], enemies, enemy: enemies[0], heroes: [hero(1, 'warrior', 'Guarnición', true), hero(2, 'mage', 'Hé2', false), hero(3, 'ranger', 'Hé3', true)] } } });
    window.__gameStore.getState().setOverlay('combat_instance', {});
  });
  await page.waitForTimeout(3500);
  await shot(page, `muerto_${w}x${h}`);
  await ctx.close();
}
await browser.close();
