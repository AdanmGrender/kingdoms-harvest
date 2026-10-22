'use strict';
/**
 * ui_kit_b_evidence.js — corrida Playwright de evidencia de ui_kit_b (specs/ui_kit_b/tasks.md T1, T7, T8, T17, T33).
 *
 *   node scripts/ui_kit_b_evidence.js --mode antes|despues|digitos|prod|barra [--url http://localhost:5173]
 *
 * Patrón de hub_b_pickups_evidence.js: Vite dev (:5173, proxy a :3001) y server con SKIP_AUTH=true; en `--mode prod` se usa
 * el server con NODE_ENV=production sirviendo client/dist (--url http://localhost:3001). Chromium 412×860 @2x con touch.
 * Capturas webp y reportes en specs/ui_kit_b/evidencia/. Si `sharp`/`playwright` no están en la raíz del worktree,
 * correr con NODE_PATH=<raíz del repo principal>/node_modules (solo lectura).
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { chromium } = require('playwright');

const EVID = path.resolve(__dirname, '../specs/ui_kit_b/evidencia');
const W = 412;
const H = 860;
const args = { mode: 'antes', url: 'http://localhost:5173' };
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === '--mode') args.mode = process.argv[++i];
  else if (process.argv[i] === '--url') args.url = process.argv[++i];
}

async function open(enter = true) {
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
      localStorage.setItem('kh_device_id', 'ui-kit-b-evidence-1');
      localStorage.setItem('kh_ambient_fx', 'false');
      localStorage.setItem('kh_tutorial_done', '1');
    } catch { /* storage bloqueado */ }
  });
  await page.goto(`${args.url}/`, { waitUntil: 'domcontentloaded' });
  if (!enter) { await page.waitForTimeout(6000); return { browser, page, logs }; } // build de prod: sin __gameStore (solo DEV)
  await page.waitForFunction(() => !!window.__gameStore, null, { timeout: 30000 });
  await page.evaluate(() => window.__gameStore.getState().enterGame());
  await page.waitForFunction(() => window.__phaserGame && window.__phaserGame.scene.isActive('HubSceneB'), null, { timeout: 45000 });
  await page.waitForTimeout(2500);
  await page.evaluate(() => { const s = window.__gameStore.getState(); if (s.dismissOfflineReport) s.dismissOfflineReport(); });
  await page.waitForTimeout(500);
  return { browser, page, logs };
}

async function save(page, name, clip) {
  const buf = await page.screenshot(clip ? { clip } : {});
  const info = await sharp(buf).webp({ quality: 82 }).toFile(path.join(EVID, name));
  return `${name} ${info.width}x${info.height} ${(info.size / 1024).toFixed(0)}KB`;
}

function writeConsole(file, title, logs) {
  fs.writeFileSync(path.join(EVID, file), [
    `# ${title} (Playwright 412x860 @2x, ${new Date().toISOString()})`,
    `pageerrors: ${logs.pageerrors.length}`, ...logs.pageerrors.map((x) => `  ${x}`),
    `console.error: ${logs.errors.length}`, ...logs.errors.map((x) => `  ${x}`),
    `console.warn: ${logs.warns.length}`, ...logs.warns.map((x) => `  ${x}`),
    `http >= 400: ${logs.http.length}`, ...logs.http.map((x) => `  ${x}`),
  ].join('\n') + '\n');
}

// Hub + 4 paneles (construir = BuildingToolbar visible en el hub; héroes, mercado, ajustes = overlays).
async function panelesRun(suffix) {
  const { browser, page, logs } = await open();
  const rep = { shots: [] };
  rep.shots.push(await save(page, `hub_${suffix}.webp`));
  rep.shots.push(await save(page, `construir_${suffix}.webp`, { x: 0, y: H - 220, width: W, height: 220 }));
  for (const [type, name] of [['heroes', 'heroes'], ['marketplace', 'mercado'], ['settings', 'ajustes']]) {
    await page.evaluate((t) => window.__gameStore.getState().setOverlay(t, undefined), type);
    await page.waitForTimeout(1200);
    rep.shots.push(await save(page, `${name}_${suffix}.webp`));
    await page.evaluate(() => window.__gameStore.getState().clearOverlay());
    await page.waitForTimeout(400);
  }
  await browser.close();
  writeConsole(`consola_${suffix}.txt`, `consola de la corrida ${suffix}`, logs);
  console.log(JSON.stringify({ ...rep, pageerrors: logs.pageerrors.length, consoleErrors: logs.errors.length }, null, 2));
}

// R13: barra de recursos a 412 px con datos de 5 cifras y 12.3K, con IM Fell y con font-numeric.
async function digitosRun() {
  const { browser, page, logs } = await open();
  const rep = {};
  await page.evaluate(() => {
    const s = window.__gameStore.getState();
    const res = {};
    for (const [k, v] of Object.entries({ wood: 12345, stone: 99999, wheat: 12300, iron: 4567, egg: 88888, milk: 1234, wool: 56789, carrot: 12300 })) res[k] = v;
    window.__gameStore.setState({ resources: { ...s.resources, ...res } });
  });
  await page.waitForTimeout(500);
  for (const mode of ['im_fell', 'numeric']) {
    await page.evaluate((m) => {
      document.querySelectorAll('[data-resource]').forEach((el) => {
        el.querySelectorAll('span').forEach((sp) => { sp.style.fontFamily = m === 'numeric' ? '"Alegreya Sans SC", serif' : ''; /* font-numeric aún no se usa: Tailwind no emite la clase */ });
      });
    }, mode);
    await page.waitForTimeout(200);
    const clip = await page.evaluate(() => {
      const els = [...document.querySelectorAll('[data-resource]')];
      if (!els.length) return { x: 0, y: 0, width: 412, height: 120 };
      const r = els.map((e) => e.getBoundingClientRect());
      const top = Math.min(...r.map((x) => x.top)); const bot = Math.max(...r.map((x) => x.bottom));
      return { x: 0, y: Math.max(0, top - 8), width: 412, height: bot - top + 16 };
    });
    rep[mode] = await save(page, `digitos_${mode === 'im_fell' ? 'im_fell' : 'numeric'}.webp`, clip);
    rep[`${mode}_font`] = await page.evaluate(() => {
      const el = document.querySelector('[data-resource] span');
      return el ? getComputedStyle(el).fontFamily : null;
    });
    rep[`${mode}_ancho`] = await page.evaluate(() => [...document.querySelectorAll('[data-resource]')].map((e) => {
      const row = e.parentElement;
      return { key: e.getAttribute('data-resource'), texto: e.textContent.trim(), w: Math.round(e.getBoundingClientRect().width), fila: row ? `${row.scrollWidth}/${row.clientWidth}` : null };
    }));
  }
  await browser.close();
  console.log(JSON.stringify({ ...rep, pageerrors: logs.pageerrors.length }, null, 2));
}

// R16 / R2 / R8: cliente servido en prod; requests de fuentes y estado de document.fonts.
async function prodRun() {
  const { browser, page, logs } = await open(false);
  const rep = await page.evaluate(async () => {
    await Promise.all([document.fonts.load('16px "IM Fell English"'), document.fonts.load('16px "IM Fell English SC"'), document.fonts.load('700 16px "Alegreya Sans SC"')]);
    await document.fonts.ready;
    return {
      fontsCheck: {
        'IM Fell English': document.fonts.check('16px "IM Fell English"'),
        'IM Fell English SC': document.fonts.check('16px "IM Fell English SC"'),
        'Alegreya Sans SC 700': document.fonts.check('700 16px "Alegreya Sans SC"'),
      },
      bodyFontFamily: getComputedStyle(document.body).fontFamily,
    };
  });
  const origin = new URL(args.url).origin;
  const fontReqs = logs.requests.filter((u) => /font|woff/i.test(u));
  rep.requestsDeFuentes = fontReqs;
  rep.requestsAHostsExternos = logs.requests.filter((u) => !u.startsWith(origin) && !u.startsWith('data:') && !u.startsWith('blob:'));
  rep.fuentesExternas = rep.requestsAHostsExternos.filter((u) => /fonts\.(googleapis|gstatic)\.com/.test(u));
  rep.cspViolaciones = logs.errors.filter((e) => /content security policy|csp/i.test(e));
  rep.captura = await save(page, 'prod_hub.webp');
  await browser.close();
  writeConsole('consola_prod.txt', 'consola de la corrida prod', logs);
  fs.writeFileSync(path.join(EVID, 'prod_fuentes.json'), `${JSON.stringify(rep, null, 2)}\n`);
  console.log(JSON.stringify(rep, null, 2));
}

// R32: la barra de recursos no desborda a 412 px.
async function barraRun() {
  const { browser, page, logs } = await open();
  const rep = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('[data-resource]').forEach((el) => {
      const row = el.parentElement;
      out.push({ key: el.getAttribute('data-resource'), w: Math.round(el.getBoundingClientRect().width), row: row ? { sw: row.scrollWidth, cw: row.clientWidth } : null });
    });
    return out;
  });
  const clip = await page.evaluate(() => {
    const els = [...document.querySelectorAll('[data-resource]')];
    const top = els.length ? Math.min(...els.map((e) => e.getBoundingClientRect().top)) : 0;
    return { x: 0, y: 0, width: 412, height: Math.min(300, top + 90) };
  });
  const shot = await save(page, 'barra_412.webp', clip);
  await browser.close();
  console.log(JSON.stringify({ rep, shot, pageerrors: logs.pageerrors.length }, null, 2));
}

(async () => {
  fs.mkdirSync(EVID, { recursive: true });
  if (args.mode === 'antes') await panelesRun('antes');
  else if (args.mode === 'despues') await panelesRun('despues');
  else if (args.mode === 'digitos') await digitosRun();
  else if (args.mode === 'prod') await prodRun();
  else if (args.mode === 'barra') await barraRun();
  else throw new Error(`modo desconocido: ${args.mode}`);
})().catch((e) => { console.error(e); process.exit(1); });
