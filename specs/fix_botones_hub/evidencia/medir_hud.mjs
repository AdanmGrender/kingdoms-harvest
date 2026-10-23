/**
 * medir_hud.mjs — mide el encuadre de los botones del hub (fix_botones_hub #13).
 *
 *   node specs/fix_botones_hub/evidencia/medir_hud.mjs --label antes|despues [--url http://localhost:5173]
 *
 * Playwright 412×860 y 360×740 @2x (Chromium con GPU, como el resto de la evidencia). Requiere Vite dev con el
 * proxy a un server con SKIP_AUTH=true. Resuelve playwright/sharp desde KH_NODE_MODULES (carpeta node_modules
 * que los tenga; en el worktree viven en el repo principal) o desde node_modules locales.
 * Escribe medidas_<label>.json y las capturas hub_<label>[_412|_360].webp junto al script.
 * Exit code 1 si alguna aserción falla (en "antes" se espera que falle).
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const NM = process.env.KH_NODE_MODULES || 'D:/Proyectos/kingdoms-harvest/node_modules';
const req = createRequire(path.join(NM, 'x.js'));
const { chromium } = req('playwright');
const sharp = req('sharp');

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const LABEL = arg('label', 'despues');
const URL = arg('url', 'http://localhost:5191');
const VIEWPORTS = [{ w: 412, h: 860 }, { w: 360, h: 740 }];
const TOL = { size: 1, x: 1, gap: 2, icon: 2 };

// Todo se calcula dentro de la página con getBoundingClientRect.
function measure() {
  const r = (el) => {
    const b = el.getBoundingClientRect();
    return { x: +b.x.toFixed(1), y: +b.y.toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1),
      right: +b.right.toFixed(1), bottom: +b.bottom.toFixed(1) };
  };
  const label = (b) => (b.innerText || b.getAttribute('aria-label') || b.title || '').replace(/\s+/g, ' ').trim();
  const info = (b, group) => {
    const box = r(b);
    const icon = b.querySelector('.sprite-icon, [data-missing-icon]');
    const ib = icon ? r(icon) : null;
    const cx = (o) => o.x + o.w / 2;
    // Texto y etiquetas: cualquier descendiente con texto propio no debe desbordar su caja.
    const clipped = [b, ...b.querySelectorAll('span')].filter((e) => e.scrollWidth > e.clientWidth + 0).map((e) => e.className || e.tagName);
    const cxp = box.x + box.w / 2;
    const cyp = box.y + box.h / 2;
    const top = document.elementFromPoint(cxp, cyp);
    return {
      group, label: label(b), ...box,
      iconCenterDx: ib ? +(cx(ib) - cx(box)).toFixed(1) : null,
      iconBox: ib,
      clipped,
      iconSize: ib ? ib.w : null,
      vOverflow: b.scrollHeight - b.clientHeight,
      iconInside: ib ? (ib.x >= box.x && ib.right <= box.right && ib.y >= box.y && ib.bottom <= box.bottom) : null,
      contentInside: [...b.children].filter((c) => !c.className.toString().includes('absolute')).every((c) => {
        const cb = c.getBoundingClientRect();
        return cb.top >= box.y - 0.5 && cb.bottom <= box.bottom + 0.5 && cb.left >= box.x - 0.5 && cb.right <= box.right + 0.5;
      }),
      hit: !!top && top.closest('button') === b,
      hitBy: top ? (top.closest('button') ? label(top.closest('button')) : top.tagName) : null,
    };
  };
  const GROUPS = [
    ['izq', 'Marea'], ['der', 'Tech'], ['nav', 'Héroes'],
  ];
  const out = { groups: {}, ops: [], panels: [], viewport: [innerWidth, innerHeight], docScroll: [document.documentElement.scrollWidth, document.documentElement.scrollHeight] };
  const parents = new Set([...document.querySelectorAll('button.kh-iconbtn')].map((b) => b.parentElement));
  for (const p of parents) {
    const text = p.innerText;
    const g = GROUPS.find(([, t]) => text.includes(t));
    const name = (p.dataset && p.dataset.hud) || (g ? g[0] : 'otro');
    out.groups[name] = [...p.children].filter((c) => c.matches('button.kh-iconbtn')).map((b) => info(b, name));
  }
  const opsBtn = [...document.querySelectorAll('button')].find((b) => /Operaciones/.test(b.innerText));
  if (opsBtn) out.ops = [...opsBtn.parentElement.children].filter((c) => c.tagName === 'BUTTON').map((b) => info(b, 'ops'));
  const panel = (name, el) => { if (el) out.panels.push({ name, ...r(el) }); };
  const topBar = document.querySelector('[data-resource]');
  panel('TopResourceBar', topBar && (topBar.closest('.absolute') || topBar.parentElement));
  const objetivo = [...document.querySelectorAll('span')].find((s) => /Objetivo:/.test(s.textContent));
  const rail = objetivo && objetivo.closest('div');
  panel('QuestRail', rail);
  if (rail) {
    const qb = rail.querySelector('button');
    const lineH = (e) => parseFloat(getComputedStyle(e).lineHeight) || 0;
    const txt = qb && qb.querySelector('span');
    out.quest = {
      rail: { scrollWidth: rail.scrollWidth, clientWidth: rail.clientWidth, overflowX: getComputedStyle(rail).overflowX },
      button: qb ? { scrollWidth: qb.scrollWidth, clientWidth: qb.clientWidth, title: qb.title, text: qb.textContent } : null,
      texto: txt ? { scrollWidth: txt.scrollWidth, clientWidth: txt.clientWidth, lineas: Math.round(txt.getBoundingClientRect().height / (lineH(txt) || 1)),
        scrollHeight: txt.scrollHeight, clientHeight: txt.clientHeight } : null,
    };
  }
  return out;
}

function checks(m, vp) {
  const res = [];
  const add = (id, ok, detalle) => res.push({ id, ok, detalle });
  const near = (arr, k, tol) => (arr.length ? Math.max(...arr.map((a) => a[k])) - Math.min(...arr.map((a) => a[k])) <= tol : true);
  const spread = (arr, k) => (arr.length ? +(Math.max(...arr.map((a) => a[k])) - Math.min(...arr.map((a) => a[k]))).toFixed(1) : 0);
  const gaps = (arr) => { const s = [...arr].sort((a, b) => a.y - b.y); return s.slice(1).map((b, i) => +(b.y - s[i].bottom).toFixed(1)); };

  const lateral = { izq: m.groups.izq || [], der: m.groups.der || [] };
  add('grupos_presentes', !!(m.groups.izq && m.groups.der && m.groups.nav) && m.ops.length === 4,
    `grupos=${Object.keys(m.groups).join(',')} ops=${m.ops.length}`);
  for (const [col, arr] of Object.entries(lateral)) {
    add(`${col}_mismo_ancho`, near(arr, 'w', TOL.size), `dispersión w=${spread(arr, 'w')} (tol ${TOL.size})`);
    add(`${col}_mismo_alto`, near(arr, 'h', TOL.size), `dispersión h=${spread(arr, 'h')} (tol ${TOL.size})`);
    add(`${col}_mismo_x`, near(arr, 'x', TOL.x), `dispersión x=${spread(arr, 'x')} (tol ${TOL.x})`);
  }
  for (const name of ['izq', 'der']) {
    const g = gaps(m.groups[name] || []);
    add(`${name}_gap_constante`, g.length === 0 || Math.max(...g) - Math.min(...g) <= TOL.gap, `gaps=${JSON.stringify(g)} (tol ${TOL.gap})`);
  }
  const nav = [...(m.groups.nav || [])].sort((a, b) => a.x - b.x);
  const navGaps = nav.slice(1).map((b, i) => +(b.x - nav[i].right).toFixed(1));
  add('nav_gap_constante', navGaps.length === 0 || Math.max(...navGaps) - Math.min(...navGaps) <= TOL.gap, `gaps=${JSON.stringify(navGaps)} (tol ${TOL.gap})`);
  add('nav_laterales_mismo_tamano', nav.length === 3 ? Math.abs(nav[0].w - nav[2].w) <= 1 && Math.abs(nav[0].h - nav[2].h) <= 1 : false,
    nav.map((b) => `${b.label}:${b.w}x${b.h}`).join(' '));
  add('nav_alineada_al_fondo', near(nav, 'bottom', TOL.x), `dispersión bottom=${spread(nav, 'bottom')} (tol ${TOL.x})`);

  const all = [...Object.values(m.groups).flat(), ...m.ops];
  const items = [...all.map((b) => ({ name: `${b.group}:${b.label}`, ...b })), ...m.panels];
  const inside = items.filter((b) => b.x < -0.5 || b.y < -0.5 || b.right > vp.w + 0.5 || b.bottom > vp.h + 0.5);
  add('dentro_del_viewport', inside.length === 0, inside.map((b) => b.name).join(' | ') || 'ok');
  const overlaps = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i]; const b = items[j];
      const ox = Math.min(a.right, b.right) - Math.max(a.x, b.x);
      const oy = Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y);
      if (ox > 0.5 && oy > 0.5) overlaps.push(`${a.name} × ${b.name} (${ox.toFixed(0)}×${oy.toFixed(0)})`);
    }
  }
  add('sin_solapes', overlaps.length === 0, overlaps.join(' | ') || 'ok');
  // "Operaciones" lleva ícono + texto en línea: no aplica el centrado horizontal del ícono solo.
  const iconOff = all.filter((b) => b.iconCenterDx !== null && b.group !== 'ops_texto' && !(b.group === 'ops' && /Operaciones/.test(b.label))
    && Math.abs(b.iconCenterDx) > TOL.icon);
  add('icono_centrado', iconOff.length === 0, iconOff.map((b) => `${b.group}:${b.label} dx=${b.iconCenterDx}`).join(' | ') || 'ok');
  const clipped = all.filter((b) => b.clipped.length);
  add('etiquetas_sin_recorte', clipped.length === 0, clipped.map((b) => `${b.group}:${b.label}`).join(' | ') || 'ok');
  const q = m.quest;
  const qBad = [];
  if (!q) qBad.push('QuestRail no encontrado');
  else {
    if (q.rail.scrollWidth > q.rail.clientWidth) qBad.push(`riel ${q.rail.scrollWidth}>${q.rail.clientWidth}`);
    if (q.rail.overflowX === 'auto' || q.rail.overflowX === 'scroll') qBad.push(`riel overflow-x=${q.rail.overflowX}`);
    if (q.button && q.button.scrollWidth > q.button.clientWidth) qBad.push(`botón ${q.button.scrollWidth}>${q.button.clientWidth}`);
    if (q.texto && q.texto.scrollWidth > q.texto.clientWidth) qBad.push(`texto ${q.texto.scrollWidth}>${q.texto.clientWidth}`);
  }
  add('quest_sin_recorte', qBad.length === 0, qBad.join(' | ') || `ok (${q && q.button ? `"${q.button.text}" en ${q.texto ? q.texto.lineas : '?'} línea(s), title="${q.button.title}"` : ''})`);
  add('quest_texto_completo', !!(q && q.texto && q.texto.scrollHeight <= q.texto.clientHeight + 1),
    q && q.texto ? `scrollHeight=${q.texto.scrollHeight} clientHeight=${q.texto.clientHeight}` : 'sin texto');
  const small = all.filter((b) => b.w < 44 || b.h < 44);
  const castle = (m.groups.izq || []).find((b) => /Bastión/.test(b.label));
  add('castle_icono_40', !!castle && castle.iconSize >= 40, castle ? `ícono ${castle.iconSize}px (>= 40)` : 'Bastión no encontrado en riel izq');
  const rails = [...(m.groups.izq || []), ...(m.groups.der || [])];
  const over = rails.filter((b) => b.vOverflow > 0 || b.iconInside === false || !b.contentInside);
  add('riel_contenido_dentro_del_marco', over.length === 0,
    over.map((b) => `${b.group}:${b.label} vOverflow=${b.vOverflow} iconInside=${b.iconInside} contentInside=${b.contentInside}`).join(' | ') || `ok (scrollHeight<=clientHeight, ícono y etiqueta dentro del marco en ${rails.length} botones)`);
  add('tactiles_44', small.length === 0, small.map((b) => `${b.group}:${b.label} ${b.w}x${b.h}`).join(' | ') || 'ok');
  const nohit = all.filter((b) => !b.hit);
  add('clickeables_elementFromPoint', nohit.length === 0, nohit.map((b) => `${b.group}:${b.label} tapado por ${b.hitBy}`).join(' | ') || 'ok');
  return res;
}

const results = [];
let failed = 0;
for (const vp of VIEWPORTS) {
  const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=d3d11', '--enable-gpu'] });
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 2, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String((e && e.stack) || e)));
  await page.addInitScript((did) => {
    try {
      localStorage.setItem('kh_device_id', did);
      localStorage.setItem('kh_ambient_fx', 'false');
      localStorage.setItem('kh_tutorial_done', '1');
    } catch { /* sin storage */ }
  }, `medir-hud-${Date.now().toString(36)}`);
  await page.goto(`${URL}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__gameStore, null, { timeout: 30000 });
  await page.waitForFunction(() => !window.__gameStore.getState().isLoading, null, { timeout: 30000 }).catch(() => {});
  await page.evaluate(() => window.__gameStore.getState().enterGame());
  await page.waitForFunction(() => window.__phaserGame && window.__phaserGame.scene.isActive('HubSceneB'), null, { timeout: 45000 });
  await page.waitForTimeout(2500);
  // Solo presentación (no toca el server): evento activo con cuenta atrás larga, como en la captura de referencia.
  await page.evaluate(() => {
    const s = window.__gameStore;
    s.getState().dismissOfflineReport && s.getState().dismissOfflineReport();
    s.setState({ activeEvent: { id: 1, name: 'Marea de ceniza', description: 'Evento de prueba', color: '#e07b2a',
      ends_at: new Date(Date.now() + (2 * 3600 + 38 * 60) * 1000).toISOString() } });
  });
  await page.waitForTimeout(1200);
  const m = await page.evaluate(measure);
  const cs = checks(m, vp);
  failed += cs.filter((c) => !c.ok).length;
  const shotName = LABEL === 'antes' && vp.w === 412 ? 'hub_antes.webp' : `hub_${LABEL}_${vp.w}.webp`;
  const buf = await page.screenshot();
  const info = await sharp(buf).webp({ quality: 85 }).toFile(path.join(HERE, shotName));
  results.push({ viewport: `${vp.w}x${vp.h}`, captura: `${shotName} ${info.width}x${info.height}`, aserciones: cs, consolaErrores: errors, medidas: m });
  await browser.close();
}

const resumen = results.map((r) => ({
  viewport: r.viewport, fallan: r.aserciones.filter((c) => !c.ok).map((c) => c.id), consolaErrores: r.consolaErrores.length,
}));
fs.writeFileSync(path.join(HERE, `medidas_${LABEL}.json`), JSON.stringify({ label: LABEL, tolerancias: TOL, resumen, results }, null, 2));
for (const r of results) {
  console.log(`== ${r.viewport} (${r.captura})`);
  for (const c of r.aserciones) console.log(`${c.ok ? 'OK  ' : 'FAIL'} ${c.id}: ${c.detalle}`);
  for (const b of [...Object.values(r.medidas.groups).flat(), ...r.medidas.ops]) {
    console.log(`  ${b.group.padEnd(10)} ${b.label.padEnd(20)} x=${b.x} y=${b.y} w=${b.w} h=${b.h} iconDx=${b.iconCenterDx}`);
  }
  console.log(`consola: ${r.consolaErrores.length} errores${r.consolaErrores.length ? ` -> ${r.consolaErrores.slice(0, 3).join(' | ')}` : ''}`);
}
console.log(`\nTOTAL aserciones fallidas: ${failed}`);
process.exit(failed ? 1 : 0);
