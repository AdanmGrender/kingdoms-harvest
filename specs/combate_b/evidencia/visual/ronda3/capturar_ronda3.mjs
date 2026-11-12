// Revisión visual ronda 3 (visual_reviewer, Etapa C · T10.7/T10.8, HEAD ecdcc99). Lo que la hoja de evidencia no trae:
// crypt con 2 y 4 carroñeros (B4), el disparo del tirador cuadro a cuadro a @2 (B5/V7), las ráfagas de números en las
// pantallas bajas (V4), el golpe a los 5 héroes muestreado por cuadro (marcador de R31) y la caída/giro (V6/V7).
// Mismo andamiaje que evidencia/hoja/generar_evidencia_hoja.mjs y ronda2/capturar_ronda2.mjs (estado sintético runId −1,
// `stepInstance` sustituido, auto-avance de 2 s en pausa), sin tocar código de la app. Escuadra: aria, lyra, elena,
// viktor, shadow. Para mirar cuadros a @2 se frena la escena: tweens y relojes de Phaser a ×0,1 (la geometría no cambia;
// los tiempos reales salen del muestreo por requestAnimationFrame a velocidad normal).
// Preview aislado: server del worktree :3003 (BOT_TOKEN ficticio, BOT_POLLING=false, WEBAPP_URL=http://localhost:5175)
// y vite :5175 --strictPort con VITE_API_URL=http://localhost:3003.
// Uso: KH_PREVIEW_URL=http://localhost:5175 node capturar_ronda3.mjs <crypt|tirador|numeros|golpe|caida|giro>
import { createRequire } from 'node:module';
import fs from 'node:fs';
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

const SQUAD = ['aria', 'lyra', 'elena', 'viktor', 'shadow'];
const ENERGY = [100, 40, 100, 70, 20];
const en = (i, hp = 600, maxHp = 900) => ({ id: `e${i}`, name: `Enemigo ${i + 1}`, hp, maxHp, dps: 40, def: 0, spd: 0 });
const ens = (m, hp, maxHp) => Array.from({ length: m }, (_, i) => en(i, hp, maxHp));
const NODES = {
  a1n3: { id: 'a1n3', act: 1, type: 'combat', name: 'Merodeadores del Páramo' },
  a1n7: { id: 'a1n7', act: 1, type: 'combat', name: 'Carroñeros' },
  a1n9: { id: 'a1n9', act: 1, type: 'boss', isBoss: true, name: 'Devorador de Almas' },
  a2n10: { id: 'a2n10', act: 2, type: 'boss', isBoss: true, name: 'La Voz del Velo' },
};
const MOVIL = { 412: [412, 860], 375: [375, 667] };

// el server local limita /api a 100 por minuto: antes de cada escena se espera a que la ventana tenga sitio
const API = [];
async function respirar(max = 70) {
  for (;;) {
    const now = Date.now();
    if (API.filter((t) => now - t < 60000).length <= max) return;
    await new Promise((r) => setTimeout(r, 2000));
  }
}

async function abrir(browser, { w, h, dpr = 2, mobile = true }) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, isMobile: mobile, hasTouch: true });
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
  page.on('request', (r) => { if (r.url().includes('/api/')) API.push(Date.now()); });
  await respirar();
  await page.goto(URL_, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__gameStore, null, { timeout: 30000 });
  await page.evaluate(() => window.__gameStore.getState().enterGame());
  await page.waitForFunction(() => window.__phaserGame && window.__phaserGame.scene.isActive('HubSceneB'), null, { timeout: 60000 });
  await page.waitForTimeout(1200);
  await page.evaluate(() => { const s = window.__gameStore.getState(); s.dismissOfflineReport && s.dismissOfflineReport(); });
  return { ctx, page, errores };
}

function preparar(esc) {
  const heroes = SQUAD.slice(0, esc.nHeroes ?? 5).map((id, i) => ({
    slot: i + 1, heroId: id, class: HEROES[id].class, name: HEROES[id].name, atk: 60, hp: 200, maxHp: 200,
    energy: ENERGY[i], energyMax: 100, alive: true, def: 0, spd: 0,
  }));
  const s0 = { engine: 2, round: 1, maxRounds: 10, shield: 0, log: [], events: [], eventsVersion: 1, enemies: esc.enemies, enemy: esc.enemies[0], heroes };
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
    esc.enemies.forEach((e, i) => { evs.push({ kind: 'hit', actor: `h${(i % 3) + 1}`, target: e.id, value: e.hp, hp: 0 }); evs.push({ kind: 'death', actor: `h${(i % 3) + 1}`, target: e.id, value: 0 }); });
    evs.push({ kind: 'end', actor: null, target: null, value: 'victory' });
    ronda(evs, (s) => { const es = s.enemies.map((e) => ({ ...e, hp: 0 })); return { ...s, enemies: es, enemy: es[0] }; }, 'victory');
  } else if (esc.result === 'defeat') {
    const evs = [];
    for (const h of heroes) evs.push({ kind: 'hit', actor: 'e0', target: `h${h.slot}`, value: 200, hp: 0 });
    for (const h of heroes) evs.push({ kind: 'death', actor: 'e0', target: `h${h.slot}`, value: 0 });
    evs.push({ kind: 'end', actor: null, target: null, value: 'defeat' });
    ronda(evs, (s) => ({ ...s, heroes: s.heroes.map((h) => ({ ...h, hp: 0, alive: false, energy: 0 })) }), 'defeat');
  }
  return { s0, rondas };
}

async function abrirEscenario(page, esc) {
  const { s0, rondas } = preparar(esc);
  await respirar();
  await page.evaluate(() => { const s = window.__gameStore.getState(); s.clearActiveRun && s.clearActiveRun(); s.clearOverlay && s.clearOverlay(); });
  await page.waitForTimeout(400);
  await page.waitForFunction(() => !window.__combatGame, null, { timeout: 10000 });
  await page.evaluate(({ node, s0, rondas }) => {
    const store = window.__gameStore;
    window.__khRondas = rondas;
    window.__khGate = null;
    store.setState({
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
  await page.waitForFunction(() => { const g = window.__combatGame; const sc = g && g.scene && g.scene.getScene('combat'); return sc && sc.ready; }, null, { timeout: 30000 });
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await page.waitForTimeout(1000);
}

async function soltarRonda(page) {
  await page.evaluate(() => { if (!window.__khGate) [...document.querySelectorAll('button')].find((b) => /Avanzar ronda/.test(b.textContent)).click(); });
  await page.waitForFunction(() => window.__khGate, null, { timeout: 5000 });
  return page.evaluate(() => { const t = Date.now() / 1000; window.__khGate(); return t; });
}

const shot = async (page, file) => { const png = await page.screenshot({ type: 'png' }); await sharp(png).webp({ quality: 88 }).toFile(file); return png; };
const ocultarHeroes = (page, o = true) => page.evaluate((o) => {
  const sc = window.__combatGame.scene.getScene('combat');
  for (const a of Object.values(sc.actors)) if (a.kind === 'hero') a.c.setVisible(!o);
}, o);
const frenar = (page, f) => page.evaluate((f) => { const sc = window.__combatGame.scene.getScene('combat'); sc.tweens.timeScale = f; sc.time.timeScale = f; }, f);

/** Geometría: lienzo, carriles, piso, factor, botones/barras medidos, actores (pies en x con su pose) y textos. */
const medir = (page) => page.evaluate(async () => {
  const art = await import('/src/game/combat/artMap.js');
  const sc = window.__combatGame.scene.getScene('combat');
  const cr = window.__combatGame.canvas.getBoundingClientRect();
  const k = cr.width / 824;
  const f = sc.formation;
  const actores = Object.values(sc.actors).map((a) => {
    const key = a.sp.texture.key;
    const m = /^(hero|enemy):([a-z_]+):([a-z]+)$/.exec(key);
    const g = m ? art.spriteGeom(m[1], m[2], m[3]) : null;
    return {
      id: a.id, kind: a.kind, art: a.art, row: a.row, lane: a.base.y, cx: a.base.x, h: a.base.h, headY: a.base.headY, alphaH: a.base.alphaH, alphaW: a.base.alphaW,
      tex: key, frame: a.sp.frame && a.sp.frame.name, flip: a.sp.flipX, ang: a.sp.angle, spx: a.sp.x, cxNow: a.c.x, depth: a.c.depth, muerto: !!a.dead,
      pie: g && g.pl !== undefined ? { pl: a.base.x + (g.pl - g.ox * g.W) * a.sp.scaleX, pr: a.base.x + (g.pr - g.ox * g.W) * a.sp.scaleX } : null,
      silueta: sc.silhouetteX ? sc.silhouetteX(a) : null,
    };
  });
  return { lienzo: { x: cr.left, y: cr.top, w: cr.width, h: cr.height, k }, bg: f.bg, ground: f.ground, lanes: f.lanes, factor: f.factor, hud: sc.hud, actores };
});

// ── modos ──────────────────────────────────────────────────────────────────

/** B4: crypt con 2, 3 y 4 carroñeros (con y sin héroes) en 412×860 y 375×667. */
async function crypt(browser) {
  const out = {};
  for (const [w, h] of Object.values(MOVIL)) {
    const { ctx, page, errores } = await abrir(browser, { w, h });
    try {
      for (const m of [2, 3, 4]) {
        await abrirEscenario(page, { node: NODES.a1n7, enemies: ens(m) });
        const base = `crypt_${w}x${h}_${m}en`;
        await shot(page, path.join(HERE, `${base}.webp`));
        out[base] = await medir(page);
        await ocultarHeroes(page);
        await page.waitForTimeout(150);
        await shot(page, path.join(HERE, `${base}_sinheroes.webp`));
        const e = out[base].actores.filter((a) => a.kind === 'enemy');
        console.log(base, 'carriles', JSON.stringify(out[base].lanes), 'pies', e.map((a) => `${a.id}:${a.row}@${a.lane} x ${a.pie ? `${a.pie.pl.toFixed(0)}–${a.pie.pr.toFixed(0)}` : '?'}`).join(' '));
      }
    } finally { out[`errores_${w}`] = errores; await ctx.close(); }
  }
  fs.writeFileSync(path.join(HERE, 'medidas_crypt.json'), JSON.stringify(out, null, 1));
}

/**
 * B5/V7: el tirador (h3) dispara a un enemigo con la escena frenada ×0,1: capturas @2 cada ~120 ms de reloj (≈ 12 ms de
 * escena) hasta que vuelve a idle. Se guardan las capturas en KH_RAW_DIR y una tira de recortes en ronda3/.
 */
async function tirador(browser) {
  const RAW = process.env.KH_RAW_DIR || path.join(HERE, 'crudo');
  const out = {};
  const { ctx, page, errores } = await abrir(browser, { w: 412, h: 860 });
  try {
    for (const [nombre, esc, objetivo] of [
      ['1en', { node: NODES.a1n3, enemies: [en(0)] }, 'e0'],
      ['3en_e2', { node: NODES.a1n7, enemies: ens(3) }, 'e2'],
      ['3en_e0', { node: NODES.a1n7, enemies: ens(3) }, 'e0'],
      ['4veil_e0', { node: NODES.a2n10, enemies: ens(4) }, 'e0'],
      ['jefe', { node: NODES.a1n9, enemies: [en(0, 2400, 2400)] }, 'e0'],
    ]) {
      await abrirEscenario(page, esc);
      await frenar(page, 0.1);
      const dir = path.join(RAW, `tirador_${nombre}`);
      fs.mkdirSync(dir, { recursive: true });
      const t0 = Date.now();
      await page.evaluate((objetivo) => {
        const sc = window.__combatGame.scene.getScene('combat');
        sc.playBeat({ kind: 'hit', actorId: 'h3', targetId: objetivo, num: 31, color: '#e6dcc3', intensity: 1 });
      }, objetivo);
      const cuadros = [];
      for (let i = 0; i < 40 && Date.now() - t0 < 5200; i++) {
        const dt = Date.now() - t0;
        const g = await page.evaluate(() => {
          const sc = window.__combatGame.scene.getScene('combat');
          const a = sc.actors.h3;
          const s = sc.lastShot;
          return {
            tex: a.sp.texture.key, frame: a.sp.frame && a.sp.frame.name, ancho: a.sp.width, flip: a.sp.flipX, ang: a.sp.angle, spx: a.sp.x,
            silueta: sc.silhouetteX(a), boca: s && s.muzzle, a: s && s.to,
            estela: s && s.tracer && s.tracer.active ? { depth: s.tracer.depth, alfa: s.tracer.alpha } : null,
            fogonazo: s && s.flash && s.flash.active ? { depth: s.flash.depth, alfa: s.flash.alpha } : null,
            proyectil: s && s.ball && s.ball.active ? { x: s.ball.x, y: s.ball.y, depth: s.ball.depth } : null,
          };
        });
        const file = path.join(dir, `${String(i).padStart(2, '0')}_+${Math.round(dt / 10)}ms_escena.png`);
        const png = await page.screenshot({ type: 'png' });
        fs.writeFileSync(file, png);
        cuadros.push({ i, escenaMs: Math.round(dt / 10), file: path.basename(file), ...g });
      }
      await frenar(page, 1);
      out[nombre] = { objetivo, cuadros, actores: (await medir(page)).actores.filter((a) => a.kind === 'hero' || a.id === objetivo) };
      const c = cuadros.find((q) => q.frame === 'sin_fogonazo' || /attack/.test(q.tex));
      console.log(nombre, 'cuadros', cuadros.length, 'pose', c && `${c.tex}/${c.frame} ancho ${c.ancho} flip ${c.flip} ang ${c.ang} spx ${c.spx && c.spx.toFixed(1)} silueta ${c.silueta && `${c.silueta.lo.toFixed(1)}–${c.silueta.hi.toFixed(1)}`}`);
    }
  } finally { out.errores = errores; await ctx.close(); }
  fs.writeFileSync(path.join(HERE, 'medidas_tirador.json'), JSON.stringify(out, null, 1));
}

/**
 * V4: ráfaga 37 / 96! / 52 en el mismo cuadro sobre el bruto (como la prueba de la hoja) y la secuencia con crítico
 * (37; «¡Crítico!» de Aria y 96!; 52), con la escena frenada, en 412×860, 360×800, 360×740, 375×667 y 1280×800.
 */
async function numeros(browser) {
  const out = {};
  const pantallas = [
    { w: 412, h: 860 }, { w: 360, h: 800 }, { w: 360, h: 740 }, { w: 375, h: 667 }, { w: 1280, h: 800, dpr: 1.5, mobile: false },
  ];
  for (const p of pantallas) {
    const nombre = `${p.w}x${p.h}`;
    const { ctx, page, errores } = await abrir(browser, p);
    try {
      // ráfaga en el mismo cuadro
      await abrirEscenario(page, { node: NODES.a1n3, enemies: [en(0)] });
      await frenar(page, 0.1);
      const r = await page.evaluate(() => {
        const sc = window.__combatGame.scene.getScene('combat');
        const e0 = sc.actors.e0;
        window.__khTs = [sc.floatAt(e0, 37, '#e6dcc3'), sc.floatAt(e0, 96, '#ffd35a', true), sc.floatAt(e0, 52, '#e6dcc3')];
        const k = sc.cssPerWorld();
        return { k, hud: sc.hud, cabeza: e0.base.headY, ts: window.__khTs.map((t) => { const b = t.getBounds(); return { txt: t.text, px: parseFloat(t.style.fontSize) * k, x: b.x, y: b.y, w: b.width, h: b.height }; }) };
      });
      await shot(page, path.join(HERE, `numeros_${nombre}_rafaga_0ms.webp`));
      await page.waitForTimeout(1400);   // ≈ 140 ms de escena: fin del pop
      const r140 = await page.evaluate(() => window.__khTs.map((t) => { const b = t.getBounds(); return { txt: t.text, esc: t.scaleX, x: b.x, y: b.y, w: b.width, h: b.height }; }));
      await shot(page, path.join(HERE, `numeros_${nombre}_rafaga_140ms.webp`));
      await page.waitForTimeout(3000);   // ≈ 440 ms
      await shot(page, path.join(HERE, `numeros_${nombre}_rafaga_440ms.webp`));
      await frenar(page, 1);
      await page.waitForTimeout(1200);
      // golpes escalonados con crítico, como en combate
      await frenar(page, 0.1);
      await page.evaluate(() => {
        const sc = window.__combatGame.scene.getScene('combat');
        const C = { color: '#e6dcc3', intensity: 1 };
        sc.playBeat({ ...C, kind: 'hit', actorId: 'h2', targetId: 'e0', num: 37 });
        sc.playBeat({ kind: 'passive', actorId: 'h1', targetId: 'e0', fx: 'crit', text: '¡Crítico!', color: '#ffd35a', intensity: 2 });
        sc.time.delayedCall(300, () => sc.playBeat({ kind: 'hit', actorId: 'h1', targetId: 'e0', num: 96, color: '#ffd35a', intensity: 2 }));
        sc.time.delayedCall(550, () => sc.playBeat({ ...C, kind: 'hit', actorId: 'h4', targetId: 'e0', num: 52 }));
      });
      for (const [esp, tag] of [[1500, '150'], [2500, '400'], [2500, '650'], [2000, '850']]) {
        await page.waitForTimeout(esp);
        await shot(page, path.join(HERE, `numeros_${nombre}_critico_${tag}ms.webp`));
      }
      await frenar(page, 1);
      out[nombre] = { rafaga: r, rafaga140: r140, lienzo: (await medir(page)).lienzo };
      console.log(nombre, 'k', r.k.toFixed(4), 'barras', r.hud && r.hud.top, 'cabeza', r.cabeza.toFixed(1), r.ts.map((t) => `${t.txt}:${t.px.toFixed(1)}px y ${t.y.toFixed(0)}–${(t.y + t.h).toFixed(0)} x ${t.x.toFixed(0)}–${(t.x + t.w).toFixed(0)}`).join(' | '));
    } finally { out[`errores_${nombre}`] = errores; await ctx.close(); }
  }
  fs.writeFileSync(path.join(HERE, 'medidas_numeros.json'), JSON.stringify(out, null, 1));
}

/** Marcador de R31: el bruto golpea a los 5 héroes (sin matar); textura de cada héroe muestreada por cuadro, y tira frenada. */
async function golpe(browser) {
  const out = {};
  for (const [w, h] of Object.values(MOVIL)) {
    const nombre = `${w}x${h}`;
    const { ctx, page, errores } = await abrir(browser, { w, h });
    try {
      await abrirEscenario(page, { node: NODES.a1n3, enemies: [en(0)] });
      const muestras = await page.evaluate(() => new Promise((resolve) => {
        const sc = window.__combatGame.scene.getScene('combat');
        let i = 0;
        for (const id of ['h1', 'h2', 'h3', 'h4', 'h5']) sc.playBeat({ kind: 'hit', actorId: 'e0', targetId: id, num: 11 + (i++), color: '#e6dcc3', intensity: 1 });
        const out = []; const t0 = performance.now();
        const tick = () => {
          const t = performance.now() - t0;
          out.push({ t: Math.round(t), tex: ['h1', 'h2', 'h3', 'h4', 'h5'].map((id) => sc.actors[id].sp.texture.key) });
          if (t < 900) requestAnimationFrame(tick); else resolve(out);
        };
        requestAnimationFrame(tick);
      }));
      const conMarcador = muestras.filter((s) => s.tex.some((k) => String(k).startsWith('ph:')));
      out[nombre] = { cuadros: muestras.length, conMarcador: conMarcador.length, texturas: [...new Set(muestras.flatMap((s) => s.tex))] };
      console.log(nombre, 'cuadros', muestras.length, 'con marcador', conMarcador.length, 'texturas', out[nombre].texturas.join(' '));
      await page.waitForTimeout(600);
      await frenar(page, 0.1);
      await page.evaluate(() => {
        const sc = window.__combatGame.scene.getScene('combat');
        let i = 0;
        for (const id of ['h1', 'h2', 'h3', 'h4', 'h5']) sc.playBeat({ kind: 'hit', actorId: 'e0', targetId: id, num: 21 + (i++), color: '#e6dcc3', intensity: 1 });
      });
      for (const [esp, tag] of [[300, '30'], [700, '100'], [2000, '300']]) {
        await page.waitForTimeout(esp);
        await shot(page, path.join(HERE, `golpe_${nombre}_${tag}ms.webp`));
      }
      await frenar(page, 1);
    } finally { out[`errores_${nombre}`] = errores; await ctx.close(); }
  }
  fs.writeFileSync(path.join(HERE, 'medidas_golpe.json'), JSON.stringify(out, null, 1));
}

/** V6/V7 en una ronda real (planificador): victoria (golpe y caída del bruto) y derrota (5 golpes y 5 caídas), por cuadro. */
async function caida(browser) {
  const out = {};
  const { ctx, page, errores } = await abrir(browser, { w: 412, h: 860 });
  try {
    for (const [tag, esc] of [['victoria', { node: NODES.a1n3, enemies: [en(0, 60)], result: 'victory' }], ['derrota', { node: NODES.a1n3, enemies: [en(0)], result: 'defeat' }]]) {
      await abrirEscenario(page, esc);
      const muestras = page.evaluate(() => new Promise((resolve) => {
        const sc = window.__combatGame.scene.getScene('combat');
        const out = []; const fin = Date.now() + 4200;
        const tick = () => {
          out.push({ w: Date.now() / 1000, act: Object.fromEntries(Object.values(sc.actors).map((a) => [a.id, { tex: a.sp.texture.key, ang: Math.round(a.sp.angle * 10) / 10, alfa: Math.round(a.sp.alpha * 100) / 100, flip: a.sp.flipX, gris: !!a.gray, muerto: !!a.dead }])) });
          if (Date.now() < fin) requestAnimationFrame(tick); else resolve(out);
        };
        requestAnimationFrame(tick);
      }));
      await page.waitForTimeout(300);
      const t0 = await soltarRonda(page);
      const s = (await muestras).map(({ w, ...r }) => ({ dtMs: Math.round((w - t0) * 1000), ...r }));
      const res = {};
      for (const id of Object.keys(s[0].act)) {
        const i0 = s.findIndex((q) => q.act[id].muerto);
        if (i0 < 0) continue;
        const i1 = s.findIndex((q) => Math.abs(q.act[id].ang) >= 89.9);
        const last = s.at(-1).act[id];
        res[id] = { inicio: s[i0].dtMs, tendido: i1 >= 0 ? s[i1].dtMs : null, ms: i1 >= 0 ? s[i1].dtMs - s[i0].dtMs : null, alfa: last.alfa, gris: last.gris, tex: last.tex, ang: last.ang };
      }
      const marcador = s.filter((q) => Object.values(q.act).some((a) => String(a.tex).startsWith('ph:'))).length;
      out[tag] = { caidas: res, cuadros: s.length, conMarcador: marcador };
      console.log(tag, JSON.stringify(res), 'cuadros', s.length, 'con marcador', marcador);
      await page.waitForTimeout(1500);
      await shot(page, path.join(HERE, `caida_${tag}_final.webp`));
    }
  } finally { out.errores = errores; await ctx.close(); }
  fs.writeFileSync(path.join(HERE, 'medidas_caida.json'), JSON.stringify(out, null, 1));
}

/** V7: giro hacia el objetivo y vuelta, muestreado por cuadro a velocidad real (bruto → Elena y → Aria; Aria y Elena → bruto). */
async function giro(browser) {
  const out = {};
  const { ctx, page, errores } = await abrir(browser, { w: 412, h: 860 });
  try {
    await abrirEscenario(page, { node: NODES.a1n3, enemies: [en(0)] });
    for (const [actor, objetivo] of [['e0', 'h3'], ['e0', 'h1'], ['h1', 'e0'], ['h3', 'e0']]) {
      const s = await page.evaluate(({ actor, objetivo }) => new Promise((resolve) => {
        const sc = window.__combatGame.scene.getScene('combat');
        const a = sc.actors[actor];
        const muestra = () => ({ tex: a.sp.texture.key, frame: a.sp.frame && a.sp.frame.name, flip: a.sp.flipX, ang: Math.round(a.sp.angle), x: Math.round(a.c.x) });
        const antes = muestra();
        sc.playBeat({ kind: 'hit', actorId: actor, targetId: objetivo, num: 9, color: '#e6dcc3', intensity: 1 });
        const out = []; const t0 = performance.now();
        const tick = () => {
          const t = performance.now() - t0;
          out.push({ t: Math.round(t), ...muestra() });
          if (t < 900) requestAnimationFrame(tick); else resolve({ antes, durante: out.find((q) => q.t >= 50), fin: out.at(-1), vuelveA: (out.find((q) => q.t > 60 && q.tex === antes.tex && q.flip === antes.flip && q.ang === 0) || {}).t });
        };
        requestAnimationFrame(tick);
      }), { actor, objetivo });
      out[`${actor}>${objetivo}`] = s;
      console.log(`${actor}>${objetivo}`, JSON.stringify(s));
      await page.waitForTimeout(700);
    }
  } finally { out.errores = errores; await ctx.close(); }
  fs.writeFileSync(path.join(HERE, 'medidas_giro.json'), JSON.stringify(out, null, 1));
}

const MODOS = { crypt, tirador, numeros, golpe, caida, giro };
const modo = process.argv[2];
if (!MODOS[modo]) { console.error(`modo: ${Object.keys(MODOS).join(' | ')}`); process.exit(2); }
const browser = await chromium.launch({ headless: true, args: ['--ignore-gpu-blocklist', '--use-angle=d3d11'] });
try { await MODOS[modo](browser); } finally { await browser.close(); }
