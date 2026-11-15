// Hoja visual de combate (hoja_visual.md, T10.6 y T10.7): vistas obligatorias, hoja de contacto, medidas V1–V9 y
// secuencias de animación.
//
// Vistas (T10.7): 412×860, 360×800, 1280×800 y las bajas 360×740 y 375×667 (decisión del owner del 2026-11-09) ×
// {1 común (a1n3), 3 comunes (a1n7), 4 en veil_gate (a2n10), 1 jefe (a1n9)} de pie, y victoria y derrota con esas 4
// formaciones. Escuadra real de 5 héroes (aria, lyra, elena, viktor, shadow).
// Los estados son sintéticos (runId −1, R26: CAMPAIGN no trae enemies[]); `stepInstance` se sustituye en la página para
// no llamar al servidor, y el auto-avance de 2 s queda en pausa durante la captura (`__khHoldAdvance`).
// Medidas (hoja_medidas.json), leídas de la escena real (Phaser) y del DOM, en coordenadas del mundo 824×1720:
//  V1 altos dibujados · V2 pie (fila inferior con alfa) vs. carril, carriles vs. piso del fondo y vs. el borde real de
//  los botones de ESA pantalla · V3 solape dentro de cada fila, HUD/botones/barras sobre siluetas y % de CARA tapada por
//  otras filas (píxel a píxel con el alfa real) · V4 números en px CSS y apilado sin pisarse · V5 nombres · V6 caídos ·
//  V7 orientación y disparo del tirador · V8 cartel (y B1/B2: qué tapa) · V9 nombres de barras · marcador de R31.
// Secuencias (412×860): golpe a un héroe, números apilados y el tirador disparando (`secuencia_*.webp`).
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
  { w: 360, h: 800, dpr: 2, name: '360x800' },
  { w: 1280, h: 800, dpr: 1.5, name: '1280x800' },
  { w: 360, h: 740, dpr: 2, name: '360x740' },
  { w: 375, h: 667, dpr: 2, name: '375x667' },
  // H-c (decisión del owner del 2026-11-09): marco muy bajo, como un 375×667 dentro de Telegram (~611): de pie con
  // 3 carroñeros, 4 Voz del Velo y el jefe de la catedral (5 héroes)
  { w: 375, h: 611, dpr: 2, name: '375x611', escenas: ['3enemigos', '4enemigos_veil', 'jefe'] },
];
const SQUAD = ['aria', 'lyra', 'elena', 'viktor', 'shadow'];
const ENERGY = [100, 40, 100, 70, 20];
const en = (i, hp = 600, maxHp = 900) => ({ id: `e${i}`, name: `Enemigo ${i + 1}`, hp, maxHp, dps: 40, def: 0, spd: 0 });
const FORM = {
  '1enemigo': { node: { id: 'a1n3', act: 1, type: 'combat', name: 'Merodeadores del Páramo' }, enemies: [en(0)] },
  '3enemigos': { node: { id: 'a1n7', act: 1, type: 'combat', name: 'Carroñeros' }, enemies: [en(0), en(1), en(2)] },
  '4enemigos_veil': { node: { id: 'a2n10', act: 2, type: 'boss', isBoss: true, name: 'La Voz del Velo' }, enemies: [en(0), en(1), en(2), en(3)] },
  jefe: { node: { id: 'a1n9', act: 1, type: 'boss', isBoss: true, name: 'Devorador de Almas' }, enemies: [en(0, 2400, 2400)] },
};
// de pie, y victoria/derrota por formación (las de 1 bruto conservan los nombres de T10.6: `victoria`, `derrota`)
const SCEN = [
  ...Object.entries(FORM).map(([key, f]) => ({ key, ...f })),
  ...Object.entries(FORM).flatMap(([key, f]) => ['victory', 'defeat'].map((result) => ({
    key: `${result === 'victory' ? 'victoria' : 'derrota'}${key === '1enemigo' ? '' : `_${key}`}`, formacion: key, ...f, result,
  }))),
];

// El server local limita /api a 100 peticiones por minuto (express-rate-limit, por IP): el hub pide lo suyo al entrar y
// en cada vuelta al hub. Antes de abrir un viewport y de cada escena se espera a que la ventana de 60 s tenga sitio,
// así la captura no provoca 429 en el hub (que no es parte del combate, pero ensucia la consola).
const API = [];
async function respirar(max = 55) {
  for (;;) {
    const now = Date.now();
    if (API.filter((t) => now - t < 60000).length <= max) return;
    await new Promise((r) => setTimeout(r, 2000));
  }
}

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
  page.on('request', (r) => { if (/\/api\//.test(r.url())) API.push(Date.now()); });
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
    esc.enemies.forEach((e, i) => push({ kind: 'hit', actor: `h${(i % 3) + 1}`, target: e.id, value: e.hp, hp: 0 }));
    esc.enemies.forEach((e, i) => push({ kind: 'death', actor: `h${(i % 3) + 1}`, target: e.id, value: 0 }));
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
    await page.waitForSelector('[data-result-banner][data-ok]', { timeout: 10000 });
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
    const toCss = (r) => ({ x: cr.left + r.x * k, y: cr.top + r.y * k, w: r.w * k, h: r.h * k });
    const R = (e) => e.getBoundingClientRect();
    const panel = document.querySelector('[data-enemy-bars]').closest('.fixed');
    const btns = [...panel.querySelectorAll('[data-hero-row] button')].filter((b) => R(b).width > 0);
    const heroBtnTop = Math.min(...btns.flatMap((b) => [b, ...b.querySelectorAll('*')]).map((e) => R(e).top));
    const adv = [...panel.querySelectorAll('button')].find((b) => /Avanzar ronda/.test(b.textContent));
    const bars = R(document.querySelector('[data-enemy-bars]'));
    const title = R(panel.querySelector('h2'));
    const close = R(panel.querySelector('.kh-close'));
    const topOf = (b) => Math.min(R(b).top, ...[...b.querySelectorAll('*')].map((e) => R(e).top));
    const hud = [
      { id: 'barras', ...toW(bars) }, { id: 'titulo', ...toW(title) }, { id: 'cerrar', ...toW(close) },
      ...btns.map((b, i) => ({ id: `boton${i + 1}`, ...toW(new DOMRect(R(b).left, topOf(b), R(b).width, R(b).bottom - topOf(b))) })),
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
      const alpha = g && !a.dead ? {
        x: left + (fl ? W - 1 - g.r : g.l) * sx, y: top + g.t * s, w: (g.r - g.l + 1) * sx, h: (g.b - g.t + 1) * s,
      } : null;
      const tendido = a.dead && sc.lying ? sc.lying[a.id] : null;
      return {
        id: a.id, kind: a.kind, art: a.art, row: a.row, key, depth: a.c.depth, lane: a.base.y, cx: a.base.x,
        cont: { x: a.c.x, y: a.c.y }, sp: { x: a.sp.x, y: a.sp.y, angle: a.sp.angle, alpha: a.sp.alpha, flipX: fl, originX: a.sp.originX, originY: a.sp.originY, scaleX: sx, scaleY: s, W, H, tint: a.sp.tintTopLeft, gris: !!a.gray },
        dibujado: { alto: a.base.h, ancho: W * (a.base.h / H) },
        pie: g && !a.dead ? top + (g.b + 1) * s : null,
        alphaBox: alpha, muerto: !!a.dead,
        tendido: tendido ? { x: tendido.x, y: tendido.y, w: tendido.w, h: tendido.h, dir: tendido.dir, head: tendido.head } : null,
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
      const wrap = layer.querySelector('[data-result-banner]');
      const banner = layer.querySelector('[data-outcome]');
      const rb = R(banner);
      // en el marco del panel (con el tope de aspecto 2,1, en 360×800 mide 756 y arranca en y 22), como su `top`
      const pr = panel.getBoundingClientRect();
      const vh = pr.height;
      const volver = [...layer.querySelectorAll('button')].find((b) => /Volver/.test(b.textContent));
      const area = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
      const rr = { x: rb.left, y: rb.top, w: rb.width, h: rb.height };
      const sobre = (a) => {
        const rect = a.muerto ? a.tendido : a.alphaBox;
        return rect ? Math.round(area(rr, toCss(rect))) : 0;
      };
      const cara = (a) => (a.muerto || !a.alphaBox ? 0 : Math.round(area(rr, toCss({ ...a.alphaBox, h: a.alphaBox.h * 0.35 }))));
      const filaHeroes = btns.length ? { x: Math.min(...btns.map((b) => R(b).left)), y: Math.min(...btns.map(topOf)), w: 1e4, h: 1e4 } : null;
      cartel = {
        resultado: banner.dataset.outcome, compacto: banner.dataset.compact === 'true', ok: wrap.dataset.ok,
        top: rb.top, bottom: rb.bottom, alto: rb.height, vh, marcoTop: pr.top, fraccionAlto: rb.height / vh,
        centro: ((rb.top + rb.bottom) / 2 - pr.top) / vh,
        tapaFilaHeroes: filaHeroes ? area(rr, { ...filaHeroes, x: 0 }) > 0 : false,
        tapaBarras: area(rr, { x: bars.left, y: bars.top, w: bars.width, h: bars.height }) > 0,
        volverVisible: !!volver && R(volver).height >= 44,
        // px² del cartel sobre cada silueta (de pie: caja alfa; caída: caja tendida) y sobre cada cara viva
        sobreSiluetas: Object.fromEntries(actores.map((a) => [a.id, sobre(a)]).filter(([, v]) => v > 0)),
        sobreCaras: Object.fromEntries(actores.map((a) => [a.id, cara(a)]).filter(([, v]) => v > 0)),
      };
    }
    return {
      lienzo: { x: cr.left, y: cr.top, w: cr.width, h: cr.height, escala: k }, bg: f.bg, ground: f.ground, lanes: f.lanes, factor: f.factor,
      HUD_TOP: fm.HUD_TOP, hudMedido: sc.hud, botonesTopMundo: (heroBtnTop - cr.top) / k, barrasBottomMundo: (bars.bottom - cr.top) / k,
      hud, actores, nombres, barrasEnemigo, barrasHeroe, cartel,
    };
  });
}

// V4, V7/B5 y el marcador de R31, en vivo, leídos de los objetos de Phaser.
async function dinamica(page) {
  return page.evaluate(async () => {
    const sc = window.__combatGame.scene.getScene('combat');
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const k = sc.cssPerWorld();
    const e0 = sc.actors.e0;
    // V4: tres números simultáneos sobre el mismo enemigo (normal, crítico, normal)
    const ts = [sc.floatAt(e0, 37, '#e6dcc3'), sc.floatAt(e0, 96, '#ffd35a', true), sc.floatAt(e0, 52, '#e6dcc3')];
    const rect = (t) => { const b = t.getBounds(); return { x: b.x, y: b.y, w: b.width, h: b.height }; };
    const cruza = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w;
    const pisan = (rs) => rs.some((a, i) => rs.some((b, j) => j > i && cruza(a, b) && a.y < b.y + b.h && b.y < a.y + a.h));
    const r0 = ts.map(rect);
    // cada par seguido: en la misma columna, hueco vertical (px CSS) entre el borde superior real del anterior y la base
    // del nuevo; en columnas distintas, hueco horizontal entre las dos cajas
    const pares = [0, 1].map((i) => {
      const [a, b] = [r0[i], r0[i + 1]];
      return cruza(a, b)
        ? { columna: 'misma', huecoCss: Math.round((a.y - (b.y + b.h)) * k * 10) / 10 }
        : { columna: 'otra', huecoCss: Math.round((Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w)) * k * 10) / 10 };
    });
    const v4 = {
      cssPorMundo: k,
      normalCss: parseFloat(ts[0].style.fontSize) * k, criticoCss: parseFloat(ts[1].style.fontSize) * k,
      escalaInicial: ts[0].scaleX, baseNumero: ts[0].y, cabeza: e0.base.headY, caraBajo: e0.base.headY + 0.35 * e0.base.alphaH,
      sobreLaCabeza: ts.every((t) => t.y <= e0.base.headY),
      pares, apiladoCss: pares.filter((p) => p.columna === 'misma').map((p) => p.huecoCss),
      pisanAlNacer: pisan(r0), asomanArribaAlNacer: r0.filter((r) => r.y < 0).length,
      bajoLasBarrasAlNacer: sc.hud && Number.isFinite(sc.hud.top) ? r0.filter((r) => r.y < sc.hud.top).length : null,
    };
    const y0 = ts[0].y;
    await wait(140);
    v4.escala140ms = ts[0].scaleX;
    v4.pisanA140ms = pisan(ts.map(rect));
    await wait(700);
    v4.subidaCss840ms = Math.round((y0 - ts[0].y) * k * 10) / 10;
    v4.vivoA840ms = ts[0].active && ts[0].alpha > 0.01;
    await wait(200);
    // golpes escalonados como en el combate: 37; a +250 ms «¡Crítico!» y 96!; a +500 ms 52. Se mira cada cuadro.
    const esc = [];
    esc.push(sc.floatAt(e0, 37, '#e6dcc3'));
    setTimeout(() => { esc.push(sc.floatAt(e0, '¡Crítico!', '#ffd35a')); esc.push(sc.floatAt(e0, '96!', '#ffd35a', true)); }, 250);
    setTimeout(() => esc.push(sc.floatAt(e0, 52, '#e6dcc3')), 500);
    let cuadrosEsc = 0;
    let pisadasEsc = 0;
    const te = performance.now();
    await new Promise((res) => {
      const tick = () => {
        cuadrosEsc += 1;
        if (pisan(esc.filter((t) => t.active && t.alpha > 0.02).map(rect))) pisadasEsc += 1;
        if (performance.now() - te < 1400) requestAnimationFrame(tick); else res();
      };
      requestAnimationFrame(tick);
    });
    v4.escalonado = { cuadros: cuadrosEsc, cuadrosConPisada: pisadasEsc };
    // V7 y B5: el tirador (h3, a la derecha) dispara a e0; los compañeros no tienen el fogonazo encima
    const h3 = sc.actors.h3;
    sc.playBeat({ kind: 'hit', actorId: 'h3', targetId: 'e0', num: 7, color: '#e6dcc3', intensity: 1 });
    const shot = sc.lastShot;
    const v7 = {
      flipDurante: h3.sp.flipX, anguloDurante: h3.sp.angle, texturaDurante: h3.sp.texture.key, recorteDurante: !!h3.sp.isCropped,
      cuadroDurante: h3.sp.frame && h3.sp.frame.name, anchoCuadroDurante: h3.sp.width,
      // silueta medida del tirador inclinado (envolvente de ATTACK_FX), con su corrimiento dentro del contenedor
      corrimiento: h3.sp.x, siluetaX: (() => { const q = sc.silhouetteX(h3); return q && { lo: q.lo + h3.sp.x, hi: q.hi + h3.sp.x }; })(),
      objetivoALaIzquierda: e0.base.x < h3.base.x,
      boca: shot && shot.muzzle, objetivo: shot && shot.to,
      bocaSobreCompañero: shot ? Object.values(sc.actors).filter((o) => o !== h3 && o.kind === 'hero' && !o.dead)
        .filter((o) => Math.abs(shot.muzzle.x - o.base.x) < o.base.alphaW / 2 && shot.muzzle.y > o.base.headY && shot.muzzle.y < o.base.y).map((o) => o.id) : null,
      estelaHastaObjetivo: shot ? Math.abs(shot.tracer.scaleX * 64 - Math.hypot(shot.to.x - shot.muzzle.x, shot.to.y - shot.muzzle.y)) < 0.5 : false,
      // T10.8 (B5): la estela y el proyectil van por detrás de toda la fila de héroes y por delante de los enemigos
      profundidad: shot ? {
        estela: shot.tracer.depth, proyectil: shot.ball.depth, fogonazo: shot.flash.depth, tirador: h3.c.depth,
        heroeMin: Math.min(...Object.values(sc.actors).filter((o) => o.kind === 'hero').map((o) => o.c.depth)),
        enemigoMax: Math.max(...Object.values(sc.actors).filter((o) => o.kind === 'enemy').map((o) => o.c.depth)),
      } : null,
    };
    await wait(700);
    Object.assign(v7, {
      flipDespues: h3.sp.flipX, anguloDespues: h3.sp.angle, texturaDespues: h3.sp.texture.key, recorteDespues: !!h3.sp.isCropped,
      cuadroDespues: h3.sp.frame && h3.sp.frame.name,
    });
    const h1 = sc.actors.h1;
    sc.playBeat({ kind: 'hit', actorId: 'h1', targetId: 'e0', num: 7, color: '#e6dcc3', intensity: 1 });
    await wait(60);
    Object.assign(v7, { h1FlipDurante: h1.sp.flipX, h1ObjetivoALaDerecha: e0.base.x > h1.base.x });
    await wait(700);
    // marcador de R31: un enemigo golpea a cada héroe; se mira la textura de todos en cada cuadro durante 600 ms
    const vistas = new Set();
    let marcador = 0;
    let cuadros = 0;
    const t0 = performance.now();
    let i = 0;
    for (const h of ['h1', 'h2', 'h3', 'h4', 'h5']) sc.playBeat({ kind: 'hit', actorId: 'e0', targetId: h, num: 11 + (i++), color: '#e6dcc3', intensity: 1 });
    await new Promise((res) => {
      const tick = () => {
        cuadros += 1;
        for (const a of Object.values(sc.actors)) { const t = a.sp.texture.key; vistas.add(t); if (t.startsWith('ph:')) marcador += 1; }
        if (performance.now() - t0 < 600) requestAnimationFrame(tick); else res();
      };
      requestAnimationFrame(tick);
    });
    return { v4, v7, r31: { cuadros, texturasVistas: [...vistas].sort(), cuadrosConMarcador: marcador } };
  });
}

// Secuencias de animación (412×860): recortes de pantalla seguidos, con su hora real.
async function secuencia(page, nombre, disparar, region, tiempos) {
  const cr = await page.evaluate(() => { const r = window.__combatGame.canvas.getBoundingClientRect(); return { x: r.left, y: r.top, k: r.width / 824 }; });
  const clip = { x: cr.x + region.x * cr.k, y: cr.y + region.y * cr.k, width: region.w * cr.k, height: region.h * cr.k };
  await page.evaluate(disparar);
  const t0 = Date.now();
  const cuadros = [];
  for (const t of tiempos) {
    const espera = t - (Date.now() - t0);
    if (espera > 0) await page.waitForTimeout(espera);
    const png = await page.screenshot({ type: 'png', clip });
    cuadros.push({ png, ms: Date.now() - t0 });
  }
  const tiles = [];
  for (const c of cuadros) {
    const b = await sharp(c.png).resize({ height: 360 }).png().toBuffer();
    const m = await sharp(b).metadata();
    tiles.push({ b, w: m.width, ms: c.ms });
  }
  const W = tiles.reduce((s, t) => s + t.w + 6, 6);
  const comp = [];
  let x = 6;
  for (const t of tiles) {
    comp.push({ input: t.b, left: x, top: 30 });
    comp.push({ input: Buffer.from(`<svg width="${t.w}" height="26"><text x="2" y="20" font-size="18" font-family="sans-serif" fill="#e6dcc3">+${t.ms} ms</text></svg>`), left: x, top: 2 });
    x += t.w + 6;
  }
  await sharp({ create: { width: W, height: 396, channels: 3, background: '#120a07' } }).composite(comp).webp({ quality: 80 }).toFile(path.join(HERE, `secuencia_${nombre}.webp`));
  return cuadros.map((c) => c.ms);
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
  const caidos = m.actores.filter((a) => a.muerto);
  const r = {};
  // V2: pies vs. su carril, carriles vs. el piso del fondo y vs. el borde real de los botones de ESTA pantalla
  r.V2 = {
    piePeorDesvio: Math.max(0, ...vivos.map((a) => Math.abs(a.pie - a.lane))),
    carriles: m.lanes, piso: m.ground, carrilMinimo: Math.min(...Object.values(m.lanes)), carrilMaximo: Math.max(...Object.values(m.lanes)),
    sobrePiso: Object.values(m.lanes).every((l) => l > m.ground),
    sobreBotones: Math.max(...m.actores.map((a) => a.lane)) <= m.botonesTopMundo,
    botonesTopMundo: Math.round(m.botonesTopMundo * 10) / 10,
  };
  // V3: solape dentro de cada fila (de pie y tendidos) y HUD sobre siluetas
  const filas = {};
  for (const a of vivos) (filas[a.row] = filas[a.row] || []).push(a);
  let solapeFila = 0;
  for (const list of Object.values(filas)) {
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const ov = Math.max(0, Math.min(list[i].alphaBox.x + list[i].alphaBox.w, list[j].alphaBox.x + list[j].alphaBox.w) - Math.max(list[i].alphaBox.x, list[j].alphaBox.x));
      if (Math.abs(list[i].lane - list[j].lane) < 1) solapeFila = Math.max(solapeFila, ov / Math.min(list[i].alphaBox.w, list[j].alphaBox.w));
    }
  }
  const tf = {};
  for (const a of caidos) (tf[a.row] = tf[a.row] || []).push(a.tendido);
  let solapeTendidos = 0;
  let cabezaSobreCabeza = false;
  for (const list of Object.values(tf)) {
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const [p, q] = [list[i], list[j]];
      const ov = Math.max(0, Math.min(p.x + p.w, q.x + q.w) - Math.max(p.x, q.x));
      solapeTendidos = Math.max(solapeTendidos, ov / Math.min(p.w, q.w));
      if ((p.head > q.x && p.head < q.x + q.w) || (q.head > p.x && q.head < p.x + p.w)) cabezaSobreCabeza = true;
    }
  }
  r.V3 = {
    solapeMaxDentroDeFila: Math.round(solapeFila * 1000) / 10,
    solapeMaxTendidos: Math.round(solapeTendidos * 1000) / 10, cabezaSobreCabeza,
    hudSobreSiluetas: vivos.map((a) => ({ id: a.id, pct: Math.round((1000 * m.hud.reduce((s, h) => s + inter(a.alphaBox, h), 0)) / (a.alphaBox.w * a.alphaBox.h)) / 10 })).filter((x) => x.pct > 0),
    cabezaBajoBarras: vivos.filter((a) => a.kind === 'enemy').every((a) => a.alphaBox.y >= m.barrasBottomMundo),
    barrasBottomMundo: Math.round(m.barrasBottomMundo * 10) / 10,
  };
  return r;
}

/** Hoja de contacto: una fila por viewport y una columna por vista, con rótulo (escritorio: columna del juego). */
async function hojaContacto(capturas) {
  const H = 420; const PAD = 10; const LBL = 26;
  const filas = [];
  for (const vp of VPS) {
    const fila = [];
    for (const c of capturas.filter((x) => x.vp.name === vp.name)) {
      let img = sharp(c.file);
      if (vp.w > 800) {
        const left = Math.max(0, Math.round((c.lienzo.x - 40) * vp.dpr));
        const width = Math.min(Math.round(vp.w * vp.dpr) - left, Math.round((c.lienzo.w + 80) * vp.dpr));
        img = sharp(await img.extract({ left, top: 0, width, height: Math.round(vp.h * vp.dpr) }).png().toBuffer());
      }
      const buf = await img.resize({ height: H }).png().toBuffer();
      const meta = await sharp(buf).metadata();
      const corto = c.esc.key.replace('enemigos', 'en.').replace('enemigo', 'en.').replace('victoria', 'V').replace('derrota', 'D');
      fila.push({ buf, w: meta.width, label: `${vp.name} ${corto}` });
    }
    filas.push(fila);
  }
  const W = Math.max(...filas.map((f) => f.reduce((s, t) => s + t.w + PAD, PAD)));
  const comp = [];
  let y = PAD;
  for (const fila of filas) {
    let x = PAD;
    for (const t of fila) {
      comp.push({ input: Buffer.from(`<svg width="${t.w}" height="${LBL}"><text x="2" y="19" font-size="14" font-family="sans-serif" fill="#e6dcc3">${t.label}</text></svg>`), left: x, top: y });
      comp.push({ input: t.buf, left: x, top: y + LBL });
      x += t.w + PAD;
    }
    y += LBL + H + PAD;
  }
  await sharp({ create: { width: W, height: y, channels: 3, background: '#120a07' } }).composite(comp).webp({ quality: 78 }).toFile(path.join(HERE, 'hoja_contacto.webp'));
}

const PRUEBA = process.argv.includes('--prueba');   // solo 412×860 de pie con 1 enemigo, dinámica y secuencias
const run = async () => {
  if (process.argv.includes('--solo-hoja')) {
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
    for (const vp of (PRUEBA ? VPS.slice(0, 1) : VPS)) {
      await respirar(30);
      const { ctx, page, errores } = await abrir(browser, vp);
      for (const esc of (PRUEBA ? SCEN.slice(0, 1) : SCEN.filter((e) => !vp.escenas || vp.escenas.includes(e.key)))) {
        const nombre = `${vp.name}_${esc.key}`;
        await respirar();
        await abrirEscenario(page, esc);
        const png = await page.screenshot({ type: 'png' });
        const file = path.join(HERE, `${nombre}.webp`);
        await sharp(png).webp({ quality: 80 }).toFile(file);
        const m = await medir(page);
        capturas.push({ vp, esc, file, lienzo: m.lienzo });
        const r = resumen(m);
        r.caraTapadaPct = await caraTapada(m.actores);
        r.caraTapadaMax = Math.max(0, ...Object.values(r.caraTapadaPct));
        if (esc.key === '1enemigo') Object.assign(r, await dinamica(page));
        if (esc.key === '1enemigo' && vp.name === '412x860') {
          await page.waitForTimeout(1000);   // que terminen los números de R31 (si no, el nuevo se apila arriba de ellos)
          r.secuencias = {
            golpe_heroe: await secuencia(page, 'golpe_heroe', () => {
              const sc = window.__combatGame.scene.getScene('combat');
              sc.playBeat({ kind: 'hit', actorId: 'e0', targetId: 'h3', num: 23, color: '#e6dcc3', intensity: 1 });
            }, { x: 470, y: 760, w: 354, h: 580 }, [0, 60, 130, 220, 330, 460]),
          };
          await page.waitForTimeout(900);
          // como en una ronda real: golpe de Lyra (37); Aria anuncia el crítico y a +300 ms pega 96!; a +550 ms, golpe
          // de Viktor (52). El cartel «¡Crítico!» sale sobre Aria y los números se apilan sobre el bruto.
          r.secuencias.numeros = await secuencia(page, 'numeros', () => {
            const sc = window.__combatGame.scene.getScene('combat');
            const C = { color: '#e6dcc3', intensity: 1 };
            sc.playBeat({ ...C, kind: 'hit', actorId: 'h2', targetId: 'e0', num: 37 });
            sc.playBeat({ kind: 'passive', actorId: 'h1', targetId: 'e0', fx: 'crit', text: '¡Crítico!', color: '#ffd35a', intensity: 2 });
            setTimeout(() => sc.playBeat({ kind: 'hit', actorId: 'h1', targetId: 'e0', num: 96, color: '#ffd35a', intensity: 2 }), 300);
            setTimeout(() => sc.playBeat({ ...C, kind: 'hit', actorId: 'h4', targetId: 'e0', num: 52 }), 550);
          }, { x: 0, y: 0, w: 824, h: 1100 }, [0, 120, 300, 420, 560, 700, 860, 1100]);
          await page.waitForTimeout(900);
          r.secuencias.tirador = await secuencia(page, 'tirador', () => {
            const sc = window.__combatGame.scene.getScene('combat');
            sc.playBeat({ kind: 'hit', actorId: 'h3', targetId: 'e0', num: 31, color: '#e6dcc3', intensity: 1 });
          }, { x: 250, y: 380, w: 574, h: 960 }, [0, 30, 70, 120, 200, 320, 480]);
          await page.waitForTimeout(900);
        }
        medidas[nombre] = { ...r, crudo: m };
        console.log(nombre, 'pie±', r.V2.piePeorDesvio.toFixed(2), 'carriles', JSON.stringify(m.lanes), 'piso', m.ground,
          'botones', r.V2.botonesTopMundo, 'hud>silueta', r.V3.hudSobreSiluetas.length, 'cara tapada máx', `${r.caraTapadaMax}%`,
          m.cartel ? `cartel ${(m.cartel.centro * 100).toFixed(1)}% alto ${m.cartel.alto.toFixed(0)} sobre ${JSON.stringify(m.cartel.sobreSiluetas)} caras ${JSON.stringify(m.cartel.sobreCaras)} ok ${m.cartel.ok}` : '');
      }
      erroresTodos.push(...errores.map((e) => `${vp.name}: ${e}`));
      console.log(vp.name, 'peticiones /api en el último minuto:', API.filter((t) => Date.now() - t < 60000).length, 'en total:', API.length);
      await ctx.close();
    }
  } finally {
    await browser.close();
  }
  medidas.errores = erroresTodos;
  if (PRUEBA) {
    console.log(JSON.stringify(Object.values(medidas)[0].v4), JSON.stringify(Object.values(medidas)[0].v7));
    return;
  }
  fs.writeFileSync(path.join(HERE, 'hoja_medidas.json'), JSON.stringify(medidas, null, 1));
  await hojaContacto(capturas);
  console.log('errores de consola/página:', erroresTodos.length ? erroresTodos : 'ninguno');
};

run().catch((e) => { console.error(e); process.exit(1); });
