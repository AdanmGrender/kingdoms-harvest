'use strict';
/**
 * hub_b_evidence.js — corrida Playwright de evidencia del hub B (specs/hub_b_escena/design.md §9).
 *
 *   node scripts/hub_b_evidence.js [--dpr 2|3] [--device ID] [--url http://localhost:5173]
 *        [--taps] [--build] [--sharpness] [--preview] [--fallback] [--idle] [--fps] [--no-fxoff]
 *
 * Sin flags de modo hace la corrida principal (capturas de tasks.md T16 a DSF 2, T17 a DSF 3). Chromium
 * `channel: 'chromium'` con GPU (`--use-angle=d3d11 --enable-gpu`), 412×860, hasTouch, contra Vite dev (proxy a
 * :3001). La cuenta sale de `localStorage.kh_device_id` (`--device` fijo para reusarla; si no, una nueva). La
 * inyección de estado (`__gameStore.setState`, `setActiveStorm`) es solo presentación: no toca el server.
 * Capturas webp en specs/hub_b_escena/evidencia/; reportes JSON en KH_SCRATCH (o el tmp del sistema).
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');
const sharp = require('sharp');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const EVID = path.join(ROOT, 'specs/hub_b_escena/evidencia');
const SCRATCH = process.env.KH_SCRATCH || os.tmpdir();
const { WARP_STORMS } = require(path.join(ROOT, 'shared/gameConfig.js'));

const IDS = ['farm_plot', 'barn', 'mill', 'sawmill', 'smithy', 'stable', 'house', 'mine', 'wall', 'tower', 'barracks',
  'trap', 'tavern', 'market', 'embassy', 'throne_room', 'library'];
const GENERATED = ['hubb_fog', 'hubb_spark', 'hubb_ember', 'hubb_mote', 'hubb_placeholder', 'hubb_sky_fallback'];
const STORM_IDS = ['velo_estatico', 'marea_carmesi', 'lluvia_de_energia', 'susurros_del_vacio', 'calma_falsa'];
const W = 412;
const H = 860;

function parseArgs(argv) {
  const a = { dpr: 2, device: null, url: 'http://localhost:5173', fxoff: true };
  for (let i = 2; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--dpr') a.dpr = Number(argv[++i]);
    else if (t === '--device') a.device = argv[++i];
    else if (t === '--url') a.url = argv[++i];
    else if (t === '--no-fxoff') a.fxoff = false;
    else if (t.startsWith('--')) a[t.slice(2)] = true;
  }
  return a;
}

const fakeBuildings = (ids, building = () => 0) => ids.map((id, i) => ({
  id: 1000 + i, building_id: id, level: 1, is_building: building(id), position_x: i * 5, position_y: 0,
}));

const stormObj = (id) => {
  const { id: sid, name, color } = WARP_STORMS[id];
  return { id: sid, name, color, ends_at: new Date(Date.now() + 45 * 60000).toISOString() };
};

async function open(args, { dpr = args.dpr, fxOff = false, search = '', waitScene = 'HubSceneB', init = null,
  route = null } = {}) {
  const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=d3d11', '--enable-gpu'] });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: dpr, hasTouch: true });
  const page = await ctx.newPage();
  const logs = { errors: [], pageerrors: [], warns: [], http: [], api: 0 };
  page.on('console', (m) => {
    const loc = m.location() && m.location().url;
    if (m.type() === 'error') logs.errors.push(`${m.text()}${loc ? ` @ ${loc}` : ''}`);
    if (m.type() === 'warning') logs.warns.push(m.text());
  });
  page.on('pageerror', (e) => logs.pageerrors.push(String((e && e.stack) || e)));
  page.on('request', (r) => { if (r.url().includes('/api/')) logs.api++; });
  page.on('response', (r) => { if (r.status() >= 400) logs.http.push(`${r.status()} ${r.url()}`); });
  if (route) await route(page);
  const deviceId = args.device || `hubb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  await page.addInitScript(([did, off]) => {
    try {
      localStorage.setItem('kh_device_id', did);
      localStorage.setItem('kh_ambient_fx', off ? 'false' : 'true');
      localStorage.setItem('kh_tutorial_done', '1');
    } catch { /* storage bloqueado: sigue con los defaults */ }
  }, [deviceId, fxOff]);
  if (init) await page.addInitScript(init);
  await page.goto(`${args.url}/${search}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__gameStore, null, { timeout: 30000 }).catch(() => {});
  // Listeners antes de enterGame(): así llega también el time:updated inicial de DayNightSystem (R28).
  await page.evaluate(async () => {
    const EB = (await import('/src/game/EventBridge.js')).default;
    window.__EB = EB;
    window.__ev = [];
    for (const e of ['entity:selected', 'entity:deselected', 'time:updated', 'placement:started', 'placement:ended',
      'building:placed']) {
      EB.on(e, (p) => window.__ev.push([e, p === undefined ? null : p, Date.now()]));
    }
  });
  await page.evaluate(() => {
    const s = window.__gameStore && window.__gameStore.getState();
    if (s && s.enterGame) s.enterGame();
  });
  if (waitScene) {
    await page.waitForFunction((k) => window.__phaserGame && window.__phaserGame.scene.isActive(k), waitScene,
      { timeout: 45000 });
  }
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    const s = window.__gameStore && window.__gameStore.getState();
    if (s && s.dismissOfflineReport) s.dismissOfflineReport();
  });
  return { browser, page, logs, deviceId };
}

async function save(page, name, opts = {}, post = null) {
  let buf = await page.screenshot(opts);
  if (post) buf = await post(buf);
  const out = path.join(EVID, name);
  const info = await sharp(buf).webp({ quality: 82 }).toFile(out);
  return `${name} ${info.width}x${info.height} ${(info.size / 1024).toFixed(0)}KB`;
}

const injectBuildings = (page, list) => page.evaluate((b) => window.__gameStore.setState({ buildings: b }), list);
const setStorm = (page, s) => page.evaluate((x) => window.__gameStore.getState().setActiveStorm(x), s);

// ─── Lecturas dentro de la página ───────────────────────────────

function readBase() {
  const g = window.__phaserGame;
  const sc = g.scene.getScene('HubSceneB');
  const c = document.querySelector('#phaser-container canvas');
  const r = c.getBoundingClientRect();
  const keys = Object.keys(g.textures.list);
  const hubb = keys.filter((k) => k.startsWith('hubb_'));
  const modes = {};
  for (const k of hubb) {
    const m = g.textures.get(k).source[0].scaleMode;
    modes[m] = (modes[m] || 0) + 1;
  }
  return {
    hubActive: g.scene.isActive('HubSceneB'),
    worldScene: g.scene.getScene('WorldScene'),
    scenes: g.scene.scenes.map((s) => s.sys.settings.key),
    canvas: [c.width, c.height],
    rect: [r.x, r.y, r.width, r.height],
    s: sc.renderScale,
    zoom: sc.cameras.main.zoom,
    pixelArt: g.config.pixelArt,
    antialias: g.config.antialias,
    hubbTextures: hubb.length,
    scaleModes: modes,
    nonHubb: keys.filter((k) => !k.startsWith('hubb_') && !k.startsWith('__')),
    sprites: [...sc.bldSprites.keys()],
    store: (window.__gameStore.getState().buildings || []).map((b) => `${b.building_id}#${b.id}${b.is_building ? '(obra)' : ''}`),
  };
}

function readScene(gen) {
  const sc = window.__phaserGame.scene.getScene('HubSceneB');
  const cam = sc.cameras.main;
  const z = cam.zoom;
  const s = sc.renderScale;
  const v = cam.worldView;
  const css = (o) => {
    const b = o.getBounds();
    return [(b.x - v.x) * z / s, (b.y - v.y) * z / s, b.width * z / s, b.height * z / s].map((n) => +n.toFixed(2));
  };
  const bounds = {};
  for (const [id, e] of sc.bldSprites) bounds[id] = css(e.sprite);
  const art = sc.children.list.filter((o) => o.texture && o.texture.key.startsWith('hubb_')
    && !gen.includes(o.texture.key) && o.visible && o.alpha > 0);
  const tex = art.map((o) => ({
    key: o.texture.key, real: o.frame.realHeight, disp: +(o.displayHeight * z).toFixed(1),
    ratio: +(o.frame.realHeight / (o.displayHeight * z)).toFixed(3),
  }));
  const ems = sc.children.list.filter((o) => o.type === 'ParticleEmitter');
  const entries = [...sc.bldSprites.entries()];
  return {
    bounds, tex,
    workers: entries.filter(([, e]) => e.worker).map(([id, e]) => `${id}:${e.worker.sp.texture.key}`),
    smoke: entries.filter(([, e]) => e.smoke).map(([id, e]) => `${id}@${e.smoke.x},${e.smoke.y}`),
    emitters: ems.length,
    postPipelines: cam.postPipelines.length,
    postFXList: cam.postFX ? cam.postFX.list.length : null,
    fire: !!sc.fire,
    fogBanks: sc.fogBanks.length,
  };
}

function readAmb() {
  const sc = window.__phaserGame.scene.getScene('HubSceneB');
  const ems = sc.children.list.filter((o) => o.type === 'ParticleEmitter');
  return {
    calm: +sc.skies.sky_calm.alpha.toFixed(2), storm: +sc.skies.sky_storm.alpha.toFixed(2),
    tint: sc.skies.sky_storm.tintTopLeft.toString(16),
    grade: `${sc.grade.fillColor.toString(16)}/${sc.grade.fillAlpha.toFixed(2)}`,
    fog: sc.fogBanks.length ? +sc.fogBanks[0].alpha.toFixed(2) : 0,
    amb: ems.filter((e) => ['hubb_ember', 'hubb_mote'].includes(e.texture.key) && e.emitting).map((e) => e.texture.key),
    flash: sc.flashTimer ? sc.flashTimer.delay : null,
    drift: !sc.skyDrift.isPaused(),
  };
}

function writeJson(name, obj) {
  const f = path.join(SCRATCH, name);
  fs.writeFileSync(f, JSON.stringify(obj, null, 1));
  return f;
}

function texSummary(tex) {
  const r = tex.map((t) => t.ratio);
  const min = tex.find((t) => t.ratio === Math.min(...r));
  const max = tex.find((t) => t.ratio === Math.max(...r));
  return { n: tex.length, min: `${min.ratio} (${min.key})`, max: `${max.ratio} (${max.key})` };
}

function compareBounds() {
  const f2 = path.join(SCRATCH, 'hub_b_bounds_dpr2.json');
  const f3 = path.join(SCRATCH, 'hub_b_bounds_dpr3.json');
  if (!fs.existsSync(f2) || !fs.existsSync(f3)) return null;
  const b2 = JSON.parse(fs.readFileSync(f2, 'utf8'));
  const b3 = JSON.parse(fs.readFileSync(f3, 'utf8'));
  let max = 0;
  const rows = IDS.map((id) => {
    const d = b2[id].map((v, i) => Math.abs(v - b3[id][i]));
    max = Math.max(max, ...d);
    return `${id} [${b2[id].join(',')}] vs [${b3[id].join(',')}] Δ${Math.max(...d).toFixed(2)}`;
  });
  return { maxDiffCss: +max.toFixed(3), rows };
}

// ─── Corridas ───────────────────────────────────────────────────

async function mainRun(args) {
  const dpr = args.dpr;
  const sfx = dpr === 2 ? '' : `_dpr${dpr}`;
  const rep = { dpr, shots: [] };
  const { browser, page, logs, deviceId } = await open(args);
  rep.deviceId = deviceId;
  const t0 = Date.now();
  rep.base = await page.evaluate(readBase);
  const dayNight = () => page.evaluate(() => Math.round(window.__phaserGame.scene.getScene('HubSceneB').dayNight.elapsed));
  const dn0 = { elapsed: await dayNight(), t: Date.now() };
  if (dpr === 2) rep.shots.push(await save(page, 'hub_inicial.webp'));

  // 17 ids, misma sesión, sin recarga (R10, R14).
  const before = await page.evaluate(() => performance.getEntriesByType('navigation').length);
  await injectBuildings(page, fakeBuildings(IDS));
  await setStorm(page, null);
  await page.waitForTimeout(2500);
  rep.noReload = { navEntries: [before, await page.evaluate(() => performance.getEntriesByType('navigation').length)],
    sprites: await page.evaluate(() => window.__phaserGame.scene.getScene('HubSceneB').bldSprites.size) };
  const scene = await page.evaluate(readScene, GENERATED);
  rep.amb = await page.evaluate(readAmb);
  rep.tex = texSummary(scene.tex);
  rep.texRows = scene.tex.map((t) => `${t.key} ${t.real} ${t.disp} ${t.ratio}`);
  rep.workers = scene.workers;
  rep.smoke = scene.smoke;
  rep.fxOn = { emitters: scene.emitters, postPipelines: scene.postPipelines, postFXList: scene.postFXList,
    fire: scene.fire };
  writeJson(`hub_b_bounds_dpr${dpr}.json`, scene.bounds);
  rep.bounds = scene.bounds;
  rep.boundsCompare = compareBounds();
  rep.shots.push(await save(page, `hub_completo${sfx}.webp`));

  if (dpr === 2) {
    // Trabajador del Huerto: dos lecturas separadas ≥ 1.5 s con poses distintas (R16).
    const wkKey = () => page.evaluate(() => {
      const e = window.__phaserGame.scene.getScene('HubSceneB').bldSprites.get('farm_plot');
      return e.worker.sp.texture.key;
    });
    const clip = await page.evaluate(() => {
      const sc = window.__phaserGame.scene.getScene('HubSceneB');
      const e = sc.bldSprites.get('farm_plot');
      const a = e.sprite.getBounds();
      const w = e.worker.sp.getBounds();
      const x0 = Math.min(a.x, w.x); const y0 = Math.min(a.y, w.y);
      const x1 = Math.max(a.right, w.right); const y1 = Math.max(a.bottom, w.bottom);
      const v = sc.cameras.main.worldView;
      const z = sc.cameras.main.zoom / sc.renderScale;
      return { x: Math.max(0, (x0 - v.x) * z - 12), y: Math.max(0, (y0 - v.y) * z - 12),
        width: (x1 - x0) * z + 24, height: (y1 - y0) * z + 24 };
    }).catch(() => null);
    const shotsWk = {};
    const readings = [];
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline && (!shotsWk.a || !shotsWk.b)) {
      const k = await wkKey();
      const pose = k.endsWith('_a') ? 'a' : 'b';
      const last = readings[readings.length - 1];
      if (!shotsWk[pose] && (!last || Date.now() - last.t >= 1500)) {
        readings.push({ key: k, t: Date.now() });
        const opts = clip ? { clip } : {};
        shotsWk[pose] = await save(page, `hub_worker_${pose}.webp`, opts);
      }
      await page.waitForTimeout(100);
    }
    rep.workerReadings = readings.map((r) => `${r.key} @+${r.t - readings[0].t}ms`);
    rep.shots.push(shotsWk.a, shotsWk.b);

    // En obra (R13): 4 ids en obra, sin recarga.
    const OBRA = ['tavern', 'smithy', 'farm_plot', 'throne_room'];
    await injectBuildings(page, fakeBuildings(IDS, (id) => (OBRA.includes(id) ? 1 : 0)));
    await page.waitForTimeout(1200);
    rep.obra = await page.evaluate((ids) => {
      const sc = window.__phaserGame.scene.getScene('HubSceneB');
      return ids.map((id) => {
        const e = sc.bldSprites.get(id);
        return `${id}: tint ${e.sprite.tintTopLeft.toString(16)} a ${e.sprite.alpha} worker ${!!e.worker} smoke ${!!e.smoke}`;
      }).concat(`fire ${!!sc.fire}`);
    }, OBRA);
    rep.shots.push(await save(page, 'hub_obra.webp'));
    await injectBuildings(page, fakeBuildings(IDS));
    await page.waitForTimeout(1200);

    // Tormentas (R18-R20): misma sesión, fundido y vuelta a calma.
    rep.storms = {};
    for (const id of STORM_IDS) {
      await setStorm(page, stormObj(id));
      const mid = await page.evaluate(() => new Promise((r) => setTimeout(() => {
        const sc = window.__phaserGame.scene.getScene('HubSceneB');
        r([+sc.skies.sky_calm.alpha.toFixed(2), +sc.skies.sky_storm.alpha.toFixed(2)]);
      }, 600)));
      await page.waitForTimeout(900);
      rep.storms[id] = { mid600ms: mid, at1500ms: await page.evaluate(readAmb) };
      rep.shots.push(await save(page, `hub_tormenta_${id}.webp`));
    }
    await setStorm(page, null);
    const midCalm = await page.evaluate(() => new Promise((r) => setTimeout(() => {
      const sc = window.__phaserGame.scene.getScene('HubSceneB');
      r([+sc.skies.sky_calm.alpha.toFixed(2), +sc.skies.sky_storm.alpha.toFixed(2)]);
    }, 600)));
    await page.waitForTimeout(900);
    rep.storms.vuelta_a_calma = { mid600ms: midCalm, at1500ms: await page.evaluate(readAmb) };
  }

  // Texto flotante "+N KH" (R29, R44).
  await page.evaluate(() => window.__EB.emit('token:earned', { amount: 5 }));
  await page.waitForTimeout(120);
  rep.token = await page.evaluate(() => {
    const sc = window.__phaserGame.scene.getScene('HubSceneB');
    const t = sc.children.list.find((o) => o.type === 'Text' && /KH/.test(o.text));
    if (!t) return null;
    const cam = sc.cameras.main;
    const v = cam.worldView;
    const b = t.getBounds();
    const k = cam.zoom / sc.renderScale;
    return {
      text: t.text, fontSize: t.style.fontSize, resolution: t.style.resolution, zoom: cam.zoom, s: sc.renderScale,
      bodyCss: +(parseFloat(t.style.fontSize) * cam.zoom / sc.renderScale).toFixed(3),
      clip: { x: (b.x - v.x) * k - 40, y: (b.y - v.y) * k - 30, width: b.width * k + 80, height: b.height * k + 70 },
    };
  });
  if (rep.token) {
    if (dpr === 2) rep.shots.push(await save(page, 'hub_token.webp'));
    else {
      rep.shots.push(await save(page, `hub_token${sfx}.webp`, { clip: rep.token.clip }, (buf) => sharp(buf)
        .metadata().then((m) => sharp(buf).resize(m.width * 2, m.height * 2, { kernel: 'nearest' }).png().toBuffer())));
    }
  }

  if (dpr === 2) {
    // Resize en caliente (R6, R39).
    await page.setViewportSize({ width: 360, height: 780 });
    await page.waitForTimeout(1200);
    rep.resize = await page.evaluate(() => {
      const c = document.querySelector('#phaser-container canvas');
      const r = c.getBoundingClientRect();
      return { canvas: [c.width, c.height], rect: [r.x, r.y, r.width, r.height],
        zoom: +window.__phaserGame.scene.getScene('HubSceneB').cameras.main.zoom.toFixed(3) };
    });
    rep.shots.push(await save(page, 'hub_resize_360x780.webp'));
    await page.setViewportSize({ width: W, height: H });
    await page.waitForTimeout(800);
  }

  // time:updated (R28): DayNightSystem lo emite al crear y en cada cambio de período; el listener se registra
  // después del create, así que además se cita dayNight.elapsed creciente (alternativa de R28).
  rep.timeUpdated = await page.evaluate(() => {
    const e = window.__ev.find((x) => x[0] === 'time:updated');
    return e ? e[1] : null;
  });
  const dn1 = { elapsed: await dayNight(), t: Date.now() };
  rep.dayNight = { elapsed: [dn0.elapsed, dn1.elapsed], wallMs: dn1.t - dn0.t, sinceLoadMs: dn1.t - t0 };
  rep.console = { errors: logs.errors, pageerrors: logs.pageerrors, http: logs.http, apiRequests: logs.api };
  await browser.close();

  if (dpr === 2 && args.fxoff) rep.fxOff = await fxOffRun(args);
  return rep;
}

// FX apagado (R38): 17 ids + lluvia_de_energia sin emisores ni post-pipelines.
async function fxOffRun(args) {
  const { browser, page, logs } = await open(args, { fxOff: true });
  await injectBuildings(page, fakeBuildings(IDS));
  await setStorm(page, stormObj('lluvia_de_energia'));
  await page.waitForTimeout(2000);
  const sc = await page.evaluate(readScene, GENERATED);
  const r = { emitters: sc.emitters, postPipelines: sc.postPipelines, fogBanks: sc.fogBanks, fire: sc.fire,
    smoke: sc.smoke.length, amb: await page.evaluate(readAmb) };
  r.shot = await save(page, 'hub_fx_off.webp');
  r.pageerrors = logs.pageerrors.length;
  r.apiRequests = logs.api;
  await browser.close();
  return r;
}

// Taps reales con page.touchscreen.tap (R22, R24, R41) y, a DSF 2 con --build, el flujo de construcción (R25-R27).
async function tapsRun(args) {
  const dpr = args.dpr;
  const rep = { dpr, taps: [], shots: [] };
  const { browser, page, logs, deviceId } = await open(args);
  rep.deviceId = deviceId;
  rep.sprites = await page.evaluate(() => [...window.__phaserGame.scene.getScene('HubSceneB').bldSprites.keys()]);
  const center = (id) => page.evaluate((bid) => {
    const sc = window.__phaserGame.scene.getScene('HubSceneB');
    const e = sc.bldSprites.get(bid);
    const cam = sc.cameras.main;
    const b = e.sprite.getBounds();
    const k = cam.zoom / sc.renderScale;
    return { x: (b.centerX - cam.worldView.x) * k, y: (b.centerY - cam.worldView.y) * k };
  }, id);
  const lastEv = (n) => page.evaluate((m) => window.__ev.filter((e) => /^entity:/.test(e[0])).slice(-m), n);
  const tap = async (label, x, y) => {
    const n0 = await page.evaluate(() => window.__ev.length);
    await page.touchscreen.tap(x, y);
    await page.waitForTimeout(500);
    const got = await page.evaluate((k) => window.__ev.slice(k).filter((e) => /^entity:/.test(e[0])), n0);
    const overlay = await page.evaluate(() => window.__gameStore.getState().overlayState);
    rep.taps.push({ label, at: [+x.toFixed(1), +y.toFixed(1)], events: got.map((e) => [e[0], e[1]]),
      overlay: overlay && overlay.type });
    return got;
  };
  for (const id of ['barn', 'throne_room']) {
    const c = await center(id);
    await tap(id, c.x, c.y);
    if (dpr === 2 && id === 'barn' && args.build) {
      await page.waitForTimeout(600);
      rep.shots.push(await save(page, 'hub_tap_edificio.webp'));
    }
    await page.evaluate(() => window.__gameStore.getState().clearOverlay());
    await page.waitForTimeout(300);
  }
  await tap('cielo', 206, 200);
  rep.lastEvents = await lastEv(3);

  if (dpr === 2 && args.build) rep.build = await buildFlow(page, rep);
  rep.console = { errors: logs.errors, pageerrors: logs.pageerrors, http: logs.http, apiRequests: logs.api };
  await browser.close();
  return rep;
}

async function buildFlow(page, rep) {
  const btn = (txt) => page.evaluate((t) => {
    const b = [...document.querySelectorAll('button')].find((x) => x.innerText && x.innerText.trim().includes(t));
    if (b) { b.click(); return true; }
    return false;
  }, txt);
  const pick = async (name) => {
    if (await btn(name)) return true;
    await page.evaluate(() => window.__EB.emit('building:toolbar:toggle'));
    await page.waitForTimeout(500);
    return btn(name);
  };
  const ghost = () => page.evaluate(() => {
    const sc = window.__phaserGame.scene.getScene('HubSceneB');
    const g = sc.ghost;
    return { placing: sc.placing, ghost: g ? { key: g.texture.key, x: g.x, y: g.y, depth: g.depth } : null,
      buttons: [...document.querySelectorAll('button')].map((b) => b.innerText.trim()).filter((t) => /^(Confirmar|Cancelar)/.test(t)) };
  });
  const out = {};
  out.pick1 = await pick('Casa');
  await page.waitForTimeout(700);
  out.started = await ghost();
  rep.shots.push(await save(page, 'hub_construir_fantasma.webp'));
  await btn('Cancelar');
  await page.waitForTimeout(500);
  out.cancelled = await ghost();
  out.pick2 = await pick('Casa');
  await page.waitForTimeout(700);
  const respP = page.waitForResponse((r) => r.url().includes('/api/buildings/build'), { timeout: 15000 });
  await btn('Confirmar');
  const resp = await respP;
  const body = await resp.json().catch(() => null);
  out.build = { status: resp.status(), body: body && JSON.stringify(body).slice(0, 220) };
  await page.waitForTimeout(3000);
  out.after = await ghost();
  out.events = await page.evaluate(() => window.__ev.filter((e) => /^(placement|building)/.test(e[0])).map((e) => [e[0], e[1]]));
  out.house = await page.evaluate(() => {
    const sc = window.__phaserGame.scene.getScene('HubSceneB');
    const e = sc.bldSprites.get('house');
    const recs = window.__gameStore.getState().buildings.filter((b) => b.building_id === 'house');
    return e && { tint: e.sprite.tintTopLeft.toString(16), alpha: e.sprite.alpha, state: e.state,
      recs: recs.map((r) => [r.id, r.is_building, r.position_x, r.position_y]) };
  });
  rep.shots.push(await save(page, 'hub_construir_ok.webp'));
  return out;
}

// Nitidez (R45): línea base con devicePixelRatio forzado a 1 contra la corrida normal, región de la ranura barn.
async function sharpnessRun(args) {
  const { HUB_SLOTS } = await import(pathToFileURL(path.join(ROOT, 'client/src/game/hub/hubLayout.js')).href);
  const slot = HUB_SLOTS.barn;
  // A DSF 2 con viewport 412×860 la vista cubre 824×1720 con zoom 1 → px de captura = px lógicos.
  const box = { left: Math.round(slot.x - slot.w / 2), top: Math.round(slot.y - slot.h), width: Math.round(slot.w),
    height: Math.round(slot.h) };
  const lap = { width: 3, height: 3, kernel: [0, 1, 0, 1, -4, 1, 0, 1, 0] };
  // sharp().stats() mide la imagen de ENTRADA (ignora greyscale/convolve encadenados): hay que materializar el
  // laplaciano antes de medir. offset 128 evita recortar los valores negativos a 0 (uint8).
  const metric = async (png) => {
    const crop = await sharp(png).extract(box).png().toBuffer();
    const sd2 = async (buf) => (await sharp(buf).stats()).channels[0].stdev ** 2;
    const chained = (await sharp(crop).greyscale().convolve(lap).stats()).channels[0].stdev ** 2;
    const input = await sd2(crop);
    const lapImg = await sharp(crop).greyscale().convolve({ ...lap, scale: 1, offset: 128 }).png().toBuffer();
    const lapVar = await sd2(lapImg);
    // Control independiente: laplaciano en float sobre el gris crudo.
    const { data, info } = await sharp(crop).greyscale().raw().toBuffer({ resolveWithObject: true });
    const vals = [];
    for (let y = 1; y < info.height - 1; y++) {
      for (let x = 1; x < info.width - 1; x++) {
        const i = y * info.width + x;
        vals.push(data[i - 1] + data[i + 1] + data[i - info.width] + data[i + info.width] - 4 * data[i]);
      }
    }
    const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
    const manual = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length;
    const f = (n) => +n.toFixed(2);
    return { crop, lapVar: f(lapVar), manualVar: f(manual), chainedStats: f(chained), inputStats: f(input) };
  };
  const capture = async (forceDpr1) => {
    const init = forceDpr1 ? () => Object.defineProperty(window, 'devicePixelRatio', { get: () => 1 }) : null;
    const { browser, page, logs } = await open(args, { dpr: 2, fxOff: true, init });
    await injectBuildings(page, fakeBuildings(IDS));
    await setStorm(page, null);
    await page.waitForTimeout(2500);
    const info = await page.evaluate(() => {
      const c = document.querySelector('#phaser-container canvas');
      return { canvas: [c.width, c.height], dpr: window.devicePixelRatio,
        zoom: window.__phaserGame.scene.getScene('HubSceneB').cameras.main.zoom };
    });
    const png = await page.screenshot();
    await browser.close();
    return { info, png, pageerrors: logs.pageerrors.length, api: logs.api };
  };
  const s1 = await capture(true);
  const s2 = await capture(false);
  const m1 = await metric(s1.png);
  const m2 = await metric(s2.png);
  const write = (buf, name) => sharp(buf).webp({ quality: 82 }).toFile(path.join(EVID, name))
    .then((i) => `${name} ${i.width}x${i.height}`);
  const shots = [await write(m1.crop, 'nitidez_s1.webp'), await write(m2.crop, 'nitidez_s2.webp')];
  const up = (buf) => sharp(buf).resize(box.width * 3, box.height * 3, { kernel: 'nearest' }).png().toBuffer();
  const gap = 24;
  const cmp = await sharp({ create: { width: box.width * 6 + gap, height: box.height * 3, channels: 3,
    background: '#1a1512' } })
    .composite([{ input: await up(m1.crop), left: 0, top: 0 }, { input: await up(m2.crop), left: box.width * 3 + gap, top: 0 }])
    .png().toBuffer();
  shots.push(await write(cmp, 'nitidez_comparacion.webp'));
  return {
    box,
    s1: { ...s1.info, ...m1, crop: undefined, pageerrors: s1.pageerrors },
    s2: { ...s2.info, ...m2, crop: undefined, pageerrors: s2.pageerrors },
    ratio: +(m2.lapVar / m1.lapVar).toFixed(3),
    ratioManual: +(m2.manualVar / m1.manualVar).toFixed(3),
    shots,
  };
}

// Entradas que no son el hub (R46, R49).
async function previewRun(args) {
  const { browser, page, logs } = await open(args, { search: '?preview=world', waitScene: 'WorldScene' });
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => {
    const g = window.__phaserGame;
    const c = document.querySelector('canvas');
    return { canvas: [c.width, c.height], worldActive: g.scene.isActive('WorldScene'), pixelArt: g.config.pixelArt,
      entry: g.registry.get('entry'), scenes: g.scene.scenes.map((s) => s.sys.settings.key) };
  });
  r.shot = await save(page, 'preview_world.webp');
  r.pageerrors = logs.pageerrors;
  r.apiRequests = logs.api;
  await browser.close();
  r.dioramas = {};
  for (const id of ['battle_ruins', 'battle_tide', 'boss_arena']) {
    const res = await fetch(`${args.url}/assets/game/dioramas/${id}.png`);
    r.dioramas[id] = `${res.status} ${res.headers.get('content-type')} ${(await res.arrayBuffer()).byteLength}B`;
  }
  return r;
}

// Robustez (R30): texturas bloqueadas → placeholder, sin excepción.
async function fallbackRun(args) {
  const blocked = [];
  const route = async (page) => {
    for (const pat of ['**/assets/b/buildings/barn.webp', '**/assets/b/hub/sky_calm.webp']) {
      await page.route(pat, (rt) => { blocked.push(rt.request().url()); return rt.abort(); });
    }
  };
  const { browser, page, logs } = await open(args, { route });
  await injectBuildings(page, fakeBuildings(IDS));
  await setStorm(page, null);
  await page.waitForTimeout(2000);
  const r = await page.evaluate(() => {
    const sc = window.__phaserGame.scene.getScene('HubSceneB');
    return { missing: [...sc.missing], barn: sc.bldSprites.get('barn').sprite.texture.key,
      skyCalm: sc.skies.sky_calm.texture.key, sprites: sc.bldSprites.size, active: window.__phaserGame.scene.isActive('HubSceneB') };
  });
  r.shot = await save(page, 'hub_fallback.webp');
  r.blocked = blocked;
  r.ownWarns = logs.warns.filter((w) => w.includes('HubSceneB'));
  r.consoleErrors = logs.errors;
  r.pageerrors = logs.pageerrors;
  await browser.close();
  return r;
}

// Consola limpia (R32): carga + 30 s en reposo.
async function idleRun(args) {
  const { browser, page, logs } = await open(args);
  await page.waitForTimeout(30000);
  const r = { active: await page.evaluate(() => window.__phaserGame.scene.isActive('HubSceneB')),
    consoleErrors: logs.errors, pageerrors: logs.pageerrors, http: logs.http, apiRequests: logs.api };
  await browser.close();
  return r;
}

// fps (R33): 17 ids + lluvia_de_energia, 20 muestras de loop.actualFps y de un contador de rAF (1 por segundo).
async function fpsRun(args) {
  const { browser, page, logs } = await open(args);
  await injectBuildings(page, fakeBuildings(IDS));
  await setStorm(page, stormObj('lluvia_de_energia'));
  await page.waitForTimeout(3000);
  const samples = await page.evaluate(() => new Promise((resolve) => {
    const out = [];
    let frames = 0;
    let last = performance.now();
    const raf = () => { frames++; if (out.length < 20) requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
    const iv = setInterval(() => {
      const now = performance.now();
      const st = window.__gameStore.getState().activeStorm;
      out.push({ actualFps: +window.__phaserGame.loop.actualFps.toFixed(1), raf: +(frames * 1000 / (now - last)).toFixed(1),
        storm: st && st.id });
      frames = 0;
      last = now;
      if (out.length >= 20) { clearInterval(iv); resolve(out); }
    }, 1000);
  }));
  const info = await page.evaluate(() => {
    const sc = window.__phaserGame.scene.getScene('HubSceneB');
    const c = document.querySelector('#phaser-container canvas');
    return { canvas: [c.width, c.height], sprites: sc.bldSprites.size,
      emitters: sc.children.list.filter((o) => o.type === 'ParticleEmitter').length,
      renderer: window.__phaserGame.renderer.type === 2 ? 'WEBGL' : 'CANVAS' };
  });
  const gpu = await page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl');
    const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : null;
  });
  await browser.close();
  const a = samples.map((x) => x.actualFps);
  const r = samples.map((x) => x.raf);
  const avg = (v) => +(v.reduce((s, x) => s + x, 0) / v.length).toFixed(1);
  const res = {
    date: new Date().toISOString(), dpr: args.dpr, viewport: [W, H], ...info, gpu,
    chromiumArgs: ['--use-angle=d3d11', '--enable-gpu'], scenario: '17 edificios + lluvia_de_energia, FX activos',
    actualFps: { avg: avg(a), min: Math.min(...a) }, raf: { avg: avg(r), min: Math.min(...r) },
    pageerrors: logs.pageerrors.length, samples,
  };
  const name = args.dpr === 2 ? 'fps.json' : `fps_dpr${args.dpr}.json`;
  fs.writeFileSync(path.join(EVID, name), `${JSON.stringify(res, null, 2)}\n`);
  return { file: name, ...res, samples: undefined };
}

async function main() {
  const args = parseArgs(process.argv);
  fs.mkdirSync(EVID, { recursive: true });
  let mode = 'main';
  let rep;
  if (args.sharpness) { mode = 'sharpness'; rep = await sharpnessRun(args); }
  else if (args.taps) { mode = 'taps'; rep = await tapsRun(args); }
  else if (args.preview) { mode = 'preview'; rep = await previewRun(args); }
  else if (args.fallback) { mode = 'fallback'; rep = await fallbackRun(args); }
  else if (args.idle) { mode = 'idle'; rep = await idleRun(args); }
  else if (args.fps) { mode = 'fps'; rep = await fpsRun(args); }
  else rep = await mainRun(args);
  const f = writeJson(`hub_b_report_${mode}_dpr${args.dpr}.json`, rep);
  console.log(JSON.stringify(rep, null, 1));
  console.log(`reporte: ${f}`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
