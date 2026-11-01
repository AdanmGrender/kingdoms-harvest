// Medición geométrica T10.6 (visual ronda 2): solapes entre sprites (formación lógica 824×1720 → píxeles CSS del lienzo) y el HUD DOM.
// Uso: node medir_visual_r2.mjs  (server :3001 + vite :5173, db sembrada)
import { createRequire } from 'node:module';
const NM = process.env.KH_NODE_MODULES || 'D:/Proyectos/kingdoms-harvest/node_modules';
const req = createRequire(NM + '/x.js');
const { chromium } = req('playwright');
const browser = await chromium.launch({ headless: true, args: ['--ignore-gpu-blocklist', '--use-angle=d3d11'] });
const VPS = [[412, 860, 2], [360, 740, 3], [360, 800, 3], [412, 915, 2.625]];
const out = {};
for (const [w, h, dpr] of VPS) {
  console.error('vp', w, h); await new Promise((r) => setTimeout(r, 25000));
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => { localStorage.setItem('kh_device_id', 'captura-combate-b-0001'); localStorage.setItem('kh_combat_quality', 'medium'); localStorage.setItem('kh_tutorial_done', '1'); localStorage.setItem('kh_ambient_fx', 'false'); });
  const page = await ctx.newPage();
  await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__gameStore, null, { timeout: 30000 });
  await page.evaluate(() => window.__gameStore.getState().enterGame());
  await page.waitForFunction(() => window.__phaserGame && window.__phaserGame.scene.isActive('HubSceneB'), null, { timeout: 60000 });
  await page.waitForTimeout(2000);
  await page.evaluate(() => { const s = window.__gameStore.getState(); s.dismissOfflineReport && s.dismissOfflineReport(); });
  for (const n of [1, 2, 3, 4]) {
    await page.evaluate(() => { const s = window.__gameStore.getState(); s.clearActiveRun && s.clearActiveRun(); s.clearOverlay && s.clearOverlay(); });
    await page.waitForTimeout(500);
    await page.evaluate((n) => {
      const mk = (i) => ({ id: `e${i}`, name: ['Bruto', 'Acólito', 'Segador', 'Voz'][i], hp: 600, maxHp: 900, dps: 40, def: 0, spd: 0 });
      const hero = (slot, cls, name) => ({ slot, heroId: null, class: cls, name, atk: 60, hp: 200, maxHp: 200, energy: 100, energyMax: 100, alive: true, def: 0, spd: 0 });
      const enemies = Array.from({ length: n }, (_, i) => mk(i));
      window.__gameStore.setState({ activeRun: { runId: -1, node: { id: 'a1n3', name: 'Merodeadores', type: n === 4 ? 'boss' : 'combat' },
        state: { engine: 2, round: 0, maxRounds: 8, isBoss: n === 4, shield: 0, log: [], events: [], enemies, enemy: enemies[0], heroes: [hero(1, 'warrior', 'Guarnición'), hero(2, 'mage', 'Hé2'), hero(3, 'ranger', 'Hé3'), hero(4, 'warrior', 'Hé4'), hero(5, 'mage', 'Hé5')] } } });
      window.__gameStore.getState().setOverlay('combat_instance', {});
    }, n);
    await page.waitForTimeout(3000);
    out[`${w}x${h}_${n}enemigos`] = await page.evaluate(async () => {
      const { computeFormation } = await import('/src/game/combat/formation.js');
      const st = window.__gameStore.getState().activeRun.state;
      const node = window.__gameStore.getState().activeRun.node;
      const f = computeFormation(st.heroes, st.enemies, { boss: node.type === 'boss', node });
      const panel = document.querySelector('[data-enemy-bars]')?.closest('.fixed');
      const cv = panel && panel.querySelector('canvas');
      if (!f || !cv) return { error: 'sin formación/lienzo' };
      const cr = cv.getBoundingClientRect(); const k = cr.width / f.world.w;
      const px = (b) => ({ l: cr.left + b.x * k, t: cr.top + b.y * k, r: cr.left + (b.x + b.w) * k, b: cr.top + (b.y + b.h) * k });
      const R = (e) => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; };
      const ov = (a, b) => Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t));
      const bars = R(document.querySelector('[data-enemy-bars]'));
      const btns = [...panel.querySelectorAll('button')].filter((b) => { const r = b.getBoundingClientRect(); return r.width > 0 && !b.classList.contains('kh-close') && !/Avanzar/.test(b.innerText); }).map(R);
      const heroes = f.heroes.map(px); const enemies = f.enemies.map(px);
      const area = (a) => (a.r - a.l) * (a.b - a.t);
      const heroCover = heroes.map((hb) => Math.round(100 * btns.reduce((s, bt) => s + ov(hb, bt), 0) / area(hb)));
      const enCover = enemies.map((eb) => Math.round(100 * ov(eb, bars) / area(eb)));
      return { lienzo: { w: Math.round(cr.width), h: Math.round(cr.height), top: Math.round(cr.top) }, nHeroBtns: btns.length,
        pctHeroeTapadoPorBotones: heroCover, pctEnemigoTapadoPorBarras: enCover,
        barras: { t: Math.round(bars.t), b: Math.round(bars.b) }, enemigosTopMin: Math.round(Math.min(...enemies.map((e) => e.t))),
        botonesTopMin: btns.length ? Math.round(Math.min(...btns.map((b) => b.t))) : null, heroesBottomMax: Math.round(Math.max(...heroes.map((e) => e.b))),
        pieEnemigos: f.enemies.map((e) => Math.round(e.anchor.y)), pieHeroes: f.heroes.map((e) => Math.round(e.anchor.y)) };
    });
  }
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(out, null, 1));
