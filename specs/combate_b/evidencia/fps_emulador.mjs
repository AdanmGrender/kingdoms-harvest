// FPS reales en el emulador kh_pixel7 (Chrome Android vía CDP). T11/Q9.
// Uso: adb forward tcp:9222 localabstract:chrome_devtools_remote; node fps_emulador.mjs [medium|low]
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const NM = process.env.KH_NODE_MODULES || 'D:/Proyectos/kingdoms-harvest/node_modules';
const req = createRequire(NM + '/x.js');
const { chromium } = req('playwright');
const QUALITY = process.argv[2] || 'medium';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const stats = (xs) => {
  if (!xs.length) return { n: 0, avg: null, p5: null, min: null };
  const s = [...xs].sort((a, b) => a - b);
  return { n: xs.length, avg: Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10, p5: s[Math.floor(0.05 * (s.length - 1))], min: s[0] };
};
const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const ctx = browser.contexts()[0];
const page = ctx.pages()[0];
await ctx.addInitScript(({ q }) => {
  localStorage.setItem('kh_device_id', 'captura-combate-b-0001');
  localStorage.setItem('kh_combat_quality', q);
  localStorage.setItem('kh_tutorial_done', '1');
  localStorage.setItem('kh_ambient_fx', 'false');
  let n = 0;
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => raf((t) => { n += 1; cb(t); });
  window.__fps = { on: false, samples: [] };
  setInterval(() => { if (window.__fps.on) window.__fps.samples.push(n * 2); n = 0; }, 500);
}, { q: QUALITY });
await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__gameStore, null, { timeout: 60000 });
await page.evaluate(() => window.__gameStore.getState().enterGame());
await page.waitForFunction(() => window.__phaserGame && window.__phaserGame.scene.isActive('HubSceneB'), null, { timeout: 90000 });
await page.waitForTimeout(3000);
await page.evaluate(() => { const s = window.__gameStore.getState(); s.dismissOfflineReport && s.dismissOfflineReport(); });
const info = await page.evaluate(() => {
  const c = document.createElement('canvas'); const gl = c.getContext('webgl2') || c.getContext('webgl'); const e = gl && gl.getExtension('WEBGL_debug_renderer_info');
  return { ua: navigator.userAgent, gpu: e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'desconocido', vw: innerWidth, vh: innerHeight, dpr: devicePixelRatio };
});
await page.evaluate(() => window.__gameStore.getState().loadCampaignMap());
let entrada = null;
for (let i = 0; i < 5 && !entrada; i++) {
  const res = await page.evaluate(async () => {
    const s = window.__gameStore.getState();
    try { const r = await s.enterNode('a1n3'); if (r.kind === 'combat') s.setOverlay('combat_instance', {}); return { kind: r.kind, engine: r.state && r.state.engine }; } catch (e) { return { error: String(e) }; }
  });
  if (!res.error) entrada = res; else await page.waitForTimeout(15000);
}
console.error('entrada', entrada);
await page.waitForTimeout(1500);
await page.evaluate(() => { window.__fps.samples.length = 0; window.__fps.on = true; });
const t0 = Date.now(); let fin = null; let ultima = -1; let lastChange = Date.now(); let manual = 0;
while (Date.now() - t0 < 150000) {
  const st = await page.evaluate(() => { const r = window.__gameStore.getState().activeRun; const t = document.body.innerText; return { round: r ? r.state.round : null, banner: /¡Victoria!/.test(t) ? 'victoria' : /Derrota/.test(t) ? 'derrota' : null }; });
  if (st.banner) { fin = st.banner; break; }
  if (st.round !== ultima) { ultima = st.round; lastChange = Date.now(); }
  else if (Date.now() - lastChange > 9000) { await page.getByRole('button', { name: 'Avanzar ronda' }).click({ timeout: 2000 }).catch(() => {}); lastChange = Date.now(); manual++; }
  await page.waitForTimeout(100);
}
await page.evaluate(() => { window.__fps.on = false; });
const muestras = await page.evaluate(() => window.__fps.samples.slice());
const out = {
  dispositivo: 'emulador kh_pixel7 (AVD, Android 15, x86_64) · Chrome 124 Android (CDP vía adb forward)', ...info, calidad: QUALITY, combate: 'a1n3', resultado: fin, avanceManual: manual,
  duracionS: Math.round((Date.now() - t0) / 100) / 10,
  metodo: 'frames de requestAnimationFrame por ventana de 500 ms (×2), solo durante el combate (Phaser avanza por rAF)',
  ...stats(muestras), muestras,
};
fs.writeFileSync(path.join(HERE, 'despues', `fps_emulador_${QUALITY}.json`), JSON.stringify(out, null, 2));
console.log(JSON.stringify({ ...out, muestras: undefined }));
await browser.close();
