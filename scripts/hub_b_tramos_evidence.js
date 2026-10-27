'use strict';
/**
 * hub_b_tramos_evidence.js — Playwright evidence generator for hub_b_tramos_nivel.
 *
 *   node scripts/hub_b_tramos_evidence.js [--url http://localhost:5173]
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { chromium } = require('playwright');

const EVID = path.resolve(__dirname, '../specs/hub_b_tramos_nivel/evidencia');
if (!fs.existsSync(EVID)) {
  fs.mkdirSync(EVID, { recursive: true });
}

const W = 412;
const H = 860;
const args = { url: 'http://localhost:5173' };
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === '--url') args.url = process.argv[++i];
}

const BUILDINGS_BAJO = [
  { id: 1, building_id: 'farm_plot', level: 1, is_building: 0 },
  { id: 2, building_id: 'barn', level: 1, is_building: 0 },
  { id: 3, building_id: 'mill', level: 1, is_building: 0 },
  { id: 4, building_id: 'sawmill', level: 1, is_building: 0 },
  { id: 5, building_id: 'smithy', level: 1, is_building: 0 },
  { id: 6, building_id: 'stable', level: 1, is_building: 0 },
  { id: 7, building_id: 'house', level: 1, is_building: 0 },
  { id: 8, building_id: 'mine', level: 1, is_building: 0 },
  { id: 9, building_id: 'wall', level: 1, is_building: 0 },
  { id: 10, building_id: 'tower', level: 1, is_building: 0 },
  { id: 11, building_id: 'barracks', level: 1, is_building: 0 },
  { id: 12, building_id: 'trap', level: 1, is_building: 0 },
  { id: 13, building_id: 'tavern', level: 1, is_building: 0 },
  { id: 14, building_id: 'market', level: 1, is_building: 0 },
  { id: 15, building_id: 'embassy', level: 1, is_building: 0 },
  { id: 16, building_id: 'throne_room', level: 1, is_building: 0 },
  { id: 17, building_id: 'library', level: 1, is_building: 0 },
];

const BUILDINGS_MEDIO = [
  { id: 1, building_id: 'farm_plot', level: 5, is_building: 0 },
  { id: 2, building_id: 'barn', level: 5, is_building: 0 },
  { id: 3, building_id: 'mill', level: 3, is_building: 0 },
  { id: 4, building_id: 'sawmill', level: 3, is_building: 0 },
  { id: 5, building_id: 'smithy', level: 3, is_building: 0 },
  { id: 6, building_id: 'stable', level: 3, is_building: 0 },
  { id: 7, building_id: 'house', level: 3, is_building: 0 },
  { id: 8, building_id: 'mine', level: 3, is_building: 0 },
  { id: 9, building_id: 'wall', level: 8, is_building: 0 },
  { id: 10, building_id: 'tower', level: 5, is_building: 0 },
  { id: 11, building_id: 'barracks', level: 5, is_building: 0 },
  { id: 12, building_id: 'trap', level: 4, is_building: 0 },
  { id: 13, building_id: 'tavern', level: 3, is_building: 0 },
  { id: 14, building_id: 'market', level: 3, is_building: 0 },
  { id: 15, building_id: 'embassy', level: 2, is_building: 0 },
  { id: 16, building_id: 'throne_room', level: 5, is_building: 0 },
  { id: 17, building_id: 'library', level: 4, is_building: 0 },
];

const BUILDINGS_ALTO = [
  { id: 1, building_id: 'farm_plot', level: 10, is_building: 0 },
  { id: 2, building_id: 'barn', level: 10, is_building: 0 },
  { id: 3, building_id: 'mill', level: 5, is_building: 0 },
  { id: 4, building_id: 'sawmill', level: 5, is_building: 0 },
  { id: 5, building_id: 'smithy', level: 5, is_building: 0 },
  { id: 6, building_id: 'stable', level: 5, is_building: 0 },
  { id: 7, building_id: 'house', level: 5, is_building: 0 },
  { id: 8, building_id: 'mine', level: 5, is_building: 0 },
  { id: 9, building_id: 'wall', level: 15, is_building: 0 },
  { id: 10, building_id: 'tower', level: 10, is_building: 0 },
  { id: 11, building_id: 'barracks', level: 10, is_building: 0 },
  { id: 12, building_id: 'trap', level: 8, is_building: 0 },
  { id: 13, building_id: 'tavern', level: 5, is_building: 0 },
  { id: 14, building_id: 'market', level: 5, is_building: 0 },
  { id: 15, building_id: 'embassy', level: 3, is_building: 0 },
  { id: 16, building_id: 'throne_room', level: 10, is_building: 0 },
  { id: 17, building_id: 'library', level: 8, is_building: 0 },
];

const BUILDINGS_OBRA = [
  { id: 1, building_id: 'farm_plot', level: 1, is_building: 1 },
  { id: 2, building_id: 'barn', level: 1, is_building: 1 },
  { id: 3, building_id: 'mill', level: 1, is_building: 1 },
  { id: 4, building_id: 'sawmill', level: 1, is_building: 1 },
  { id: 5, building_id: 'smithy', level: 1, is_building: 1 },
  { id: 6, building_id: 'stable', level: 1, is_building: 1 },
  { id: 7, building_id: 'house', level: 1, is_building: 1 },
  { id: 8, building_id: 'mine', level: 1, is_building: 1 },
  { id: 9, building_id: 'wall', level: 1, is_building: 1 },
  { id: 10, building_id: 'tower', level: 1, is_building: 1 },
  { id: 11, building_id: 'barracks', level: 1, is_building: 1 },
  { id: 12, building_id: 'trap', level: 1, is_building: 1 },
  { id: 13, building_id: 'tavern', level: 1, is_building: 1 },
  { id: 14, building_id: 'market', level: 1, is_building: 1 },
  { id: 15, building_id: 'embassy', level: 1, is_building: 1 },
  { id: 16, building_id: 'throne_room', level: 1, is_building: 1 },
  { id: 17, building_id: 'library', level: 1, is_building: 1 },
];

function assert(cond, msg) {
  if (!cond) throw new Error(`ASERCION FALLIDA: ${msg}`);
}

const IDS = BUILDINGS_BAJO.map((b) => b.building_id);
const expectedKey = (id, variant) => (variant === 'bajo' ? `hubb_bld_${id}` : `hubb_bld_${id}_${variant}`);

async function open(opts = {}) {
  const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=d3d11', '--enable-gpu'] });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, hasTouch: true });
  const page = await ctx.newPage();
  for (const pattern of opts.block || []) await page.route(pattern, (route) => route.abort());

  const logs = { errors: [], pageerrors: [], warns: [], http: [], requests: [], navigations: [] };
  page.on('console', (m) => {
    const loc = m.location() && m.location().url;
    if (m.type() === 'error') logs.errors.push(`${m.text()}${loc ? ` @ ${loc}` : ''}`);
    if (m.type() === 'warning') logs.warns.push(m.text());
  });
  page.on('pageerror', (e) => logs.pageerrors.push(String((e && e.stack) || e)));
  page.on('request', (r) => logs.requests.push(r.url()));
  page.on('response', (r) => { if (r.status() >= 400) logs.http.push(`${r.status()} ${r.url()}`); });
  page.on('framenavigated', (f) => { if (f === page.mainFrame()) logs.navigations.push(f.url()); });

  await page.addInitScript(() => {
    try {
      localStorage.setItem('kh_device_id', 'tramos-evidence-1');
      localStorage.setItem('kh_ambient_fx', 'false');
      localStorage.setItem('kh_tutorial_done', '1');
    } catch (err) {
      console.error(err);
    }
  });

  await page.goto(`${args.url}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__gameStore, null, { timeout: 30000 });
  await page.evaluate(() => window.__gameStore.getState().enterGame());
  await page.waitForFunction(() => window.__phaserGame && window.__phaserGame.scene.isActive('HubSceneB'), null, { timeout: 45000 });
  await page.waitForTimeout(2500);

  // dismiss reports
  await page.evaluate(() => {
    const s = window.__gameStore.getState();
    if (s.dismissOfflineReport) s.dismissOfflineReport();
  });
  await page.waitForTimeout(500);

  return { browser, page, logs };
}

async function setBuildings(page, list) {
  await page.evaluate((b) => window.__gameStore.setState({ buildings: b }), list);
  await page.waitForTimeout(1000);
}

// Textura que tiene cada sprite de edificio en la escena ({ id: key }).
async function textureKeys(page) {
  return page.evaluate(() => {
    const scene = window.__phaserGame.scene.getScene('HubSceneB');
    const out = {};
    for (const [id, entry] of scene.bldSprites) out[id] = entry.sprite.texture.key;
    return out;
  });
}

async function assertTextures(page, label, expectFor) {
  const keys = await textureKeys(page);
  for (const id of IDS) {
    assert(keys[id] === expectFor(id), `${label}: ${id} usa "${keys[id]}", se esperaba "${expectFor(id)}"`);
  }
  console.log(`  ✓ texturas ${label}: ${IDS.length}/${IDS.length} como se esperaba`);
}

async function save(page, name) {
  const buf = await page.screenshot();
  const info = await sharp(buf).webp({ quality: 82 }).toFile(path.join(EVID, name));
  console.log(`  ✓ ${name} ${info.width}x${info.height} ${(info.size / 1024).toFixed(0)}KB`);
  return `${name} ${info.width}x${info.height} ${(info.size / 1024).toFixed(0)}KB`;
}

function writeConsole(file, title, logs, extra = []) {
  fs.writeFileSync(path.join(EVID, file), [
    `# ${title} (Playwright 412x860 @2x, ${new Date().toISOString()})`,
    `pageerrors: ${logs.pageerrors.length}`, ...logs.pageerrors.map((x) => `  ${x}`),
    `console.error: ${logs.errors.length}`, ...logs.errors.map((x) => `  ${x}`),
    `console.warn: ${logs.warns.length}`, ...logs.warns.map((x) => `  ${x}`),
    `http >= 400: ${logs.http.length}`, ...logs.http.map((x) => `  ${x}`),
    ...extra,
  ].join('\n') + '\n');
}

// R35: con webp bloqueados la escena cae al tramo inferior o al placeholder, sin pageerror.
async function runBlocked(label, block, setList, expectFor) {
  console.log(`Escenario bloqueo (${label})...`);
  const { browser, page, logs } = await open({ block });
  try {
    await setBuildings(page, setList);
    await assertTextures(page, `bloqueo ${label}`, expectFor);
    assert(logs.pageerrors.length === 0, `bloqueo ${label}: ${logs.pageerrors.length} pageerror`);
  } finally {
    await browser.close();
  }
  return `bloqueo ${label}: 17/17 con la textura de caída esperada, 0 pageerror`;
}

async function run() {
  console.log('Opening page and establishing clean state...');
  const { browser, page, logs } = await open();
  const summary = [];
  const navAfterOpen = logs.navigations.length;

  // Carga: los 51 webp de tramo/obra se piden (R41 exige además 0 http >= 400, al final).
  const variantUrls = new Set(logs.requests.filter((u) => /\/buildings\/[a-z_]+_(medio|alto|obra)\.webp/.test(u)).map((u) => u.split('?')[0]));
  assert(variantUrls.size === 51, `se pidieron ${variantUrls.size} webp de variante, se esperaban 51`);
  summary.push(`webp de variante pedidos: ${variantUrls.size}/51`);

  // 1-4. Tramos y obra
  for (const [variant, list, file] of [
    ['bajo', BUILDINGS_BAJO, 'hub_tramo_bajo.webp'],
    ['medio', BUILDINGS_MEDIO, 'hub_tramo_medio.webp'],
    ['alto', BUILDINGS_ALTO, 'hub_tramo_alto.webp'],
    ['obra', BUILDINGS_OBRA, 'hub_obra.webp'],
  ]) {
    console.log(`Setting to ${variant}...`);
    await setBuildings(page, list);
    await assertTextures(page, variant, (id) => expectedKey(id, variant));
    await save(page, file);
    summary.push(`texturas ${variant}: 17/17 correctas`);
  }

  // 5. Ciclo de mejora (R38/R44): barn bajo -> obra -> medio, misma sesión.
  console.log('Running upgrade cycle...');
  await setBuildings(page, BUILDINGS_BAJO);
  assert((await textureKeys(page)).barn === 'hubb_bld_barn', 'antes: barn no está en bajo');
  await save(page, 'mejora_antes.webp');

  await setBuildings(page, BUILDINGS_BAJO.map((b) => (b.building_id === 'barn' ? { ...b, level: 4, is_building: 1 } : b)));
  assert((await textureKeys(page)).barn === 'hubb_bld_barn_obra', 'durante: barn no está en obra');
  await save(page, 'mejora_durante.webp');

  await setBuildings(page, BUILDINGS_BAJO.map((b) => (b.building_id === 'barn' ? { ...b, level: 4, is_building: 0 } : b)));
  assert((await textureKeys(page)).barn === 'hubb_bld_barn_medio', 'después: barn no está en medio');
  await save(page, 'mejora_despues.webp');
  summary.push('ciclo barn: bajo -> obra -> medio verificado por textura');

  // 6. Toque tras el cambio (R30/R31): tap en un píxel opaco del barn nuevo.
  console.log('Simulating tap on upgraded Barn...');
  await page.evaluate(async () => {
    const mod = await import('/src/game/EventBridge.js');
    window.__sel = [];
    mod.default.on('entity:selected', (p) => window.__sel.push(p));
  });
  const pt = await page.evaluate(() => {
    const game = window.__phaserGame;
    const scene = game.scene.getScene('HubSceneB');
    const sp = scene.bldSprites.get('barn').sprite;
    const cam = scene.cameras.main;
    const r = game.canvas.getBoundingClientRect();
    const left = sp.x - sp.displayWidth / 2;
    const top = sp.y - sp.displayHeight;
    for (let gy = 0.3; gy <= 0.9; gy += 0.1) {
      for (let gx = 0.3; gx <= 0.7; gx += 0.1) {
        const wx = left + sp.displayWidth * gx;
        const wy = top + sp.displayHeight * gy;
        const a = scene.textures.getPixelAlpha(Math.floor((wx - left) / sp.scaleX), Math.floor((wy - top) / sp.scaleY), sp.texture.key);
        if (a === 255) {
          return {
            x: r.left + ((wx - cam.worldView.x) * cam.zoom * r.width) / game.scale.width,
            y: r.top + ((wy - cam.worldView.y) * cam.zoom * r.height) / game.scale.height,
          };
        }
      }
    }
    return null;
  });
  assert(pt, 'no se halló un píxel opaco en el barn nuevo');
  await page.mouse.click(pt.x, pt.y);
  await page.waitForTimeout(500);
  const sel = await page.evaluate(() => window.__sel);
  assert(sel.length === 1 && JSON.stringify(sel[0]).includes('"barn"'), `el toque emitió ${sel.length} entity:selected (${JSON.stringify(sel).slice(0, 120)}), se esperaba 1 con barn`);
  const scaleOk = await page.evaluate(() => {
    const sp = window.__phaserGame.scene.getScene('HubSceneB').bldSprites.get('barn').sprite;
    return Math.abs(sp.scaleX - sp.getData('baseScale')) < 1e-6;
  });
  assert(scaleOk, 'tras el toque la escala no volvió a baseScale (R31)');
  summary.push('toque sobre barn medio: 1 entity:selected(barn), escala = baseScale');

  // R36: el fantasma de colocación usa el tramo bajo.
  await setBuildings(page, BUILDINGS_ALTO);
  await page.evaluate(async () => {
    const mod = await import('/src/game/EventBridge.js');
    mod.default.emit('building:startPlacement', { buildingId: 'tower' });
  });
  await page.waitForTimeout(300);
  const ghostKey = await page.evaluate(() => {
    const g = window.__phaserGame.scene.getScene('HubSceneB').ghost;
    return g ? g.texture.key : null;
  });
  assert(ghostKey === 'hubb_bld_tower', `fantasma usa "${ghostKey}", se esperaba hubb_bld_tower`);
  summary.push('fantasma de colocación (tower) con tramo alto: hubb_bld_tower');

  // 7. FPS con los 17 en tramo alto (R40)
  console.log('Measuring FPS with Tramo Alto (20 seconds)...');
  await page.evaluate(async () => {
    const mod = await import('/src/game/EventBridge.js');
    mod.default.emit('building:cancelPlacement');
  });
  await setBuildings(page, BUILDINGS_ALTO);
  await page.evaluate(() => {
    window.__fpsData = [];
    let lastTime = performance.now();
    function tick() {
      const now = performance.now();
      window.__fpsData.push(1000 / (now - lastTime));
      lastTime = now;
      if (window.__fpsMeasuring) requestAnimationFrame(tick);
    }
    window.__fpsMeasuring = true;
    requestAnimationFrame(tick);
  });
  await page.waitForTimeout(20000);
  const fpsMetrics = await page.evaluate(() => {
    window.__fpsMeasuring = false;
    const clean = (window.__fpsData || []).slice(5); // descarta el calentamiento
    if (clean.length < 100) return { samples: clean.length };
    const avg = clean.reduce((a, b) => a + b, 0) / clean.length;
    return { samples: clean.length, avg: Math.round(avg * 10) / 10, min: Math.round(Math.min(...clean) * 10) / 10 };
  });
  assert(fpsMetrics.samples >= 100, `muestras de fps insuficientes (${fpsMetrics.samples}); no se inventa un valor`);
  assert(fpsMetrics.avg >= 50 && fpsMetrics.min >= 50, `fps bajo el mínimo: avg ${fpsMetrics.avg}, min ${fpsMetrics.min}`);
  const fpsJson = { avg: fpsMetrics.avg, min: fpsMetrics.min, samples: fpsMetrics.samples, durationSeconds: 20, pageerrors: logs.pageerrors.length };
  fs.writeFileSync(path.join(EVID, 'fps_tramos.json'), JSON.stringify(fpsJson, null, 2) + '\n');
  console.log('  ✓ fps_tramos.json:', fpsJson);
  summary.push(`fps: avg ${fpsMetrics.avg}, min ${fpsMetrics.min} (${fpsMetrics.samples} muestras)`);

  // Sin navegación (R38/R44), sin errores (R41)
  assert(logs.navigations.length === navAfterOpen, `hubo ${logs.navigations.length - navAfterOpen} navegación(es) tras la carga`);
  assert(logs.pageerrors.length === 0, `${logs.pageerrors.length} pageerror`);
  assert(logs.errors.length === 0, `${logs.errors.length} console.error`);
  assert(logs.http.length === 0, `${logs.http.length} respuestas http >= 400`);
  summary.push('navegaciones tras la carga: 0; pageerror 0; console.error 0; http>=400 0');
  await browser.close();

  // R35: bloqueo de webp
  const r35 = [];
  r35.push(await runBlocked('*_alto.webp', ['**/buildings/*_alto.webp'], BUILDINGS_ALTO, (id) => expectedKey(id, 'medio')));
  r35.push(await runBlocked('todos los webp de edificio', ['**/buildings/*.webp'], BUILDINGS_ALTO, () => 'hubb_placeholder'));
  writeConsole('consola.txt', 'Consola de ejecucion del Hub con los 80 webp de edificios', logs,
    ['', '## Aserciones superadas', ...summary.concat(r35).map((x) => `- ${x}`)]);
  console.log('Evidence generation finished successfully.');
}

run().catch((err) => {
  console.error('Fatal error running evidence script:', err);
  process.exit(1);
});
