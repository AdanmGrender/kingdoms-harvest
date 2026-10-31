'use strict';
/**
 * record_poses_demo.js — graba la demo de combate (piloto poses_b) con Playwright, 412×860.
 *   node scripts/record_poses_demo.js --url http://localhost:5174/poses-demo.html --out specs/poses_b_piloto/evidencia/piloto/despues.webm [--reduced]
 * Imprime el fps medio medido dentro de la página (rAF) durante todo el guion.
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const a = { url: 'http://localhost:5174/poses-demo.html', out: 'demo.webm', reduced: false };
for (let i = 2; i < process.argv.length; i++) {
  const t = process.argv[i];
  if (t === '--url') a.url = process.argv[++i];
  else if (t === '--out') a.out = process.argv[++i];
  else if (t === '--reduced') a.reduced = true;
}

(async () => {
  const dir = path.join(process.env.TMPDIR || require('os').tmpdir(), `rec_${Date.now()}`);
  fs.mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({
    viewport: { width: 412, height: 860 }, recordVideo: { dir, size: { width: 412, height: 860 } },
    reducedMotion: a.reduced ? 'reduce' : 'no-preference',
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' || /textura no carg/.test(m.text())) errors.push(m.text()); });
  await page.goto(a.url + (a.reduced ? '?reduced=1' : ''));
  await page.waitForFunction(() => window.__demo && window.__demo.done, null, { timeout: 40000 }).catch((e) => errors.push('timeout: ' + e.message));
  const stats = await page.evaluate(() => ({ fps: window.__demo.fps, frames: window.__demo.frames, ms: Math.round(window.__demo.ms) }));
  await page.waitForTimeout(300);
  const video = page.video();
  await ctx.close();
  fs.mkdirSync(path.dirname(a.out), { recursive: true });
  await video.saveAs(a.out);
  await browser.close();
  console.log(JSON.stringify({ out: a.out, ...stats, errors: errors.slice(0, 5) }));
})();
