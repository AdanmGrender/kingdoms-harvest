// Captura y medición de un combate a1n3 completo (combate_b T11). Fuera de PANTALLAS_DEF de capturar.mjs.
// Uso (server :3001 + vite :5173 del worktree, db sembrada con sembrar_a1n3.cjs):
//   node specs/combate_b/evidencia/capturar_combate.mjs --engine v1|v2 [--url http://127.0.0.1:5173] [--quality medium|low] [--botones] [--veil]
// Salida en specs/combate_b/evidencia/despues/: <engine>_rNN.webp, reporte_<engine>.json, red_<engine>.json, fps_<engine>_<calidad>.json
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const NM = process.env.KH_NODE_MODULES || 'D:/Proyectos/kingdoms-harvest/node_modules';
const req = createRequire(path.join(NM, 'x.js'));
const { chromium } = req('playwright');
const sharp = req('sharp');

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const flag = (k) => process.argv.includes(`--${k}`);
const URL_ = arg('url', 'http://127.0.0.1:5173');
const ENGINE = arg('engine', 'v1');
const QUALITY = arg('quality', 'medium');
const DEVICE_ID = arg('device', 'captura-combate-b-0001');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, arg('out', 'despues'));
fs.mkdirSync(OUT, { recursive: true });

const MAIN = { w: 412, h: 860, dpr: 2 };
const BOTONES_VP = [{ w: 360, h: 740, dpr: 3 }, { w: 360, h: 800, dpr: 3 }, { w: 412, h: 915, dpr: 2.625 }];

const initScript = ({ deviceId, quality }) => {
  localStorage.setItem('kh_device_id', deviceId);
  localStorage.setItem('kh_combat_quality', quality);
  localStorage.setItem('kh_tutorial_done', '1');
  localStorage.setItem('kh_ambient_fx', 'false');
  let n = 0;
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => raf((t) => { n += 1; cb(t); });
  window.__fps = { on: false, samples: [] };
  setInterval(() => { if (window.__fps.on) window.__fps.samples.push(n * 2); n = 0; }, 500);
};

function medirPanel() {
  const vis = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity !== 0; };
  const box = (e) => { const r = e.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10, r: Math.round(r.right), b: Math.round(r.bottom) }; };
  const botones = [...document.querySelectorAll('button, [role=button], a[href], input, select, .kh-close')].filter(vis);
  const bajo44 = botones.map((e) => ({ txt: (e.innerText || e.getAttribute('aria-label') || '').trim().slice(0, 24), cls: String(e.className || '').slice(0, 40), ...box(e) }))
    .filter((b) => b.w < 44 || b.h < 44);
  const barras = document.querySelector('[data-enemy-bars]');
  const avanzar = [...document.querySelectorAll('button')].find((b) => /Avanzar ronda/.test(b.innerText));
  const bb = barras ? box(barras) : null;
  const inter = (a, b) => a && b && a.x < b.r && b.x < a.r && a.y < b.b && b.y < a.b;
  const panel = document.querySelector('[data-enemy-bars]')?.closest('.fixed');
  const heroBtns = [...(panel ? panel.querySelectorAll('button') : [])].filter((b) => vis(b) && b !== avanzar && !b.classList.contains('kh-close')).map(box);
  // Zona de héroes del lienzo del combate (formation.js: lienzo lógico 824×1720; fila trasera desde y=990, frontal 1180).
  const cv = panel ? [...panel.querySelectorAll('canvas')][0] : null;
  const cr = cv ? cv.getBoundingClientRect() : null;
  const k = cr ? cr.width / 824 : null;
  const zonaHeroes = cr ? { top: Math.round(cr.top + 990 * k), bottom: Math.round(cr.top + (1180 + 250) * k) } : null;
  const zonaEnemigos = cr ? { top: Math.round(cr.top + 100 * k), bottom: Math.round(cr.top + 960 * k) } : null;
  return {
    vw: innerWidth, vh: innerHeight, nBotones: botones.length, botonesBajo44: bajo44,
    barrasEnemigo: document.querySelectorAll('[data-enemy-bar]').length, cajaBarras: bb,
    cajaAvanzar: avanzar ? box(avanzar) : null,
    zonaHeroes, zonaEnemigos, lienzoCombate: cr ? { x: Math.round(cr.left), y: Math.round(cr.top), w: Math.round(cr.width), h: Math.round(cr.height) } : null,
    barrasTapanAvanzar: !!inter(bb, avanzar && box(avanzar)),
    barrasTapanBotonesHud: heroBtns.some((h) => inter(bb, h)),
    barrasTapanHeroesSprites: !!(bb && zonaHeroes && bb.b > zonaHeroes.top),
    barrasSolapanZonaEnemigos: !!(bb && zonaEnemigos && bb.b > zonaEnemigos.top),
    canvases: [...document.querySelectorAll('canvas')].map((c) => [c.width, c.height]),
  };
}

async function abrirHub(page) {
  await page.goto(URL_, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__gameStore, null, { timeout: 30000 });
  await page.evaluate(() => window.__gameStore.getState().enterGame());
  await page.waitForFunction(() => window.__phaserGame && window.__phaserGame.scene.isActive('HubSceneB'), null, { timeout: 60000 });
  await page.waitForTimeout(2500);
  await page.evaluate(() => { const s = window.__gameStore.getState(); s.dismissOfflineReport && s.dismissOfflineReport(); });
}

async function entrarA1n3(page) {
  await page.evaluate(() => window.__gameStore.getState().loadCampaignMap());
  for (let i = 0; i < 5; i++) { // el server limita 100 req/min por IP (429): reintentar
    const res = await page.evaluate(async () => {
      const s = window.__gameStore.getState();
      try {
        const r = await s.enterNode('a1n3');
        if (r.kind === 'combat') s.setOverlay('combat_instance', {});
        return { kind: r.kind, engine: r.state && r.state.engine, nEnemies: (r.state && (r.state.enemies || [r.state.enemy]).length) };
      } catch (e) { return { error: e && e.response ? e.response.status : String(e) }; }
    });
    if (!res.error) return res;
    await page.waitForTimeout(20000);
  }
  throw new Error('no se pudo entrar a a1n3');
}

async function nueva(browser, vp, bag) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: vp.dpr, isMobile: true, hasTouch: true });
  await ctx.addInitScript(initScript, { deviceId: DEVICE_ID, quality: QUALITY });
  const page = await ctx.newPage();
  if (bag) {
    page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) bag.errores.push(`${m.type()}: ${m.text().slice(0, 200)}`); });
    page.on('pageerror', (e) => bag.errores.push(`pageerror: ${String(e).slice(0, 200)}`));
    page.on('response', (r) => { if (r.status() >= 400) bag.errores.push(`http ${r.status()} ${r.request().method()} ${r.url().replace(/^https?:\/\/[^/]+/, '')}`); });
    page.on('request', (r) => { const u = r.url(); if (/\/assets\//.test(u)) bag.assets.push(u.replace(/^https?:\/\/[^/]+/, '')); });
  }
  return { ctx, page };
}

const webp = async (page, file) => {
  const png = await page.screenshot({ type: 'jpeg', quality: 90 });
  await sharp(png).webp({ quality: 80 }).toFile(path.join(OUT, file));
};

const stats = (xs) => {
  if (!xs.length) return { n: 0, avg: null, p5: null, min: null };
  const s = [...xs].sort((a, b) => a - b);
  return { n: xs.length, avg: Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10, p5: s[Math.floor(0.05 * (s.length - 1))], min: s[0] };
};

const browser = await chromium.launch({ headless: true, args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--use-angle=d3d11'] });
const bag = { errores: [], assets: [] };

// ── Combate completo ────────────────────────────────────────────────────────
const { ctx, page } = await nueva(browser, MAIN, bag);
await abrirHub(page);
const gpu = await page.evaluate(() => { const c = document.createElement('canvas'); const gl = c.getContext('webgl2') || c.getContext('webgl'); const e = gl && gl.getExtension('WEBGL_debug_renderer_info'); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'desconocido'; });
bag.assets.length = 0; // la red del combate empieza al abrirlo (R28)
const entrada = await entrarA1n3(page);
console.log('entrada', entrada);
const rondas = [];
let ultima = -1; let lastChange = Date.now();
const t0 = Date.now();
await page.waitForTimeout(1500);
await page.evaluate(() => { window.__fps.samples.length = 0; window.__fps.on = true; });
let medido = null;
let fin = null;
while (Date.now() - t0 < 150000) {
  const st = await page.evaluate(() => {
    const r = window.__gameStore.getState().activeRun;
    const t = document.body.innerText;
    return { round: r ? r.state.round : null, hp: r ? (r.state.enemies || [r.state.enemy]).map((e) => e.hp) : null, banner: /¡Victoria!/.test(t) ? 'victoria' : /Derrota/.test(t) ? 'derrota' : null };
  });
  if (st.banner) { fin = st.banner; break; }
  if (st.round !== ultima) {
    ultima = st.round; lastChange = Date.now();
    if (st.round === 0 && !medido) { medido = await page.evaluate(medirPanel); await webp(page, `${ENGINE}_r00_inicio.webp`); }
    else if (st.round > 0) {
      await page.waitForTimeout(600);
      const n = String(st.round).padStart(2, '0');
      await webp(page, `${ENGINE}_r${n}.webp`);
      rondas.push({ ronda: st.round, hpEnemigos: st.hp });
    }
  } else if (Date.now() - lastChange > 9000) {
    // el auto-avance no arrancó: avanzar a mano (se anota)
    await page.getByRole('button', { name: 'Avanzar ronda' }).click({ timeout: 2000 }).catch(() => {});
    lastChange = Date.now();
    rondas.push({ nota: 'avance manual' });
  }
  await page.waitForTimeout(80);
}
await page.evaluate(() => { window.__fps.on = false; });
await page.waitForTimeout(600);
if (fin) await webp(page, `${ENGINE}_resultado_${fin}.webp`);
const muestras = await page.evaluate(() => window.__fps.samples.slice());
const medidoFin = await page.evaluate(medirPanel);
const duracion = Math.round((Date.now() - t0) / 100) / 10;

fs.writeFileSync(path.join(OUT, `red_${ENGINE}.json`), JSON.stringify({
  nota: 'Peticiones a /assets/ desde que se abre el combate hasta el banner (la del hub previo se excluye).',
  total: bag.assets.length, bajoAssetsGame: bag.assets.filter((u) => u.startsWith('/assets/game/')).length,
  urls: [...new Set(bag.assets)].sort(),
}, null, 2));
fs.writeFileSync(path.join(OUT, `fps_${ENGINE}_${QUALITY}.json`), JSON.stringify({
  dispositivo: `escritorio · Chromium headless (Playwright) · viewport ${MAIN.w}x${MAIN.h} @${MAIN.dpr}x`, gpu, calidad: QUALITY, motor: ENGINE,
  metodo: 'frames de requestAnimationFrame por ventana de 500 ms (×2), solo durante el combate; Phaser avanza por rAF (equivale a game.loop.actualFps)',
  ...stats(muestras), cumple: { medioAvg50: null },
}, null, 2));
const reporte = {
  motor: ENGINE, calidad: QUALITY, viewport: MAIN, entrada, resultado: fin, duracionS: duracion, rondas,
  errores: [...new Set(bag.errores)], medidasInicio: medido, medidasFin: medidoFin,
};
if (flag('botones')) {
  reporte.erroresCombate = [...new Set(bag.errores)];
  reporte.botones = {};
  for (const vp of BOTONES_VP) {
    await new Promise((r) => setTimeout(r, 25000)); // enfriar el limitador de 100 req/min
    const o = await nueva(browser, vp, bag);
    await abrirHub(o.page);
    const e = await entrarA1n3(o.page);
    await o.page.waitForTimeout(3000);
    reporte.botones[`${vp.w}x${vp.h}`] = { entrada: e, ...(await o.page.evaluate(medirPanel)) };
    await webp(o.page, `${ENGINE}_vp_${vp.w}x${vp.h}.webp`);
    await o.ctx.close();
  }
}
if (flag('veil')) {
  reporte.erroresAntesDelVeil = [...new Set(bag.errores)];
  // Fondo combat_veil_gate (acto 2 · boss): estado local para mirar el fondo, sin servidor.
  reporte.veil = {};
  for (const n of [3, 4]) {
    await page.evaluate(() => { const s = window.__gameStore.getState(); s.clearActiveRun(); s.clearOverlay(); });
    await page.waitForTimeout(700);
    await page.evaluate((n) => {
      const mk = (i) => ({ id: `e${i}`, name: ['Bruto', 'Acólito', 'Segador', 'Voz del Velo'][i], hp: i === 2 ? 0 : 600, maxHp: 900, dps: 40, def: 0, spd: 0 });
      const hero = (slot, cls, name) => ({ slot, heroId: null, class: cls, name, atk: 60, hp: 200, maxHp: 200, energy: 100, energyMax: 100, alive: true, def: 0, spd: 0 });
      const enemies = Array.from({ length: n }, (_, i) => mk(i));
      window.__gameStore.setState({ activeRun: { runId: -1, node: { id: 'a2n10', name: 'La Voz del Velo', type: 'boss' },
        state: { engine: 2, round: 0, maxRounds: 14, isBoss: true, shield: 0, log: [], events: [], enemies, enemy: enemies[0], heroes: [hero(1, 'warrior', 'Guarnición'), hero(2, 'mage', 'Hé2'), hero(3, 'ranger', 'Hé3')] } } });
      window.__gameStore.getState().setOverlay('combat_instance', {});
    }, n);
    await page.waitForTimeout(3500);
    await webp(page, `${ENGINE}_veil_gate_a2n10_${n}enemigos.webp`);
    reporte.veil[`${n}enemigos`] = await page.evaluate(medirPanel);
  }
}
reporte.erroresVeilSintetico = [...new Set(bag.errores)].filter((e) => !reporte.erroresCombate?.includes(e) && !reporte.errores.includes(e)); // el run del veil es sintético (runId -1): su /step da 400 esperado
fs.writeFileSync(path.join(OUT, `reporte_${ENGINE}.json`), JSON.stringify(reporte, null, 2));
await ctx.close();
await browser.close();
console.log(JSON.stringify({ motor: ENGINE, fin, rondas: rondas.length, duracionS: duracion, errores: reporte.errores.length, assetsGame: bag.assets.filter((u) => u.startsWith('/assets/game/')).length, fps: stats(muestras), gpu }, null, 1));
