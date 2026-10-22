'use strict';
/**
 * icon_contact_sheet.js — hoja de contacto de los íconos B (R42): cada ícono a 24, 32 y 48 px
 * sobre `kh-oak` (#2a2119), con su nombre debajo. Sale en webp (playwright + sharp).
 *
 *   node scripts/icon_contact_sheet.js [--sheet client/public/assets/b/ui/icons.webp]
 *        [--config art-b/uikit/candidate/grimIconSheet.generated.js]
 *        [--out specs/ui_kit_b/evidencia/iconos_contacto.webp] [--cols 6]
 *
 * Requiere NODE_PATH al node_modules con playwright y sharp (repo principal).
 * El config se lee como texto (es ESM generado); no se importa.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');
const sharp = require('sharp');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
function arg(n, d) { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; }
const SHEET = path.resolve(ROOT, arg('sheet', 'client/public/assets/b/ui/icons.webp'));
const CONFIG = path.resolve(ROOT, arg('config', 'art-b/uikit/candidate/grimIconSheet.generated.js'));
const OUT = path.resolve(ROOT, arg('out', 'specs/ui_kit_b/evidencia/iconos_contacto.webp'));
const COLS = Number(arg('cols', 6));
const SIZES = [24, 32, 48];

(async () => {
  const cfg = fs.readFileSync(CONFIG, 'utf8');
  const num = (k) => Number(new RegExp(`${k} = (\\d+)`).exec(cfg)[1]);
  const W = num('GRIM_SHEET_W'), H = num('GRIM_SHEET_H'), CELL = num('GRIM_CELL');
  const icons = [...cfg.matchAll(/^\s+([a-z_]+): \{ col: (\d+), row: (\d+) \},/gm)].map((m) => ({ name: m[1], col: +m[2], row: +m[3] }));
  const url = pathToFileURL(SHEET).href;
  const cell = (ic, s) => `<span class="i" style="width:${s}px;height:${s}px;background:url(${url}) ${-ic.col * s}px ${-ic.row * s}px/${(W / CELL) * s}px ${(H / CELL) * s}px no-repeat"></span>`;
  const figs = icons.map((ic) => `<figure><div class="r">${SIZES.map((s) => cell(ic, s)).join('')}</div><figcaption>${ic.name}</figcaption></figure>`).join('');
  const html = `<!doctype html><meta charset="utf-8"><style>
    body{margin:0;padding:14px;background:#2a2119;color:#d9c9a8;font:11px monospace}
    h1{font:12px monospace;margin:0 0 10px;color:#a89873}
    .grid{display:grid;grid-template-columns:repeat(${COLS},max-content);gap:10px 14px}
    figure{margin:0;padding:6px 8px;background:#3d3024;border-radius:3px}
    .r{display:flex;align-items:flex-end;gap:10px}
    .i{display:inline-block;image-rendering:auto}
    figcaption{margin-top:4px;text-align:center}
  </style><h1>Íconos B — ${icons.length} · 24 / 32 / 48 px sobre kh-oak (#2a2119)</h1><div class="grid">${figs}</div>`;
  const tmp = process.env.KH_SCRATCH || os.tmpdir();
  fs.mkdirSync(tmp, { recursive: true });
  const htmlPath = path.join(tmp, `iconos_contacto_${Date.now()}.html`);
  fs.writeFileSync(htmlPath, html);
  const browser = await chromium.launch({ channel: 'chromium', args: ['--allow-file-access-from-files'] });
  try {
    const page = await browser.newPage({ viewport: { width: 900, height: 600 }, deviceScaleFactor: 1 });
    await page.goto(pathToFileURL(htmlPath).href);
    await page.waitForTimeout(500);
    const png = await page.screenshot({ fullPage: true });
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    await sharp(png).webp({ quality: 90 }).toFile(OUT);
    const m = await sharp(OUT).metadata();
    console.log(`✓ ${path.relative(ROOT, OUT)} ${m.width}×${m.height} (${icons.length} íconos × ${SIZES.join('/')} px)`);
  } finally {
    await browser.close();
    fs.rmSync(htmlPath, { force: true });
  }
})().catch((e) => { console.error('✗', e.message); process.exitCode = 1; });
