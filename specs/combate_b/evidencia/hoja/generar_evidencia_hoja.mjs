// T10.6 — Hoja visual de combate (hoja_visual.md): vistas obligatorias, hoja de contacto y medidas V1–V9.
//
// Vistas: 412×860 @2, 360×800 @3 y 1280×800 @1,5 × {1 común (a1n3), 3 comunes (a1n7), 4 en veil_gate (a2n10),
// 1 jefe (a1n9)} + victoria y derrota (a1n3). Escuadra real de 5 héroes (aria, lyra, elena, viktor, shadow).
// Los estados son sintéticos (runId −1, R26: CAMPAIGN no trae enemies[]); `stepInstance` se sustituye en la página
// para no llamar al servidor, y el auto-avance de 2 s queda en pausa durante la captura (`__khHoldAdvance`).
// Medidas (hoja_medidas.json), leídas de la escena real (Phaser) y del DOM, en coordenadas del mundo 824×1720:
//  V1 altos dibujados · V2 pie (fila inferior con alfa) vs. carril, carriles vs. piso del fondo y vs. botones ·
//  V3 solape dentro de cada fila, HUD/botones/barras sobre siluetas y % de CARA tapada por otras filas (píxel a
//  píxel con el alfa real de cada textura) · V4 números flotantes · V5 nombres · V6 caídos · V7 orientación ·
//  V8 cartel · V9 nombres de barras.
// Uso: KH_PREVIEW_URL=http://localhost:5175 node generar_evidencia_hoja.mjs   (--solo-hoja: rehace solo hoja_contacto.webp)
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const NM = process.env.KH_NODE_MODULES || 'D:/Proyectos/kingdoms-harvest/node_modules';
const req = createRequire(path.join(NM, 'x.js'));
const { chromium } = req('playwright');
const sharp = req('sharp');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const { HEROES } = createRequire(import.meta.url)(path.join(ROOT, 'shared', 'gameConfig.js'));
const URL_ = process.env.KH_PREVIEW_URL || 'http://localhost:5175';

const VPS = [
  { w: 412, h: 860, dpr: 2, name: '412x860' },
  { w: 360, h: 800, dpr: 3, name: '360x800' },
  { w: 1280, h: 800, dpr: 1.5, name: '1280x800' },
];
const SQUAD = ['aria', 'lyra', 'elena', 'viktor', 'shadow'];
const ENERGY = [100, 40, 100, 70, 20];
const en = (i, hp = 600, maxHp = 900) => ({ id: `e${i}`, name: `Enemigo ${i + 1}`, hp, maxHp, dps: 40, def: 0, spd: 0 });
const SCEN = [
  { key: '1enemigo', node: { id: 'a1n3', act: 1, type: 'combat', name: 'Merodeadores del Páramo' }, enemies: [en(0)] },
  { key: '3enemigos', node: { id: 'a1n7', act: 1, type: 'combat', name: 'Carroñeros' }, enemies: [en(0), en(1), en(2)] },
  { key: '4enemigos_veil', node: { id: 'a2n10', act: 2, type: 'boss', isBoss: true, name: 'La Voz del Velo' }, enemies: [en(0), en(1), en(2), en(3)] },
  { key: 'jefe', node: { id: 'a1n9', act: 1, type: 'boss', isBoss: true, name: 'Devorador de Almas' }, enemies: [en(0, 2400, 2400)] },
  { key: 'victoria', node: { id: 'a1n3', act: 1, type: 'combat', name: 'Merodeadores del Páramo' }, enemies: [en(0, 60)], result: 'victory' },
  { key: 'derrota', node: { id: 'a1n3', act: 1, type: 'combat', name: 'Merodeadores del Páramo' }, enemies: [en(0)], result: 'defeat' },
];

async function abrir(browser, vp) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: vp.dpr, isMobile: vp.w < 800, hasTouch: true });
  await ctx.addInitScript(() => {
    localStorage.setItem('kh_device_id', 'captura-combate-b-0001');
    localStorage.setItem('kh_combat_quality', 'medium');
    localStorage.setItem('kh_tutorial_done', '1');
    localStorage.setItem('kh_ambient_fx', 'false');
    // pausa del auto-avance de 2 s del panel durante la captura (el resto de temporizadores sigue igual)
    window.__khHoldAdvance = true;
    const st = window.setTimeout.bind(window);
    window.setTimeout = (fn, ms, ...a) => ((window.__khHoldAdvance && ms === 2000) ? 0 : st(fn, ms, ...a));
  });
  const page = await ctx.newPage();
  const errores = [];
  page.on('pageerror', (e) => errores.push(String(e && e.message)));
  page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
  await page.goto(URL_, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__gameStore, null, { timeout: 30000 });
  await page.evaluate(() => window.__gameStore.getState().enterGame());
  await page.waitForFunction(() => window.__phaserGame && window.__phaserGame.scene.isActive('HubSceneB'), null, { timeout: 60000 });
  await page.waitForTimeout(1200);
  await page.evaluate(() => { const s = window.__gameStore.getState(); s.dismissOfflineReport && s.dismissOfflineReport(); });
  return { ctx, page, errores };
}

function estado(esc) {
  const heroes = SQUAD.map((id, i) => ({
    slot: i + 1, heroId: id, class: HEROES[id].class, name: HEROES[id].name, atk: 60, hp: 200, maxHp: 200,
    energy: ENERGY[i], energyMax: 100, alive: true, def: 0, spd: 0,
  }));
  const s0 = { engine: 2, round: 1, maxRounds: 10, shield: 0, log: [], events: [], eventsVersion: 1, enemies: esc.enemies, enemy: esc.enemies[0], heroes };
  if (!esc.result) return { s0 };
  let t = 0; const ev = [];
  const push = (e) => ev.push({ t: ++t, round: 1, ...e });
  let fin;
  if (esc.result === 'victory') {
    push({ kind: 'hit', actor: 'h1', target: 'e0', value: 60, hp: 0 });
    push({ kind: 'death', actor: 'h1', target: 'e0', value: 0 });
    push({ kind: 'end', actor: null, target: null, value: 'victory' });
    const enemies = esc.enemies.map((e) => ({ ...e, hp: 0 }));
    fin = { ...s0, round: 2, enemies, enemy: enemies[0], events: ev };
  } else {
    for (const h of heroes) push({ kind: 'hit', actor: 'e0', target: `h${h.slot}`, value: 200, hp: 0 });
    for (const h of heroes) push({ kind: 'death', actor: 'e0', target: `h${h.slot}`, value: 0 });
    push({ kind: 'end', actor: null, target: null, value: 'defeat' });
    fin = { ...s0, round: 2, heroes: heroes.map((h) => ({ ...h, hp: 0, alive: false, energy: 0 })), events: ev };
  }
  return { s0, fin, roundLog: { round: 1, eventRange: [0, ev.length] } };
}

async function abrirEscenario(page, esc) {
  const { s0, fin, roundLog } = estado(esc);
  await page.evaluate(() => {
    const s = window.__gameStore.getState();
    s.clearActiveRun && s.clearActiveRun();
    s.clearOverlay && s.clearOverlay();
  });
  await page.waitForTimeout(400);
  await page.waitForFunction(() => !window.__combatGame, null, { timeout: 10000 });
  await page.evaluate(({ node, s0, fin, roundLog, result }) => {
    const store = window.__gameStore;
    store.setState({
      stepInstance: async () => {
        if (!result) return new Promise(() => {});
        const run = store.getState().activeRun;
        store.setState({ activeRun: { ...run, state: fin } });
        return { state: fin, roundLog, result, unlocked: [] };
      },
      activeRun: { runId: -1, node, state: s0 },
    });
    store.getState().setOverlay('combat_instance', {});
  }, { node: esc.node, s0, fin: fin || null, roundLog: roundLog || null, result: esc.result || null });
  await page.waitForFunction(() => {
    const g = window.__combatGame; const sc = g && g.scene && g.scene.getScene('combat');
    return sc && sc.ready;
  }, null, { timeout: 30000 });
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await page.waitForTimeout(900);
  if (esc.result) {
    await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => /Avanzar ronda/.test(b.textContent)).click());
    await page.waitForSelector('[data-result-layer]', { timeout: 10000 });
    await page.waitForTimeout(1500);
  }
}

// ── medidas en la página ────────────────────────────────────────────────────
async function medir(page) {
  return page.evaluate(async () => {
    const art = await import('/src/game/combat/artMap.js');
    const fm = await import('/src/game/combat/formation.js');
    const sc = window.__combatGame.scene.getScene('combat');
    const cv = window.__combatGame.canvas;
    const cr = cv.getBoundingClientRect();
    const k = cr.width / 824;
    const toW = (r) => ({ x: (r.left - cr.left) / k, y: (r.top - cr.top) / k, w: r.width / k, h: r.height / k });
    const R = (e) => e.getBoundingClientRect();
    const panel = document.querySelector('[data-enemy-bars]').closest('.fixed');
    const btns = [...panel.querySelectorAll('button')].filter((b) => R(b).width > 0 && !b.classList.contains('kh-close') && !/Avanzar|Volver/.test(b.textContent));
    const heroBtnTop = Math.min(...btns.flatMap((b) => [b, ...b.querySelectorAll('*')]).map((e) => R(e).top));
    const adv = [...panel.querySelectorAll('button')].find((b) => /Avanzar ronda/.test(b.textContent));
    const bars = R(document.querySelector('[data-enemy-bars]'));
    const title = R(panel.querySelector('h2'));
    const close = R(panel.querySelector('.kh-close'));
    const hud = [
      { id: 'barras', ...toW(bars) }, { id: 'titulo', ...toW(title) }, { id: 'cerrar', ...toW(close) },
      ...btns.map((b, i) => ({ id: `boton${i + 1}`, ...toW(new DOMRect(R(b).left, Math.min(R(b).top, ...[...b.querySelectorAll('*')].map((e) => R(e).top)), R(b).width, R(b).bottom - Math.min(R(b).top, ...[...b.querySelectorAll('*')].map((e) => R(e).top))) ) })),
    ];
    if (adv && getComputedStyle(adv.parentElement).visibility !== 'hidden') hud.push({ id: 'avanzar', ...toW(R(adv)) });
    const actores = Object.values(sc.actors).map((a) => {
      const key = a.sp.texture.key;
      const m = /^(hero|enemy):([a-z_]+):([a-z]+)$/.exec(key);
      const g = m ? art.spriteGeom(m[1], m[2], m[3]) : null;
      const s = a.sp.scaleY;
      const sx = a.sp.scaleX;
      const W = a.sp.width; const H = a.sp.height;
      const left = a.c.x + a.sp.x - a.sp.originX * W * sx;
      const top = a.c.y + a.sp.y - a.sp.originY * H * s;
      const fl = a.sp.flipX;
      const alpha = g ? {
        x: left + (fl ? W - 1 - g.r : g.l) * sx, y: top + g.t * s, w: (g.r - g.l + 1) * sx, h: (g.b - g.t + 1) * s,
      } : null;
      return {
        id: a.id, kind: a.kind, art: a.art, row: a.row, key, depth: a.c.depth, lane: a.base.y, cx: a.base.x,
        cont: { x: a.c.x, y: a.c.y }, sp: { x: a.sp.x, y: a.sp.y, angle: a.sp.angle, alpha: a.sp.alpha, flipX: fl, originX: a.sp.originX, originY: a.sp.originY, scaleX: sx, scaleY: s, W, H, tint: a.sp.tintTopLeft, gris: !!a.gray },
        dibujado: { alto: H * s, ancho: W * sx },
        pie: g ? top + (g.b + 1) * s : null,
        alphaBox: alpha, muerto: !!a.dead,
      };
    });
    const f = sc.formation;
    const nombres = [...panel.querySelectorAll('button span')].filter((sp) => sp.className.includes('whitespace-nowrap')).map((sp) => ({
      texto: sp.textContent, px: parseFloat(getComputedStyle(sp).fontSize), recortado: sp.scrollWidth > sp.clientWidth + 1, ancho: sp.scrollWidth, caja: sp.clientWidth,
    }));
    const barrasEnemigo = [...document.querySelectorAll('[data-enemy-bar]')].map((b) => ({
      nombre: b.querySelector('div').textContent, aria: b.querySelector('[aria-label]')?.getAttribute('aria-label'), muerta: b.dataset.dead === 'true', opacidad: b.style.opacity,
      recortado: b.querySelector('div').scrollWidth > b.querySelector('div').clientWidth + 1,
    }));
    const barrasHeroe = [...document.querySelectorAll('[data-hero-bar]')].map((b) => ({ muerta: b.dataset.dead === 'true', opacidad: b.style.opacity }));
    const layer = document.querySelector('[data-result-layer]');
    let cartel = null;
    if (layer) {
      const banner = layer.querySelector('[data-outcome]');
      const rb = R(banner);
      const vh = window.innerHeight;
      const volver = [...layer.querySelectorAll('button')].find((b) => /Volver/.test(b.textContent));
      const filaHeroes = btns.length ? { top: Math.min(...btns.map((b) => R(b).top)), bottom: Math.max(...btns.map((b) => R(b).bottom)) } : null;
      cartel = {
        resultado: banner.dataset.outcome, top: rb.top, bottom: rb.bottom, alto: rb.height, vh,
        fraccionAlto: rb.height / vh, centro: (rb.top + rb.bottom) / 2 / vh,
        tapaFilaHeroes: filaHeroes ? rb.bottom > filaHeroes.top && rb.top < filaHeroes.bottom : false,
        volverVisible: !!volver && R(volver).height >= 44,
      };
    }
    return {
      lienzo: { x: cr.left, y: cr.top, w: cr.width, h: cr.height, escala: k }, bg: f.bg, ground: f.ground, lanes: f.lanes,
      HUD_TOP: fm.HUD_TOP, botonesTopMundo: (heroBtnTop - cr.top) / k, barrasBottomMundo: (bars.bottom - cr.top) / k,
      hud, actores, nombres, barrasEnemigo, barrasHeroe, cartel,
    };
  });
}

// V4 y V7 en vivo: números flotantes y orientación del atacante, leídos de los objetos de Phaser.
async function dinamica(page) {
  return page.evaluate(async () => {
    const sc = window.__combatGame.scene.getScene('combat');
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const e0 = sc.actors.e0;
    const t1 = sc.floatAt(e0, 123, '#e6dcc3');
    const t2 = sc.floatAt(e0, 456, '#ffd35a', true);
    const y1 = t1.y; const y2 = t2.y;
    const v4 = {
      normalPx: parseFloat(t1.style.fontSize), criticoPx: parseFloat(t2.style.fontSize),
      escalaInicial: t1.scaleX, baseNumero: y1, cabeza: e0.base.headY, caraBajo: e0.base.headY + 0.35 * e0.base.alphaH,
      sobreLaCabeza: y1 <= e0.base.headY, apilado: y1 - y2,
    };
    await wait(140);
    v4.escala140ms = t1.scaleX;
    await wait(700);
    v4.subida840ms = y1 - t1.y;
    v4.vivoA840ms = t1.active && t1.alpha > 0.01;
    // V7: el tirador (h3, a la derecha) ataca a e0
    const h3 = sc.actors.h3;
    sc.playBeat({ kind: 'hit', actorId: 'h3', targetId: 'e0', num: 7, color: '#e6dcc3', intensity: 1 });
    await wait(60);
    const v7 = { flipDurante: h3.sp.flipX, anguloDurante: h3.sp.angle, texturaDurante: h3.sp.texture.key, objetivoALaIzquierda: e0.base.x < h3.base.x };
    await wait(700);
    Object.assign(v7, { flipDespues: h3.sp.flipX, anguloDespues: h3.sp.angle, texturaDespues: h3.sp.texture.key });
    const h1 = sc.actors.h1;
    sc.playBeat({ kind: 'hit', actorId: 'h1', targetId: 'e0', num: 7, color: '#e6dcc3', intensity: 1 });
    await wait(60);
    Object.assign(v7, { h1FlipDurante: h1.sp.flipX, h1ObjetivoALaDerecha: e0.base.x > h1.base.x });
    await wait(700);
    return { v4, v7 };
  });
}

// ── cara tapada, píxel a píxel ──────────────────────────────────────────────
const alphaCache = new Map();
async function alphaDe(key) {
  if (alphaCache.has(key)) return alphaCache.get(key);
  const [kind, name, pose] = key.split(':');
  const file = path.join(ROOT, 'client', 'public', 'assets', 'b', kind === 'hero' ? 'heroes' : 'enemies', `${name}_${pose}.webp`);
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const a = { W: info.width, H: info.height, A: new Uint8Array(info.width * info.height) };
  for (let i = 0; i < a.A.length; i++) a.A[i] = data[i * 4 + 3];
  alphaCache.set(key, a);
  return a;
}
/** Máscara (en el mundo 824×1720) de un actor de pie sin rotar. */
async function mascara(act) {
  const t = await alphaDe(act.key);
  const { sp, cont } = act;
  const left = cont.x + sp.x - sp.originX * t.W * sp.scaleX;
  const top = cont.y + sp.y - sp.originY * t.H * sp.scaleY;
  const x0 = Math.max(0, Math.floor(left)); const x1 = Math.min(824, Math.ceil(left + t.W * sp.scaleX));
  const y0 = Math.max(0, Math.floor(top)); const y1 = Math.min(1720, Math.ceil(top + t.H * sp.scaleY));
  return {
    x0, x1, y0, y1,
    at(x, y) {
      let u = Math.floor((x + 0.5 - left) / sp.scaleX); const v = Math.floor((y + 0.5 - top) / sp.scaleY);
      if (sp.flipX) u = t.W - 1 - u;
      if (u < 0 || v < 0 || u >= t.W || v >= t.H) return false;
      return t.A[v * t.W + u] > 0;
    },
  };
}
async function caraTapada(actores) {
  const vivos = actores.filter((a) => !a.muerto && a.alphaBox && Math.abs(a.sp.angle) < 1);
  const masks = new Map();
  for (const a of vivos) masks.set(a.id, await mascara(a));
  const out = {};
  for (const a of vivos) {
    const m = masks.get(a.id);
    const delante = vivos.filter((o) => o.row !== a.row && o.depth > a.depth).map((o) => masks.get(o.id));
    const fy0 = Math.max(0, Math.floor(a.alphaBox.y)); const fy1 = Math.min(1720, Math.ceil(a.alphaBox.y + 0.35 * a.alphaBox.h));
    let cara = 0; let tapada = 0;
    for (let y = fy0; y < fy1; y++) {
      for (let x = m.x0; x < m.x1; x++) {
        if (!m.at(x, y)) continue;
        cara += 1;
        if (delante.some((d) => x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1 && d.at(x, y))) tapada += 1;
      }
    }
    out[a.id] = cara ? Math.round((1000 * tapada) / cara) / 10 : 0;
  }
  return out;
}

const inter = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

function resumen(m) {
  const vivos = m.actores.filter((a) => !a.muerto);
  const r = {};
  // V2
  r.V2 = {
    piePeorDesvio: Math.max(0, ...vivos.map((a) => Math.abs(a.pie - a.lane))),
    carriles: m.lanes, piso: m.ground, carrilMinimo: Math.min(...Object.values(m.lanes)), carrilMaximo: Math.max(...Object.values(m.lanes)),
    sobrePiso: Object.values(m.lanes).every((l) => l > m.ground), sobreBotones: Math.max(...vivos.map((a) => a.pie)) <= m.botonesTopMundo,
    botonesTopMundo: Math.round(m.botonesTopMundo * 10) / 10,
  };
  // V3: solape dentro de cada fila (cajas de silueta) y HUD sobre siluetas
  const filas = {};
  for (const a of vivos) (filas[a.row] = filas[a.row] || []).push(a);
  let solapeFila = 0;
  for (const list of Object.values(filas)) {
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const ov = Math.max(0, Math.min(list[i].alphaBox.x + list[i].alphaBox.w, list[j].alphaBox.x + list[j].alphaBox.w) - Math.max(list[i].alphaBox.x, list[j].alphaBox.x));
      if (Math.abs(list[i].lane - list[j].lane) < 1) solapeFila = Math.max(solapeFila, ov / Math.min(list[i].alphaBox.w, list[j].alphaBox.w));
    }
  }
  r.V3 = {
    solapeMaxDentroDeFila: Math.round(solapeFila * 1000) / 10,
    hudSobreSiluetas: vivos.map((a) => ({ id: a.id, pct: Math.round((1000 * m.hud.reduce((s, h) => s + inter(a.alphaBox, h), 0)) / (a.alphaBox.w * a.alphaBox.h)) / 10 })).filter((x) => x.pct > 0),
    cabezaBajoBarras: vivos.filter((a) => a.kind === 'enemy').every((a) => a.alphaBox.y >= m.barrasBottomMundo),
    barrasBottomMundo: Math.round(m.barrasBottomMundo * 10) / 10,
  };
  return r;
}

/** Hoja de contacto: una fila por viewport y una columna por vista, con rótulo (escritorio: columna del juego). */
async function hojaContacto(capturas) {
  const H = 520; const PAD = 12; const LBL = 30;
  const filas = [];
  for (const vp of VPS) {
    const fila = [];
    for (const c of capturas.filter((x) => x.vp === vp)) {
      // en escritorio se recorta a la columna del juego (lienzo ± 40 px CSS); la captura completa queda en su archivo
      let img = sharp(c.file);
      if (vp.w > 800) {
        const left = Math.max(0, Math.round((c.lienzo.x - 40) * vp.dpr));
        const width = Math.min(Math.round(vp.w * vp.dpr) - left, Math.round((c.lienzo.w + 80) * vp.dpr));
        img = sharp(await img.extract({ left, top: 0, width, height: Math.round(vp.h * vp.dpr) }).png().toBuffer());
      }
      const buf = await img.resize({ height: H }).png().toBuffer();
      const meta = await sharp(buf).metadata();
      fila.push({ buf, w: meta.width, label: `${vp.name} ${c.esc.key.replace('enemigos', 'en.').replace('enemigo', 'en.')}` });
    }
    filas.push(fila);
  }
  const W = Math.max(...filas.map((f) => f.reduce((s, t) => s + t.w + PAD, PAD)));
  const comp = [];
  let y = PAD;
  for (const fila of filas) {
    let x = PAD;
    for (const t of fila) {
      comp.push({ input: Buffer.from(`<svg width="${t.w}" height="${LBL}"><text x="2" y="21" font-size="16" font-family="sans-serif" fill="#e6dcc3">${t.label}</text></svg>`), left: x, top: y });
      comp.push({ input: t.buf, left: x, top: y + LBL });
      x += t.w + PAD;
    }
    y += LBL + H + PAD;
  }
  await sharp({ create: { width: W, height: y, channels: 3, background: '#120a07' } }).composite(comp).webp({ quality: 80 }).toFile(path.join(HERE, 'hoja_contacto.webp'));
}

const run = async () => {
  if (process.argv.includes('--solo-hoja')) {
    // rehace solo la hoja de contacto con las capturas y los lienzos ya medidos (hoja_medidas.json)
    const M = JSON.parse(fs.readFileSync(path.join(HERE, 'hoja_medidas.json'), 'utf8'));
    const caps = VPS.flatMap((vp) => SCEN.map((esc) => ({ vp, esc, file: path.join(HERE, `${vp.name}_${esc.key}.webp`), lienzo: M[`${vp.name}_${esc.key}`].crudo.lienzo })));
    await hojaContacto(caps);
    return;
  }
  const browser = await chromium.launch({ headless: true, args: ['--ignore-gpu-blocklist', '--use-angle=d3d11'] });
  const medidas = {};
  const capturas = [];
  const erroresTodos = [];
  try {
    for (const vp of VPS) {
      const { ctx, page, errores } = await abrir(browser, vp);
      for (const esc of SCEN) {
        const nombre = `${vp.name}_${esc.key}`;
        await abrirEscenario(page, esc);
        const png = await page.screenshot({ type: 'png' });
        const file = path.join(HERE, `${nombre}.webp`);
        await sharp(png).webp({ quality: 85 }).toFile(file);
        const m = await medir(page);
        capturas.push({ vp, esc, file, lienzo: m.lienzo });
        const r = resumen(m);
        r.caraTapadaPct = await caraTapada(m.actores);
        r.caraTapadaMax = Math.max(0, ...Object.values(r.caraTapadaPct));
        if (esc.key === '1enemigo') Object.assign(r, await dinamica(page));
        medidas[nombre] = { ...r, crudo: m };
        console.log(nombre, 'pie±', r.V2.piePeorDesvio.toFixed(2), 'carriles', JSON.stringify(m.lanes), 'piso', m.ground,
          'botones', r.V2.botonesTopMundo, 'hud>silueta', r.V3.hudSobreSiluetas.length, 'cara tapada máx', `${r.caraTapadaMax}%`);
      }
      erroresTodos.push(...errores.map((e) => `${vp.name}: ${e}`));
      await ctx.close();
      // el server local limita /api a 100 peticiones por minuto: se deja pasar la ventana antes del siguiente viewport
      if (vp !== VPS[VPS.length - 1]) await new Promise((r) => setTimeout(r, 65000));
    }
  } finally {
    await browser.close();
  }
  medidas.errores = erroresTodos;
  fs.writeFileSync(path.join(HERE, 'hoja_medidas.json'), JSON.stringify(medidas, null, 1));

  await hojaContacto(capturas);
  console.log('errores de consola/página:', erroresTodos.length ? erroresTodos : 'ninguno');
};

run().catch((e) => { console.error(e); process.exit(1); });
