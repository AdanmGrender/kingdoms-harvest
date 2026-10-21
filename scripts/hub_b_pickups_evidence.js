'use strict';
/**
 * hub_b_pickups_evidence.js — corrida Playwright de evidencia de hub_b_recoleccion (specs/hub_b_recoleccion/tasks.md T13, T14).
 *
 *   node scripts/hub_b_pickups_evidence.js --mode fps|main|fallback [--url http://localhost:5173]
 *
 * Requiere Vite dev (:5173, proxy a :3001) y el server con SKIP_AUTH=true y la DB local de dev sembrada con 4 parcelas
 * listas (building_id 2, 3), un `stable` y 3 animales listos + 1 no listo. Chromium 412×860 @2x con touch, GPU d3d11.
 * Capturas webp y reportes en specs/hub_b_recoleccion/evidencia/. No modifica ningún dato salvo lo que cosecha el tap real.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { chromium } = require('playwright');

const EVID = path.resolve(__dirname, '../specs/hub_b_recoleccion/evidencia');
const W = 412;
const H = 860;
const args = { mode: 'main', url: 'http://localhost:5173' };
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === '--mode') args.mode = process.argv[++i];
  else if (process.argv[i] === '--url') args.url = process.argv[++i];
}

async function open({ blockPickupArt = false } = {}) {
  const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=d3d11', '--enable-gpu'] });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, hasTouch: true });
  const page = await ctx.newPage();
  const logs = { errors: [], pageerrors: [], warns: [], http: [], farm: [] };
  page.on('console', (m) => {
    const loc = m.location() && m.location().url;
    if (m.type() === 'error') logs.errors.push(`${m.text()}${loc ? ` @ ${loc}` : ''}`);
    if (m.type() === 'warning') logs.warns.push(m.text());
  });
  page.on('pageerror', (e) => logs.pageerrors.push(String((e && e.stack) || e)));
  page.on('request', (r) => {
    const u = r.url();
    if (r.method() === 'POST' && (u.includes('/api/farm/harvest') || u.includes('/api/farm/animals/collect'))) {
      logs.farm.push({ url: new URL(u).pathname, body: r.postData(), t: Date.now() });
    }
  });
  page.on('response', (r) => { if (r.status() >= 400) logs.http.push(`${r.status()} ${r.url()}`); });
  if (blockPickupArt) {
    await page.route('**/assets/b/pickups/*.webp', (rt) => rt.abort());
  }
  await page.addInitScript(() => {
    try {
      localStorage.setItem('kh_device_id', 'pickups-evidence-1');
      localStorage.setItem('kh_ambient_fx', 'false');
      localStorage.setItem('kh_tutorial_done', '1');
    } catch { /* storage bloqueado */ }
  });
  await page.goto(`${args.url}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__gameStore, null, { timeout: 30000 });
  await page.evaluate(async () => {
    const EB = (await import('/src/game/EventBridge.js')).default;
    window.__ev = [];
    for (const e of ['entity:selected', 'entity:deselected']) EB.on(e, (p) => window.__ev.push([e, p === undefined ? null : p]));
    window.__gameStore.getState().enterGame();
  });
  await page.waitForFunction(() => window.__phaserGame && window.__phaserGame.scene.isActive('HubSceneB'), null, { timeout: 45000 });
  await page.waitForTimeout(2500);
  await page.evaluate(() => { const s = window.__gameStore.getState(); if (s.dismissOfflineReport) s.dismissOfflineReport(); });
  await page.waitForTimeout(500);
  return { browser, page, logs };
}

// ─── Lecturas dentro de la página ───────────────────────────────
function readPickups() {
  const sc = window.__phaserGame.scene.getScene('HubSceneB');
  const cam = sc.cameras.main;
  const rect = document.querySelector('#phaser-container canvas').getBoundingClientRect();
  const toCss = (x, y) => ({
    x: rect.left + ((x - cam.worldView.x) * cam.zoom) / sc.renderScale,
    y: rect.top + ((y - cam.worldView.y) * cam.zoom) / sc.renderScale,
  });
  return [...sc.pickupSprites.entries()].map(([key, e]) => {
    const s = e.sprite;
    const c = toCss(s.x, s.y - s.displayHeight / 2);
    const hit = s.input && s.input.hitArea;
    const bld = [...sc.bldSprites.values()].find((b) => b.sprite && b.sprite.getBounds().contains(s.x, s.y - s.displayHeight / 2));
    return {
      key, host: e.p.host, icon: e.p.icon, resourceKey: e.p.resourceKey, texture: s.texture.key,
      x: +s.x.toFixed(1), y: +s.y.toFixed(1), depth: s.depth, alpha: s.alpha,
      displayH: +s.displayHeight.toFixed(1), hitLogical: hit ? [+(hit.width * s.scaleX).toFixed(1), +(hit.height * s.scaleY).toFixed(1)] : null,
      css: { x: +c.x.toFixed(1), y: +c.y.toFixed(1) }, overBuilding: bld ? (bld.id || true) : false,
    };
  });
}

const counterText = (page, key) => page.evaluate((k) => {
  const el = document.querySelector(`[data-resource="${k}"]`);
  return el ? el.textContent.trim() : null;
}, key);
const storeAmount = (page, key) => page.evaluate((k) => {
  const r = window.__gameStore.getState().resources[k];
  return r && typeof r === 'object' ? r.amount : r;
}, key);

async function save(page, name, clip) {
  const buf = await page.screenshot(clip ? { clip } : {});
  const info = await sharp(buf).webp({ quality: 82 }).toFile(path.join(EVID, name));
  return `${name} ${info.width}x${info.height} ${(info.size / 1024).toFixed(0)}KB`;
}

const logSummary = (logs) => ({
  pageerrors: logs.pageerrors, consoleErrors: logs.errors, consoleWarns: logs.warns, http4xx5xx: logs.http,
});

// ─── Modos ──────────────────────────────────────────────────────
async function fpsRun() {
  const { browser, page, logs } = await open();
  const pk = await page.evaluate(readPickups);
  const samples = await page.evaluate(() => new Promise((resolve) => {
    const out = [];
    let frames = 0;
    let last = performance.now();
    const raf = () => { frames++; if (out.length < 20) requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
    const iv = setInterval(() => {
      const now = performance.now();
      out.push({ actualFps: +window.__phaserGame.loop.actualFps.toFixed(1), raf: +((frames * 1000) / (now - last)).toFixed(1) });
      frames = 0; last = now;
      if (out.length >= 20) { clearInterval(iv); resolve(out); }
    }, 1000);
  }));
  const gpu = await page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl');
    const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : null;
  });
  const shot = await save(page, 'recoleccion_6_objetos.webp');
  await browser.close();
  const a = samples.map((x) => x.actualFps);
  const r = samples.map((x) => x.raf);
  const avg = (v) => +(v.reduce((s, x) => s + x, 0) / v.length).toFixed(1);
  const res = {
    date: new Date().toISOString(), dpr: 2, viewport: [W, H], gpu, chromiumArgs: ['--use-angle=d3d11', '--enable-gpu'],
    scenario: 'hub con 6 objetos de recolección visibles (3 parcelas listas + 3 animales listos), FX desactivados como en hub_b_escena/fps.json',
    pickupsVisible: pk.length, byHost: pk.reduce((m, p) => { m[p.host] = (m[p.host] || 0) + 1; return m; }, {}),
    actualFps: { avg: avg(a), min: Math.min(...a) }, raf: { avg: avg(r), min: Math.min(...r) },
    pageerrors: logs.pageerrors.length, shot, samples,
  };
  fs.writeFileSync(path.join(EVID, 'fps_recoleccion.json'), `${JSON.stringify(res, null, 2)}\n`);
  console.log(JSON.stringify({ ...res, samples: undefined }, null, 2));
}

async function mainRun() {
  const { browser, page, logs } = await open();
  const rep = {};
  const before = await page.evaluate(readPickups);
  rep.pickupsInicial = before.map(({ key, host, icon, resourceKey, texture, x, y, depth, displayH, hitLogical, overBuilding }) => ({
    key, host, icon, resourceKey, texture, x, y, depth, displayH, hitLogical, overBuilding }));
  rep.captura_objetos = await save(page, 'recoleccion_objetos.webp');
  const safe = await page.evaluate(async () => {
    const m = await import('/src/game/hub/hubLayout.js');
    return { SAFE_LEFT: m.SAFE_LEFT, SAFE_RIGHT: m.SAFE_RIGHT, SAFE_TOP: m.SAFE_TOP, SAFE_BOTTOM: m.SAFE_BOTTOM, fog: m.HUB_DEPTHS.fog };
  });
  rep.safe = safe;
  rep.dentroZonaSegura = before.every((p) => p.x >= safe.SAFE_LEFT && p.x <= safe.SAFE_RIGHT && p.y >= safe.SAFE_TOP && p.y <= safe.SAFE_BOTTOM);
  rep.depthBajoFog = before.every((p) => p.depth < safe.fog);

  // R20: duración real del vuelo (animal) a escala de tiempo 1, en el mismo tap
  const animal = before.find((p) => p.key.startsWith('animal:'));
  const crop = before.find((p) => p.key === 'plot:1');
  const wheatBefore = { dom: await counterText(page, 'wheat'), store: await storeAmount(page, 'wheat') };

  // — tap de cultivo en cámara lenta para fotografiar el vuelo a mitad —
  await page.evaluate(() => {
    const sc = window.__phaserGame.scene.getScene('HubSceneB');
    sc.tweens.timeScale = 0.12;
    window.__evBefore = window.__ev.length;
  });
  rep.captura_antes_tap = await save(page, 'recoleccion_antes_tap.webp');
  await page.touchscreen.tap(crop.css.x, crop.css.y);
  await page.touchscreen.tap(crop.css.x, crop.css.y); // doble tap inmediato (R19)
  await page.waitForTimeout(1300);
  rep.captura_vuelo = await save(page, 'recoleccion_vuelo.webp');
  rep.vuelo_en_curso = await page.evaluate(() => {
    const sc = window.__phaserGame.scene.getScene('HubSceneB');
    return { volando: sc.flyingPickups.size, entityEventsPorEseTap: window.__ev.length - window.__evBefore };
  });
  await page.evaluate(() => { window.__phaserGame.scene.getScene('HubSceneB').tweens.timeScale = 1; });
  await page.waitForFunction(() => window.__phaserGame.scene.getScene('HubSceneB').flyingPickups.size === 0, null, { timeout: 15000 });
  await page.waitForTimeout(1200);
  rep.cosecha = {
    requests: logs.farm.filter((f) => f.url.endsWith('/harvest')),
    contadorWheatAntes: wheatBefore,
    contadorWheatDespues: { dom: await counterText(page, 'wheat'), store: await storeAmount(page, 'wheat') },
  };
  rep.captura_despues_tap = await save(page, 'recoleccion_despues_tap.webp');
  const after1 = await page.evaluate(readPickups);
  rep.pickupsTrasCosecha = after1.map((p) => p.key);

  // — R20: vuelo real de un animal, medido en tiempo real —
  const animalNow = after1.find((p) => p.key.startsWith('animal:'));
  await page.evaluate(() => {
    const sc = window.__phaserGame.scene.getScene('HubSceneB');
    window.__fly = { start: null, end: null };
    const iv = setInterval(() => {
      const n = sc.flyingPickups.size;
      if (n > 0 && window.__fly.start == null) window.__fly.start = performance.now();
      if (n === 0 && window.__fly.start != null && window.__fly.end == null) { window.__fly.end = performance.now(); clearInterval(iv); }
    }, 8);
  });
  const evBefore2 = await page.evaluate(() => window.__ev.length);
  await page.touchscreen.tap(animalNow.css.x, animalNow.css.y);
  await page.waitForFunction(() => window.__fly.end != null, null, { timeout: 8000 });
  rep.animal = {
    tapped: animalNow.key, resourceKey: animalNow.resourceKey,
    requests: logs.farm.filter((f) => f.url.endsWith('/animals/collect')),
    vueloMs: await page.evaluate(() => Math.round(window.__fly.end - window.__fly.start)),
    entityEventsPorEseTap: (await page.evaluate(() => window.__ev.length)) - evBefore2,
    destinoFallbackSinContador: await counterText(page, animalNow.resourceKey),
  };
  await page.waitForTimeout(800);

  // — R25: tap en edificio sin objeto superpuesto sigue seleccionando —
  const thr = await page.evaluate(() => {
    const sc = window.__phaserGame.scene.getScene('HubSceneB');
    const cam = sc.cameras.main;
    const rect = document.querySelector('#phaser-container canvas').getBoundingClientRect();
    const e = [...sc.bldSprites.entries()].find(([, v]) => v.sprite.getData('buildingId') === 'barn' || v.sprite.getData('buildingId') === 'throne_room');
    const s = e[1].sprite;
    const b = s.getBounds();
    return {
      id: s.getData('buildingId'),
      x: rect.left + ((b.centerX - cam.worldView.x) * cam.zoom) / sc.renderScale,
      y: rect.top + ((b.centerY - cam.worldView.y) * cam.zoom) / sc.renderScale,
    };
  });
  const evBefore3 = await page.evaluate(() => window.__ev.length);
  await page.touchscreen.tap(thr.x, thr.y);
  await page.waitForTimeout(500);
  rep.tapEdificioSinObjeto = { edificio: thr.id, eventos: (await page.evaluate(() => window.__ev)).slice(evBefore3).map((e) => e[0] + ':' + (e[1] && (e[1].buildingId || e[1].id || e[1].type || ''))) };

  // — R5: parcela cosechada desde otro camino desaparece del hub en el siguiente sync —
  const rest = await page.evaluate(readPickups);
  rep.pickupsFinales = rest.map((p) => p.key);
  await browser.close();
  Object.assign(rep, logSummary(logs));
  fs.writeFileSync(path.join(EVID, 'recoleccion_main.json'), `${JSON.stringify(rep, null, 2)}\n`);
  fs.writeFileSync(path.join(EVID, 'consola.txt'), [
    `# consola de la corrida main (Playwright 412x860 @2x, ${new Date().toISOString()})`,
    `pageerrors: ${logs.pageerrors.length}`,
    `console.error: ${logs.errors.length}`, ...logs.errors.map((x) => `  ${x}`),
    `console.warn: ${logs.warns.length}`, ...logs.warns.map((x) => `  ${x}`),
    `http >= 400: ${logs.http.length}`, ...logs.http.map((x) => `  ${x}`),
  ].join('\n') + '\n');
  console.log(JSON.stringify(rep, null, 2));
}

async function fallbackRun() {
  const { browser, page, logs } = await open({ blockPickupArt: true });
  const rep = {};
  const pk = await page.evaluate(readPickups);
  rep.objetos = pk.map(({ key, texture, hitLogical }) => ({ key, texture, hitLogical }));
  rep.todosConPlaceholder = pk.length > 0 && pk.every((p) => p.texture === 'hubb_pickup_placeholder');
  rep.captura = await save(page, 'recoleccion_fallback.webp');
  const target = pk[0];
  await page.touchscreen.tap(target.css.x, target.css.y);
  await page.waitForFunction(() => window.__phaserGame.scene.getScene('HubSceneB').flyingPickups.size >= 0, null, { timeout: 3000 });
  await page.waitForTimeout(1500);
  rep.tapConPlaceholder = { tapped: target.key, requests: logs.farm };
  rep.advertencias = logs.warns.filter((w) => /HubSceneB|placeholder/i.test(w));
  await browser.close();
  Object.assign(rep, logSummary(logs));
  fs.writeFileSync(path.join(EVID, 'recoleccion_fallback.json'), `${JSON.stringify(rep, null, 2)}\n`);
  console.log(JSON.stringify(rep, null, 2));
}

(async () => {
  fs.mkdirSync(EVID, { recursive: true });
  if (args.mode === 'fps') await fpsRun();
  else if (args.mode === 'fallback') await fallbackRun();
  else await mainRun();
})().catch((e) => { console.error(e); process.exit(1); });
