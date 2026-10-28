'use strict';
/**
 * reporte_escribano_evidence.js — evidencia visual R16, R26, R30.
 *
 *   node scripts/reporte_escribano_evidence.js [--url http://localhost:5173]
 *
 * Inyecta `offlineReport` en la respuesta de POST /api/player/init con page.route y
 * captura el modal a 412x860 @2x (reporte corto, largo y con granero lleno).
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { chromium } = require('playwright');

const EVID = path.resolve(__dirname, '../specs/reporte_escribano/evidencia');
fs.mkdirSync(EVID, { recursive: true });

const W = 412;
const H = 860;
const args = { url: 'http://localhost:5173' };
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === '--url') args.url = process.argv[++i];
}

const HOUR = 3600000;
// Peor caso de R30: frase de exactamente 140 caracteres (se recorta de un texto más largo).
const LONG_LINE = ('Una ausencia larga rinde buen libro, señor: las ratas engordaron, los labriegos callaron y el diezmo creció '
  + 'sin que nadie lo notara jamás, ni siquiera yo, que lo anoto todo.').slice(0, 140);

const RES17 = ['wheat', 'wood', 'stone', 'iron', 'water', 'gold', 'bread', 'planks', 'ingots', 'flour',
  'cheese', 'egg', 'milk', 'wool', 'crystal', 'relic', 'blueprint'];

const REPORTS = {
  corto: {
    awayMs: 2 * HOUR + 5 * 60000,
    resources: { wheat: 40, wood: 25 },
    khEarned: 0,
    catchUp: {},
    downtimeMs: 0,
    events: [],
    storage: { wheat: { amount: 480, capacity: 500 }, wood: { amount: 300, capacity: 1000 } },
  },
  largo: {
    awayMs: 30 * HOUR,
    resources: Object.fromEntries(RES17.map((id, i) => [id, 10 + i * 7])),
    khEarned: 2.5,
    catchUp: { wheat: 12 },
    downtimeMs: 3 * HOUR,
    events: [
      { icon: '🌾', text: '3 cultivo(s) esperando cosecha' },
      { icon: '🛡️', text: 'Tu bastión fue atacado 2 vez/veces' },
      { icon: '🏗️', text: 'Una obra terminó mientras no estabas' },
      { icon: '⚔️', text: 'Tus tropas volvieron de la expedición' },
    ],
    storage: Object.fromEntries(RES17.map((id) => [id, { amount: 500, capacity: 1000 }])),
    __line: LONG_LINE,
  },
  lleno: {
    awayMs: 5 * HOUR,
    resources: { wheat: 60, wood: 10 },
    khEarned: 0,
    catchUp: {},
    downtimeMs: 0,
    events: [{ icon: '🌾', text: '3 cultivo(s) esperando cosecha' }],
    storage: {
      wheat: { amount: 500, capacity: 500 },
      wood: { amount: 120, capacity: 1000 },
      stone: { amount: 800, capacity: 800 },
    },
  },
};

async function dismissDaily(page) {
  // Popup de racha diaria: se cierra si aparece, antes de leer el modal.
  const btn = page.getByRole('button', { name: /cerrar|continuar|reclamar|ok|aceptar/i }).first();
  if (await btn.count()) await btn.click({ timeout: 2000 }).catch(() => {});
}

async function run() {
  const results = [];
  let failed = false;
  const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=d3d11', '--enable-gpu'] });
  try {
    for (const [name, report] of Object.entries(REPORTS)) {
      const { __line, ...payload } = report;
      const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, hasTouch: true });
      const page = await ctx.newPage();
      const errors = [];
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
      page.on('pageerror', (e) => errors.push(String(e)));

      await page.route('**/api/player/init', async (route) => {
        const resp = await route.fetch();
        const body = await resp.json();
        body.offlineReport = payload;
        await route.fulfill({ response: resp, json: body });
      });
      await page.addInitScript(() => {
        try {
          localStorage.setItem('kh_device_id', 'escribano-evidence-1');
          localStorage.setItem('kh_ambient_fx', 'false');
          localStorage.setItem('kh_tutorial_done', '1');
        } catch (err) { console.error(err); }
      });

      await page.goto(`${args.url}/`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => !!window.__gameStore, null, { timeout: 30000 });
      await page.evaluate(() => window.__gameStore.getState().enterGame());
      await page.getByText('Libro de cuentas del Escribano').waitFor({ timeout: 45000 });
      await page.waitForTimeout(800);

      if (__line) {
        // Frase de 140 caracteres (peor caso): se fija sobre el nodo para medir el desborde.
        await page.evaluate((text) => {
          const el = [...document.querySelectorAll('p')].find((p) => /^«.*»$/.test(p.textContent.trim()));
          if (el) el.textContent = `«${text}»`;
        }, __line);
      }

      const m = await page.evaluate(() => {
        const panel = document.querySelector('[data-variant="parchment"]');
        const body = panel.querySelector('.overflow-y-auto');
        const btn = [...panel.querySelectorAll('button')].find((b) => b.textContent.includes('Retomar el mando'));
        const title = [...panel.querySelectorAll('*')].find((e) => e.textContent.trim() === 'Libro de cuentas del Escribano');
        const inView = (el) => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= window.innerHeight && r.left >= 0 && r.right <= window.innerWidth; };
        return {
          panelFits: panel.scrollWidth <= panel.clientWidth,
          bodyFits: body.scrollWidth <= body.clientWidth,
          docFits: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
          pageScroll: document.documentElement.scrollHeight > window.innerHeight,
          bodyInternalScroll: body.scrollHeight > body.clientHeight,
          btnVisible: !!btn && inView(btn),
          titleVisible: !!title && inView(title),
          btnHeight: btn ? Math.round(btn.getBoundingClientRect().height) : 0,
        };
      });
      const ok = m.panelFits && m.bodyFits && m.docFits && m.btnVisible && m.titleVisible && m.btnHeight >= 44 && errors.length === 0;
      if (!ok) failed = true;

      const buf = await page.screenshot();
      const file = `reporte_${name}.webp`;
      const info = await sharp(buf).webp({ quality: 82 }).toFile(path.join(EVID, file));
      const line = `${file} ${info.width}x${info.height} ${(info.size / 1024).toFixed(0)}KB | scrollWidth<=clientWidth: panel=${m.panelFits} cuerpo=${m.bodyFits} documento=${m.docFits} | titulo visible=${m.titleVisible} boton visible=${m.btnVisible} (alto ${m.btnHeight}px) | scroll interno=${m.bodyInternalScroll} scroll de pagina=${m.pageScroll} | errores de consola=${errors.length} | ${ok ? 'OK' : 'FALLA'}`;
      console.log(line);
      results.push(line, ...errors.map((e) => `  error: ${e}`));
      await ctx.close();
    }
  } finally {
    await browser.close();
  }
  fs.writeFileSync(path.join(EVID, 'consola.txt'), [
    `# reporte_escribano evidencia (Playwright ${W}x${H} @2x, ${new Date().toISOString()})`,
    ...results,
  ].join('\n') + '\n');
  if (failed) process.exitCode = 1;
}

run().catch((e) => { console.error(e); process.exit(1); });
