'use strict';
/**
 * contact_sheet_b.js — hoja de contacto oscura (#1a1512) para revisar arte de la dirección B.
 *
 *   node scripts/contact_sheet_b.js --out specs/<f>/evidencia/contact_x.webp [--cols 4] [--tile 360] <archivos|carpetas>…
 *
 * Arma un .html en el scratch (KH_SCRATCH o el tmp del sistema), lo abre con Playwright vía goto(file://…)
 * (setContent no puede cargar imágenes file://) y guarda la captura de página completa como webp con sharp.
 * Cada celda muestra la imagen a alto fijo (--tile px) con su nombre y tamaño real debajo.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');
const sharp = require('sharp');
const { chromium } = require('playwright');

function parseArgs(argv) {
  const a = { out: null, cols: 4, tile: 360, inputs: [] };
  for (let i = 2; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--out') a.out = argv[++i];
    else if (t === '--cols') a.cols = Number(argv[++i]);
    else if (t === '--tile') a.tile = Number(argv[++i]);
    else a.inputs.push(t);
  }
  return a;
}

function expand(inputs) {
  const files = [];
  for (const inp of inputs) {
    const abs = path.resolve(inp);
    if (fs.statSync(abs).isDirectory()) {
      for (const f of fs.readdirSync(abs).sort()) if (/\.(webp|png|jpe?g)$/i.test(f)) files.push(path.join(abs, f));
    } else files.push(abs);
  }
  return files;
}

async function main() {
  const a = parseArgs(process.argv);
  if (!a.out || !a.inputs.length) {
    console.error('Uso: node scripts/contact_sheet_b.js --out <x.webp> [--cols N] [--tile px] <archivos|carpetas>…');
    process.exitCode = 1; return;
  }
  const files = expand(a.inputs);
  const cells = [];
  for (const f of files) {
    const m = await sharp(f).metadata();
    cells.push(`<figure><img src="${pathToFileURL(f).href}"><figcaption>${path.basename(path.dirname(f))}/`
      + `${path.basename(f)} · ${m.width}×${m.height}</figcaption></figure>`);
  }
  const html = `<!doctype html><meta charset="utf-8"><style>
    body { margin: 0; padding: 16px; background: #1a1512; color: #d9c9a8; font: 13px monospace; }
    .grid { display: inline-grid; grid-template-columns: repeat(${a.cols}, max-content); gap: 18px; align-items: end; }
    figure { margin: 0; text-align: center; }
    img { height: ${a.tile}px; width: auto; display: block; margin: 0 auto 6px; outline: 1px dashed #3a312a; }
  </style><div class="grid">${cells.join('')}</div>`;
  const tmpDir = process.env.KH_SCRATCH || os.tmpdir();
  fs.mkdirSync(tmpDir, { recursive: true });
  const htmlPath = path.join(tmpDir, `contact_${Date.now()}.html`);
  fs.writeFileSync(htmlPath, html);
  const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=d3d11', '--enable-gpu'] });
  try {
    const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
    await page.goto(pathToFileURL(htmlPath).href);
    await page.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0));
    const size = await page.evaluate(() => {
      const g = document.querySelector('.grid').getBoundingClientRect();
      return { w: Math.ceil(g.right + 16), h: Math.ceil(g.bottom + 16) };
    });
    await page.setViewportSize({ width: size.w, height: Math.min(size.h, 16000) });
    const png = await page.screenshot({ fullPage: true });
    fs.mkdirSync(path.dirname(path.resolve(a.out)), { recursive: true });
    await sharp(png).webp({ quality: 85 }).toFile(a.out);
    console.log(`✓ ${a.out} ${size.w}x${size.h} (${files.length} imágenes)`);
  } finally {
    await browser.close();
    fs.rmSync(htmlPath, { force: true });
  }
}

main().catch((e) => { console.error('✗', e.message); process.exitCode = 1; });
