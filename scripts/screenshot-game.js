/**
 * Screenshot the running game so Claude can see how it looks.
 *
 *   node scripts/screenshot-game.js                  # defaults to ?iso=1 preview
 *   node scripts/screenshot-game.js --authed         # authenticated mode (needs initData)
 *   node scripts/screenshot-game.js --url <full>     # custom URL
 *   node scripts/screenshot-game.js --out <path>     # custom output path
 *   node scripts/screenshot-game.js --wait 8         # wait seconds before snapping
 *
 * Writes PNG to screenshots/game-<timestamp>.png (or --out path) and prints the
 * absolute path so it can be Read'd right after.
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const DEFAULT_URL = 'https://cars-intake-camcorder-guitars.trycloudflare.com/?iso=1';

function parseArgs(argv) {
  const args = { url: DEFAULT_URL, out: null, wait: 6, zoom: null, width: 1280, height: 800 };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--url') args.url = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--wait') args.wait = Number(argv[++i]);
    else if (a === '--zoom') args.zoom = Number(argv[++i]);
    else if (a === '--width') args.width = Number(argv[++i]);
    else if (a === '--height') args.height = Number(argv[++i]);
  }
  return args;
}

(async () => {
  const args = parseArgs(process.argv);
  const outDir = path.join(__dirname, '..', 'screenshots');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = args.out || path.join(outDir, `game-${Date.now()}.png`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: args.width, height: args.height },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  // Forward console errors — helps diagnose load failures.
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`[console.error] ${msg.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));

  console.log(`→ opening ${args.url}`);
  await page.goto(args.url, { waitUntil: 'networkidle', timeout: 30000 });

  // Wait for the Phaser canvas to exist and have content.
  await page.waitForSelector('canvas', { timeout: 15000 });
  await page.waitForTimeout(args.wait * 1000);

  if (args.zoom) {
    await page.evaluate((z) => {
      const g = window.Phaser?.GAMES?.[0];
      const scene = g?.scene?.getScene?.('WorldScene') || g?.scene?.getScene?.('IsoScene');
      if (scene?.cameras?.main) scene.cameras.main.setZoom(z);
    }, args.zoom);
    await page.waitForTimeout(500);
  }

  await page.screenshot({ path: outFile, fullPage: false });
  console.log(`✓ screenshot saved: ${outFile}`);
  if (errors.length) {
    console.log('--- browser errors ---');
    errors.forEach((e) => console.log(e));
  }

  await browser.close();
})().catch((err) => {
  console.error('screenshot failed:', err);
  process.exit(1);
});
