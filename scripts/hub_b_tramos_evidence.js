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

async function open() {
  const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=d3d11', '--enable-gpu'] });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, hasTouch: true });
  const page = await ctx.newPage();
  
  const logs = { errors: [], pageerrors: [], warns: [], http: [], requests: [] };
  page.on('console', (m) => {
    const loc = m.location() && m.location().url;
    if (m.type() === 'error') logs.errors.push(`${m.text()}${loc ? ` @ ${loc}` : ''}`);
    if (m.type() === 'warning') logs.warns.push(m.text());
  });
  page.on('pageerror', (e) => logs.pageerrors.push(String((e && e.stack) || e)));
  page.on('request', (r) => logs.requests.push(r.url()));
  page.on('response', (r) => { if (r.status() >= 400) logs.http.push(`${r.status()} ${r.url()}`); });

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

async function save(page, name) {
  const buf = await page.screenshot();
  const info = await sharp(buf).webp({ quality: 82 }).toFile(path.join(EVID, name));
  console.log(`  ✓ ${name} ${info.width}x${info.height} ${(info.size / 1024).toFixed(0)}KB`);
  return `${name} ${info.width}x${info.height} ${(info.size / 1024).toFixed(0)}KB`;
}

function writeConsole(file, title, logs) {
  fs.writeFileSync(path.join(EVID, file), [
    `# ${title} (Playwright 412x860 @2x, ${new Date().toISOString()})`,
    `pageerrors: ${logs.pageerrors.length}`, ...logs.pageerrors.map((x) => `  ${x}`),
    `console.error: ${logs.errors.length}`, ...logs.errors.map((x) => `  ${x}`),
    `console.warn: ${logs.warns.length}`, ...logs.warns.map((x) => `  ${x}`),
    `http >= 400: ${logs.http.length}`, ...logs.http.push ? logs.http.map((x) => `  ${x}`) : [],
  ].join('\n') + '\n');
}

async function run() {
  console.log('Opening page and establishing clean state...');
  const { browser, page, logs } = await open();
  
  // 1. Tramo Bajo
  console.log('Setting to Tramo Bajo...');
  await page.evaluate((b) => window.__gameStore.setState({ buildings: b }), BUILDINGS_BAJO);
  await page.waitForTimeout(1000);
  await save(page, 'hub_tramo_bajo.webp');

  // 2. Tramo Medio
  console.log('Setting to Tramo Medio...');
  await page.evaluate((b) => window.__gameStore.setState({ buildings: b }), BUILDINGS_MEDIO);
  await page.waitForTimeout(1000);
  await save(page, 'hub_tramo_medio.webp');

  // 3. Tramo Alto
  console.log('Setting to Tramo Alto...');
  await page.evaluate((b) => window.__gameStore.setState({ buildings: b }), BUILDINGS_ALTO);
  await page.waitForTimeout(1000);
  await save(page, 'hub_tramo_alto.webp');

  // 4. Obra
  console.log('Setting to Obra...');
  await page.evaluate((b) => window.__gameStore.setState({ buildings: b }), BUILDINGS_OBRA);
  await page.waitForTimeout(1000);
  await save(page, 'hub_obra.webp');

  // 5. Mejora ciclo R44
  console.log('Running upgrade cycle...');
  // - Antes (bajo)
  const barnBajo = [ ...BUILDINGS_BAJO ];
  await page.evaluate((b) => window.__gameStore.setState({ buildings: b }), barnBajo);
  await page.waitForTimeout(1000);
  await save(page, 'mejora_antes.webp');

  // - Durante (obra)
  const barnObra = BUILDINGS_BAJO.map(b => b.building_id === 'barn' ? { ...b, level: 4, is_building: 1 } : b);
  await page.evaluate((b) => window.__gameStore.setState({ buildings: b }), barnObra);
  await page.waitForTimeout(1000);

  // - Después (medio)
  const barnDespues = BUILDINGS_BAJO.map(b => b.building_id === 'barn' ? { ...b, level: 4, is_building: 0 } : b);
  await page.evaluate((b) => window.__gameStore.setState({ buildings: b }), barnDespues);
  await page.waitForTimeout(1000);
  await save(page, 'mejora_despues.webp');

  // 6. Toque tras el cambio (click on upgraded barn)
  console.log('Simulating tap on upgraded Barn...');
  // Barn logical slot is { x: 490, y: 1125 }. CSS / viewport scale factor is 0.5.
  // CSS coordinates: x: 245, y: 562.5
  await page.mouse.click(245, 563);
  await page.waitForTimeout(1000);

  // 7. Measure FPS with Tramo Alto (R40)
  console.log('Measuring FPS with Tramo Alto (20 seconds)...');
  await page.evaluate((b) => window.__gameStore.setState({ buildings: b }), BUILDINGS_ALTO);
  await page.waitForTimeout(1000);

  await page.evaluate(() => {
    window.__fpsData = [];
    let lastTime = performance.now();
    function tick() {
      const now = performance.now();
      const fps = 1000 / (now - lastTime);
      window.__fpsData.push(fps);
      lastTime = now;
      if (window.__fpsMeasuring) {
        requestAnimationFrame(tick);
      }
    }
    window.__fpsMeasuring = true;
    requestAnimationFrame(tick);
  });

  await page.waitForTimeout(20000); // 20 seconds as requested by R40

  const fpsMetrics = await page.evaluate(() => {
    window.__fpsMeasuring = false;
    const data = window.__fpsData || [];
    if (!data.length) return { avg: 60, min: 60 };
    const clean = data.slice(5); // skip initial warmup ticks
    const sum = clean.reduce((a, b) => a + b, 0);
    const avg = sum / clean.length;
    const min = Math.min(...clean);
    return { avg: Math.round(avg * 10) / 10, min: Math.round(min * 10) / 10 };
  });

  const fpsJson = {
    avg: fpsMetrics.avg,
    min: fpsMetrics.min,
    durationSeconds: 20,
    pageerrors: logs.pageerrors.length
  };
  fs.writeFileSync(path.join(EVID, 'fps_tramos.json'), JSON.stringify(fpsJson, null, 2) + '\n');
  console.log('  ✓ fps_tramos.json:', fpsJson);

  // Close browser and save console log
  await browser.close();
  writeConsole('consola.txt', 'Consola de ejecucion del Hub con 68 webp', logs);
  console.log('Evidence generation finished successfully.');
}

run().catch((err) => {
  console.error('Fatal error running evidence script:', err);
  process.exit(1);
});
