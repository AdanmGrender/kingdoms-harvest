import { createRequire } from 'node:module';
const req = createRequire('D:/Proyectos/kingdoms-harvest/node_modules/x.js');
const { chromium } = req('playwright');
const URL = 'http://localhost:5173';
const browser = await chromium.launch({ channel: 'chromium' });
const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const reqs = [];
page.on('response', (r) => { if (/assets\/b\/(map|menu)/.test(r.url())) reqs.push(r.status() + ' ' + r.url()); });
await page.addInitScript(() => { localStorage.setItem('kh_device_id', 'capturas-probe'); localStorage.setItem('kh_ambient_fx', 'false'); localStorage.setItem('kh_tutorial_done', '1'); });
await page.goto(URL + '/', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !!window.__gameStore, null, { timeout: 30000 });
await page.waitForFunction(() => !window.__gameStore.getState().isLoading, null, { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(1500);
await page.evaluate(() => window.__gameStore.getState().enterGame());
await page.waitForFunction(() => window.__phaserGame && window.__phaserGame.scene.isActive('HubSceneB'), null, { timeout: 45000 });
await page.waitForTimeout(2500);
for (const t of ['system', 'galaxy']) {
  await page.evaluate((t) => { const s = window.__gameStore.getState(); s.clearOverlay(); s.setOverlay(t, {}); }, t);
  await page.waitForTimeout(2500);
  const info = await page.evaluate(() => [...document.querySelectorAll('.kh-panel')].map((e) => ({ cls: e.className.slice(0, 40), bi: getComputedStyle(e).backgroundImage.slice(0, 120), bc: getComputedStyle(e).backgroundColor })));
  console.log(t, JSON.stringify(info));
}
console.log(reqs.join('\n'));
await browser.close();
