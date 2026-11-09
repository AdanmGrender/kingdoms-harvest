// Revisión visual ronda 2 (visual_reviewer, Etapa C · T10.6). Vistas que faltan en evidencia/hoja/ y cuadros de animación.
// Mismo andamiaje que evidencia/hoja/generar_evidencia_hoja.mjs (estado sintético runId −1, `stepInstance` sustituido en la
// página, auto-avance de 2 s en pausa), sin tocar código de la app. Escuadra real: aria, lyra, elena, viktor, shadow.
// Preview aislado: server del worktree en :3003 (BOT_TOKEN ficticio, BOT_POLLING=false, WEBAPP_URL=http://localhost:5175)
// y vite en :5175 --strictPort con VITE_API_URL=http://localhost:3003.
// Uso: KH_PREVIEW_URL=http://localhost:5175 node capturar_ronda2.mjs <modo>
//   fondos    412×860: moor (a1n4), ashfield (a2n7), veil_marsh (a2n4) × 1/3/4 enemigos; y lo mismo con los héroes ocultos
//   ocultos   412×860: jefe (a1n9), 3 enemigos (a1n7) y 4 (a2n10) con la formación real y los héroes ocultos (pies y piso)
//   resultado 412×860: victoria y derrota con 3 enemigos (a1n7), 4 (a2n10) y jefe (a1n9)
//   anim      412×860: screencast CDP (cuadros reales con su hora) de V4, V6 y V7 + muestreo por requestAnimationFrame
//   bajos     360×740 y 375×667: 5 héroes + 3 enemigos (a1n7); botones y «¡TAP!» frente a los pies de la fila delantera
// Salida: ronda2/*.webp y ronda2/medidas_<modo>.json; los cuadros crudos del screencast van a KH_RAW_DIR (fuera del repo).
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const NM = process.env.KH_NODE_MODULES || 'D:/Proyectos/kingdoms-harvest/node_modules';
const req = createRequire(path.join(NM, 'x.js'));
const { chromium } = req('playwright');
const sharp = req('sharp');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..', '..');
const { HEROES } = createRequire(import.meta.url)(path.join(ROOT, 'shared', 'gameConfig.js'));
const URL_ = process.env.KH_PREVIEW_URL || 'http://localhost:5175';
const RAW = process.env.KH_RAW_DIR || path.join(os.tmpdir(), 'kh_visual_r2_frames');

const SQUAD = ['aria', 'lyra', 'elena', 'viktor', 'shadow'];
const ENERGY = [100, 40, 100, 70, 20];
const en = (i, hp = 600, maxHp = 900) => ({ id: `e${i}`, name: `Enemigo ${i + 1}`, hp, maxHp, dps: 40, def: 0, spd: 0 });
const ens = (m, hp, maxHp) => Array.from({ length: m }, (_, i) => en(i, hp, maxHp));
const NODES = {
  a1n3: { id: 'a1n3', act: 1, type: 'combat', name: 'Merodeadores del Páramo' },
  a1n7: { id: 'a1n7', act: 1, type: 'combat', name: 'Carroñeros' },
  a1n9: { id: 'a1n9', act: 1, type: 'boss', isBoss: true, name: 'Devorador de Almas' },
  a2n10: { id: 'a2n10', act: 2, type: 'boss', isBoss: true, name: 'La Voz del Velo' },
  a1n4: { id: 'a1n4', act: 1, type: 'wave', name: 'Marea Menor' },          // moor · aullador
  a2n7: { id: 'a2n7', act: 2, type: 'combat', name: 'Los Sin Rostro' },     // ashfield · sin_rostro
  a2n4: { id: 'a2n4', act: 2, type: 'wave', name: 'Marea de Cenizas' },     // veil_marsh · bruto
};

const VP412 = { w: 412, h: 860, dpr: 2, name: '412x860' };

async function abrir(browser, vp) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: vp.dpr, isMobile: vp.w < 800, hasTouch: true });
  await ctx.addInitScript(() => {
    localStorage.setItem('kh_device_id', 'captura-combate-b-0001');
    localStorage.setItem('kh_combat_quality', 'medium');
    localStorage.setItem('kh_tutorial_done', '1');
    localStorage.setItem('kh_ambient_fx', 'false');
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

function heroesDe(n = 5) {
  return SQUAD.slice(0, n).map((id, i) => ({
    slot: i + 1, heroId: id, class: HEROES[id].class, name: HEROES[id].name, atk: 60, hp: 200, maxHp: 200,
    energy: ENERGY[i], energyMax: 100, alive: true, def: 0, spd: 0,
  }));
}

/** Estado inicial y rondas preparadas (cada ronda: eventos acumulados + estado autoritativo + resultado). */
function preparar(esc) {
  const heroes = heroesDe(esc.nHeroes ?? 5);
  const enemies = esc.enemies;
  const s0 = { engine: 2, round: 1, maxRounds: 10, shield: 0, log: [], events: [], eventsVersion: 1, enemies, enemy: enemies[0], heroes };
  const rondas = [];
  let t = 0; const todos = []; let st = s0;
  const ronda = (evs, mut, result = null) => {
    const desde = todos.length;
    for (const e of evs) todos.push({ t: ++t, round: st.round, ...e });
    const next = mut({ ...st, round: st.round + 1, events: [...todos] });
    rondas.push({ state: next, roundLog: { round: st.round, eventRange: [desde, todos.length] }, result });
    st = next;
  };
  if (esc.result === 'victory') {
    const evs = [];
    enemies.forEach((e, i) => { evs.push({ kind: 'hit', actor: `h${(i % 3) + 1}`, target: e.id, value: e.hp, hp: 0 }); evs.push({ kind: 'death', actor: `h${(i % 3) + 1}`, target: e.id, value: 0 }); });
    evs.push({ kind: 'end', actor: null, target: null, value: 'victory' });
    ronda(evs, (s) => { const es = s.enemies.map((e) => ({ ...e, hp: 0 })); return { ...s, enemies: es, enemy: es[0] }; }, 'victory');
  } else if (esc.result === 'defeat') {
    const evs = [];
    for (const h of heroes) evs.push({ kind: 'hit', actor: 'e0', target: `h${h.slot}`, value: 200, hp: 0 });
    for (const h of heroes) evs.push({ kind: 'death', actor: 'e0', target: `h${h.slot}`, value: 0 });
    evs.push({ kind: 'end', actor: null, target: null, value: 'defeat' });
    ronda(evs, (s) => ({ ...s, heroes: s.heroes.map((h) => ({ ...h, hp: 0, alive: false, energy: 0 })) }), 'defeat');
  } else if (esc.rondas) {
    for (const r of esc.rondas) ronda(r.events, r.mut || ((s) => s), r.result || null);
  }
  return { s0, rondas };
}

async function abrirEscenario(page, esc, { avanzar = !!esc.result } = {}) {
  const { s0, rondas } = preparar(esc);
  await page.evaluate(() => {
    const s = window.__gameStore.getState();
    s.clearActiveRun && s.clearActiveRun();
    s.clearOverlay && s.clearOverlay();
  });
  await page.waitForTimeout(400);
  await page.waitForFunction(() => !window.__combatGame, null, { timeout: 10000 });
  await page.evaluate(({ node, s0, rondas }) => {
    const store = window.__gameStore;
    window.__khRondas = rondas;
    window.__khGate = null;
    store.setState({
      // cada ronda espera a que la suelte la captura (`soltarRonda`): así el auto-avance de 300 ms no se adelanta
      stepInstance: async () => {
        await new Promise((res) => { window.__khGate = res; });
        window.__khGate = null;
        const r = window.__khRondas.shift();
        if (!r) return new Promise(() => {});
        const run = store.getState().activeRun;
        store.setState({ activeRun: { ...run, state: r.state } });
        return { state: r.state, roundLog: r.roundLog, result: r.result, unlocked: [] };
      },
      activeRun: { runId: -1, node, state: s0 },
    });
    store.getState().setOverlay('combat_instance', {});
  }, { node: esc.node, s0, rondas });
  await page.waitForFunction(() => {
    const g = window.__combatGame; const sc = g && g.scene && g.scene.getScene('combat');
    return sc && sc.ready;
  }, null, { timeout: 30000 });
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await page.waitForTimeout(900);
  if (avanzar) {
    await soltarRonda(page);
    await page.waitForSelector('[data-result-layer]', { timeout: 10000 });
    await page.waitForTimeout(1500);
  }
}

/** Suelta la siguiente ronda preparada: si el panel no la pidió todavía, toca «Avanzar ronda». Devuelve la hora (s). */
async function soltarRonda(page) {
  await page.evaluate(() => {
    if (!window.__khGate) [...document.querySelectorAll('button')].find((b) => /Avanzar ronda/.test(b.textContent)).click();
  });
  await page.waitForFunction(() => window.__khGate, null, { timeout: 5000 });
  return page.evaluate(() => { const t = Date.now() / 1000; window.__khGate(); return t; });
}

/** Geometría de la vista: lienzo, carriles, piso, actores (caja alfa en el mundo), botones de héroe y cartel (CSS y mundo). */
async function medir(page) {
  return page.evaluate(async () => {
    const art = await import('/src/game/combat/artMap.js');
    const sc = window.__combatGame.scene.getScene('combat');
    const cr = window.__combatGame.canvas.getBoundingClientRect();
    const k = cr.width / 824;
    const R = (e) => e.getBoundingClientRect();
    const toW = (r) => ({ x: (r.left - cr.left) / k, y: (r.top - cr.top) / k, w: r.width / k, h: r.height / k });
    const panel = document.querySelector('[data-enemy-bars]').closest('.fixed');
    const btns = [...panel.querySelectorAll('button')].filter((b) => R(b).width > 0 && !b.classList.contains('kh-close') && !/Avanzar|Volver/.test(b.textContent));
    const botones = btns.map((b) => {
      const all = [b, ...b.querySelectorAll('*')].map(R);
      const top = Math.min(...all.map((r) => r.top));
      const tap = [...b.querySelectorAll('span')].find((s) => /TAP/.test(s.textContent));
      return { texto: b.textContent.replace(/\s+/g, ' ').trim(), cssTop: top, cssLeft: R(b).left, cssRight: R(b).right, tapTop: tap ? R(tap).top : null, mundoTop: (top - cr.top) / k };
    });
    const actores = Object.values(sc.actors).map((a) => {
      const key = a.sp.texture.key;
      const m = /^(hero|enemy):([a-z_]+):([a-z]+)$/.exec(key);
      const g = m ? art.spriteGeom(m[1], m[2], m[3]) : null;
      const s = a.sp.scaleY; const sx = a.sp.scaleX; const W = a.sp.width; const H = a.sp.height;
      const left = a.c.x + a.sp.x - a.sp.originX * W * sx;
      const top = a.c.y + a.sp.y - a.sp.originY * H * s;
      const fl = a.sp.flipX;
      return {
        id: a.id, kind: a.kind, art: a.art, row: a.row, lane: a.base.y, cx: a.base.x, depth: a.c.depth, muerto: !!a.dead, visible: a.c.visible,
        angulo: a.sp.angle, alfa: a.sp.alpha,
        alphaBox: g && Math.abs(a.sp.angle) < 1 ? { x: left + (fl ? W - 1 - g.r : g.l) * sx, y: top + g.t * s, w: (g.r - g.l + 1) * sx, h: (g.b - g.t + 1) * s } : null,
        tr: { cx: a.c.x, cy: a.c.y, x: a.sp.x, y: a.sp.y, angle: a.sp.angle, sx, sy: s, ox: a.sp.originX, oy: a.sp.originY, W, H, flipX: fl, key },
      };
    });
    const layer = document.querySelector('[data-result-layer]');
    const banner = layer && layer.querySelector('[data-outcome]');
    const bars = document.querySelector('[data-enemy-bars]');
    return {
      vp: { w: innerWidth, h: innerHeight }, lienzo: { x: cr.left, y: cr.top, w: cr.width, h: cr.height, k },
      bg: sc.formation.bg, ground: sc.formation.ground, lanes: sc.formation.lanes,
      barras: bars ? { cssBottom: R(bars).bottom, mundoBottom: (R(bars).bottom - cr.top) / k } : null,
      botones, botonesMundoTop: botones.length ? Math.min(...botones.map((b) => b.mundoTop)) : null,
      cartel: banner ? { css: { top: R(banner).top, bottom: R(banner).bottom, left: R(banner).left, right: R(banner).right }, mundo: toW(R(banner)) } : null,
      actores,
    };
  });
}

const shot = async (page, file) => {
  const png = await page.screenshot({ type: 'png' });
  await sharp(png).webp({ quality: 88 }).toFile(file);
};

const ocultarHeroes = (page, ocultar = true) => page.evaluate((o) => {
  const sc = window.__combatGame.scene.getScene('combat');
  for (const a of Object.values(sc.actors)) if (a.kind === 'hero') a.c.setVisible(!o);
}, ocultar);

// ── modos ────────────────────────────────────────────────────────────────────

async function modoVistas(browser, lista, nombre) {
  const { ctx, page, errores } = await abrir(browser, VP412);
  const med = {};
  try {
    for (const v of lista) {
      await abrirEscenario(page, v.esc);
      if (v.ocultar) await ocultarHeroes(page, true);
      await page.waitForTimeout(200);
      const file = path.join(HERE, `${v.key}.webp`);
      await shot(page, file);
      med[v.key] = await medir(page);
      const m = med[v.key];
      console.log(v.key, 'fondo', m.bg, 'piso', m.ground, 'carriles', JSON.stringify(m.lanes), 'botones', m.botonesMundoTop && m.botonesMundoTop.toFixed(1));
    }
  } finally { await ctx.close(); }
  med.errores = errores;
  fs.writeFileSync(path.join(HERE, `medidas_${nombre}.json`), JSON.stringify(med, null, 1));
  console.log('errores de consola/página:', errores.length ? errores : 'ninguno');
}

async function fondos(browser) {
  const lista = [];
  for (const id of ['a1n4', 'a2n7', 'a2n4']) {
    for (const m of [1, 3, 4]) {
      const esc = { node: NODES[id], enemies: ens(m) };
      lista.push({ key: `fondo_${id}_${m}en`, esc });
      if (m > 1) lista.push({ key: `fondo_${id}_${m}en_sinheroes`, esc, ocultar: true });
    }
  }
  await modoVistas(browser, lista, 'fondos');
}

async function ocultos(browser) {
  await modoVistas(browser, [
    { key: 'jefe_a1n9', esc: { node: NODES.a1n9, enemies: [en(0, 2400, 2400)] } },
    { key: 'jefe_a1n9_sinheroes', esc: { node: NODES.a1n9, enemies: [en(0, 2400, 2400)] }, ocultar: true },
    { key: 'tres_a1n7_sinheroes', esc: { node: NODES.a1n7, enemies: ens(3) }, ocultar: true },
    { key: 'cuatro_a2n10_sinheroes', esc: { node: NODES.a2n10, enemies: ens(4) }, ocultar: true },
  ], 'ocultos');
}

async function resultado(browser) {
  await modoVistas(browser, [
    { key: 'victoria_a1n7_3en', esc: { node: NODES.a1n7, enemies: ens(3, 60), result: 'victory' } },
    { key: 'victoria_a2n10_4en', esc: { node: NODES.a2n10, enemies: ens(4, 60), result: 'victory' } },
    { key: 'victoria_a1n9_jefe', esc: { node: NODES.a1n9, enemies: [en(0, 60, 2400)], result: 'victory' } },
    { key: 'derrota_a1n9_jefe', esc: { node: NODES.a1n9, enemies: [en(0, 2400, 2400)], result: 'defeat' } },
    { key: 'derrota_a2n10_4en', esc: { node: NODES.a2n10, enemies: ens(4), result: 'defeat' } },
  ], 'resultado');
}

async function bajos(browser) {
  const med = {};
  const errs = [];
  for (const vp of [{ w: 360, h: 740, dpr: 3, name: '360x740' }, { w: 375, h: 667, dpr: 2, name: '375x667' }]) {
    const { ctx, page, errores } = await abrir(browser, vp);
    try {
      await abrirEscenario(page, { node: NODES.a1n7, enemies: ens(3) });
      const file = path.join(HERE, `bajo_${vp.name}_3en.webp`);
      await shot(page, file);
      const m = await medir(page);
      const pieCss = m.lienzo.y + m.lanes.HF * m.lienzo.k;
      m.resumen = {
        pieFilaDelanteraCss: pieCss,
        botonesTopCss: Math.min(...m.botones.map((b) => b.cssTop)),
        tapTopCss: Math.min(...m.botones.filter((b) => b.tapTop !== null).map((b) => b.tapTop)),
        iconoTopCss: Math.min(...m.botones.map((b) => b.cssTop)),
      };
      med[vp.name] = m;
      console.log(vp.name, JSON.stringify(m.resumen), 'lienzo', JSON.stringify(m.lienzo));
    } finally { await ctx.close(); }
    errs.push(...errores);
    await new Promise((r) => setTimeout(r, 2000));
  }
  med.errores = errs;
  fs.writeFileSync(path.join(HERE, 'medidas_bajos.json'), JSON.stringify(med, null, 1));
  console.log('errores de consola/página:', errs.length ? errs : 'ninguno');
}

/**
 * Suelta una ronda con el screencast de CDP encendido y muestrea por rAF los actores `ids` y los textos flotantes.
 * Cuadros y muestras llevan la hora de pared relativa al momento en que se suelta la ronda (dt en ms).
 */
async function grabarRonda(ctx, page, ids, ms, tag) {
  const cdp = await ctx.newCDPSession(page);
  const frames = [];
  cdp.on('Page.screencastFrame', (f) => {
    frames.push({ ts: f.metadata.timestamp, data: f.data });
    cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, everyNthFrame: 1 });
  const muestras = page.evaluate(({ ids, ms }) => new Promise((resolve) => {
    const sc = window.__combatGame.scene.getScene('combat');
    const out = []; const fin = Date.now() + ms;
    const tick = () => {
      const act = {};
      for (const id of ids) {
        const a = sc.actors[id];
        act[id] = { cx: a.c.x, cy: a.c.y, x: a.sp.x, y: a.sp.y, ang: a.sp.angle, alfa: a.sp.alpha, sx: a.sp.scaleX, sy: a.sp.scaleY, flip: a.sp.flipX, tex: a.sp.texture.key, tint: a.sp.tintTopLeft, gris: !!a.gray, muerto: !!a.dead };
      }
      const textos = sc.children.list.filter((o) => o.type === 'Text' && o.active).map((o) => ({ txt: o.text, x: o.x, y: o.y, esc: o.scaleX, alfa: o.alpha, px: parseFloat(o.style.fontSize), h: o.height, w: o.width }));
      out.push({ w: Date.now() / 1000, act, textos });
      if (Date.now() < fin) requestAnimationFrame(tick); else resolve(out);
    };
    requestAnimationFrame(tick);
  }), { ids, ms: ms + 600 });
  await page.waitForTimeout(400);
  const t0 = await soltarRonda(page);
  const s = await muestras;
  await page.waitForTimeout(200);
  await cdp.send('Page.stopScreencast');
  await cdp.detach();
  const dir = path.join(RAW, tag);
  fs.mkdirSync(dir, { recursive: true });
  const lista = frames.map((f, i) => {
    const dt = Math.round((f.ts - t0) * 1000);
    const name = `${tag}_${String(i).padStart(3, '0')}_${dt >= 0 ? '+' : ''}${dt}ms.jpg`;
    fs.writeFileSync(path.join(dir, name), Buffer.from(f.data, 'base64'));
    return { i, dtMs: dt, file: name };
  });
  return { t0, frames: lista, muestras: s.map(({ w, ...r }) => ({ dtMs: Math.round((w - t0) * 1000), ...r })) };
}

async function anim(browser) {
  fs.mkdirSync(RAW, { recursive: true });
  const { ctx, page, errores } = await abrir(browser, VP412);
  const out = {};
  try {
    // Ronda A (V4 + V7): tirador h3 → e0, guerrero h1 → e0, bruto → h3, bruto → h1, crítico del mago h2 → e0 (apilado).
    // Ronda B (V6): golpe y caída del bruto + victoria. Ronda C (V6 héroe): ver más abajo (escenario aparte).
    const escA = {
      node: NODES.a1n3, enemies: [en(0, 900, 900)],
      rondas: [
        {
          events: [
            { kind: 'hit', actor: 'h3', target: 'e0', value: 37, hp: 863 },
            { kind: 'hit', actor: 'h1', target: 'e0', value: 52, hp: 811 },
            { kind: 'hit', actor: 'e0', target: 'h3', value: 21, hp: 179 },
            { kind: 'hit', actor: 'e0', target: 'h1', value: 18, hp: 182 },
            { kind: 'passive', actor: 'h2', target: 'e0', fx: 'crit', value: 1.5 },
            { kind: 'hit', actor: 'h2', target: 'e0', value: 96, hp: 715 },
          ],
          mut: (s) => ({ ...s, enemies: [{ ...s.enemies[0], hp: 715 }], enemy: { ...s.enemies[0], hp: 715 }, heroes: s.heroes.map((h) => (h.slot === 3 ? { ...h, hp: 179 } : h.slot === 1 ? { ...h, hp: 182 } : h)) }),
        },
        {
          events: [
            { kind: 'hit', actor: 'h1', target: 'e0', value: 715, hp: 0 },
            { kind: 'death', actor: 'h1', target: 'e0', value: 0 },
            { kind: 'end', actor: null, target: null, value: 'victory' },
          ],
          mut: (s) => ({ ...s, enemies: [{ ...s.enemies[0], hp: 0 }], enemy: { ...s.enemies[0], hp: 0 } }),
          result: 'victory',
        },
      ],
    };
    await abrirEscenario(page, escA, { avanzar: false });
    for (const [tag, ms] of [['rondaA', 3400], ['rondaB', 3000]]) {
      const g = await grabarRonda(ctx, page, ['h1', 'h2', 'h3', 'e0'], ms, tag);
      out[tag] = { t0: g.t0, frames: g.frames, muestras: g.muestras };
      console.log(tag, 'cuadros', g.frames.length, 'muestras', g.muestras.length);
      await page.waitForTimeout(500);
    }
    await shot(page, path.join(HERE, 'anim_rondaB_final.webp'));
    // Ronda C: caída de los cinco héroes (derrota).
    await abrirEscenario(page, { node: NODES.a1n3, enemies: [en(0)], result: 'defeat' }, { avanzar: false });
    {
      const g = await grabarRonda(ctx, page, ['h1', 'h2', 'h3', 'h4', 'h5', 'e0'], 3400, 'rondaC');
      out.rondaC = { t0: g.t0, frames: g.frames, muestras: g.muestras };
      console.log('rondaC', 'cuadros', g.frames.length, 'muestras', g.muestras.length);
    }
    await page.waitForTimeout(800);
    await shot(page, path.join(HERE, 'anim_rondaC_final.webp'));
  } finally { await ctx.close(); }
  out.errores = errores;
  fs.writeFileSync(path.join(HERE, 'medidas_anim.json'), JSON.stringify(out));
  console.log('cuadros crudos en', RAW, '· errores de consola/página:', errores.length ? errores : 'ninguno');
}

const MODOS = { fondos, ocultos, resultado, bajos, anim };
const modo = process.argv[2];
if (!MODOS[modo]) { console.error(`modo: ${Object.keys(MODOS).join(' | ')}`); process.exit(2); }
const browser = await chromium.launch({ headless: true, args: ['--ignore-gpu-blocklist', '--use-angle=d3d11'] });
try { await MODOS[modo](browser); } finally { await browser.close(); }
