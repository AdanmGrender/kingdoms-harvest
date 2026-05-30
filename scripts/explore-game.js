/**
 * Drive the game with Playwright and capture screenshot + console state for
 * every reachable UI surface. Output goes to screenshots/explore/<n>-<id>.png
 * plus a single explore-report.md with collected errors per panel.
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const URL = 'https://adamn-vps.duckdns.org/?preview=world';
const OUT_DIR = path.join(__dirname, '..', 'screenshots', 'explore');
const REPORT = path.join(__dirname, '..', 'screenshots', 'explore-report.md');

fs.mkdirSync(OUT_DIR, { recursive: true });

const surfaces = [
  // [id, instruction-fn(page)]
  ['00-initial',        async () => {}],
  ['10-sidebar-castle', async (p) => p.evaluate(() => document.querySelector('button[title="Castillo"]')?.click())],
  ['11-sidebar-missions', async (p) => p.evaluate(() => document.querySelector('button[title="Misiones"]')?.click())],
  ['12-sidebar-build',  async (p) => p.evaluate(() => document.querySelector('button[title="Construir"]')?.click())],
  ['13-sidebar-explore',async (p) => p.evaluate(() => document.querySelector('button[title="Explorar"]')?.click())],
  ['14-sidebar-settings',async (p) => p.evaluate(() => document.querySelector('button[title="Ajustes"]')?.click())],
  ['20-event-logros',   async (p) => p.evaluate(() => document.querySelector('button[title="Logros"]')?.click())],
  ['21-event-tech',     async (p) => p.evaluate(() => document.querySelector('button[title="Tech"]')?.click())],
  ['22-event-world',    async (p) => p.evaluate(() => document.querySelector('button[title="Mundo"]')?.click())],
  ['30-bottom-heroes',  async (p) => p.evaluate(() => {
    // The Heroes button in BottomNavBar — find by text label.
    const btns = Array.from(document.querySelectorAll('button'));
    btns.find((b) => b.textContent.includes('Héroes') && !b.textContent.includes('Aldea'))?.click();
  })],
  ['31-bottom-mundo',   async (p) => p.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    btns.find((b) => b.textContent.trim() === '🗺️' || b.textContent.includes('Mundo'))?.click();
  })],
];

// Then the MetaPanel tabs once 'meta' is open
const metaTabs = ['achievements','tournaments','wars','rankings','market','alliances','tech','factions','world'];

async function clickByText(page, text) {
  return page.evaluate((t) => {
    const btns = Array.from(document.querySelectorAll('button'));
    const hit = btns.find((b) => b.textContent.includes(t));
    if (hit) { hit.click(); return true; }
    return false;
  }, text);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  const allErrors = [];
  let currentSurface = 'startup';
  page.on('console', (msg) => {
    if (msg.type() === 'error') allErrors.push({ surface: currentSurface, kind: 'console.error', text: msg.text() });
  });
  page.on('pageerror', (e) => allErrors.push({ surface: currentSurface, kind: 'pageerror', text: e.message + '\n' + (e.stack || '') }));

  console.log(`→ loading ${URL}`);
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForSelector('canvas', { timeout: 30000 });
  await page.waitForTimeout(8000); // let world finish loading

  const closeOverlay = async () => {
    // Click the ✕ if present, or press Escape, or click on canvas.
    await page.evaluate(() => {
      const x = Array.from(document.querySelectorAll('button')).find((b) => /^✕|×$/u.test(b.textContent.trim()));
      if (x) x.click();
    });
    await page.waitForTimeout(300);
  };

  for (const [id, act] of surfaces) {
    currentSurface = id;
    console.log(`→ ${id}`);
    await closeOverlay();
    try { await act(page); } catch (e) { allErrors.push({ surface: id, kind: 'click-fail', text: e.message }); }
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(OUT_DIR, `${id}.png`), fullPage: false });
  }

  // MetaPanel tabs — open via the EventSidebar 'Mundo' shortcut first (which lands on world tab)
  await closeOverlay();
  await page.evaluate(() => document.querySelector('button[title="Logros"]')?.click());
  await page.waitForTimeout(800);
  for (const tab of metaTabs) {
    currentSurface = `40-meta-${tab}`;
    console.log(`→ ${currentSurface}`);
    await clickByText(page, tab);
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(OUT_DIR, `${currentSurface}.png`), fullPage: false });
  }

  // Write report
  const lines = ['# Game Explorer Report\n', `Generated: ${new Date().toISOString()}\n`, `URL: ${URL}\n\n`];
  const bySurface = {};
  for (const e of allErrors) {
    if (!bySurface[e.surface]) bySurface[e.surface] = [];
    bySurface[e.surface].push(e);
  }
  if (Object.keys(bySurface).length === 0) {
    lines.push('No console errors or page errors observed.\n');
  } else {
    for (const surf of Object.keys(bySurface).sort()) {
      lines.push(`## ${surf}\n`);
      for (const e of bySurface[surf]) {
        lines.push(`- **${e.kind}**: ${e.text.split('\n')[0]}`);
      }
      lines.push('');
    }
  }
  fs.writeFileSync(REPORT, lines.join('\n'));
  console.log(`→ report: ${REPORT}`);

  await browser.close();
})().catch((e) => {
  console.error('explorer failed:', e);
  process.exit(1);
});
