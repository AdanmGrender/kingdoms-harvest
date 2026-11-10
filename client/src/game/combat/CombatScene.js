/**
 * Escena de combate B (combate_b T5, R3, R31, R46, R47; T10.6: hoja_visual.md V1–V9). Portada del spike
 * `spikes/001-combat-b/main.js`. La escena NO decide cifras ni usa azar: reproduce los beats que planifica
 * `eventPlanner` (R3) y avisa con `onRoundDone` al vaciar la cola. Nada de `window.dispatchEvent` ni unidades de viewport.
 *
 * Cada personaje es un `Container` propio (sombra + sprite + marcadores) puesto en su carril (`formation.js`), con
 * profundidad = carril: la fila de más abajo se dibuja delante. Toda animación de un personaje (respiración, embestida,
 * retroceso, pose, giro, caída) toca solo SU contenedor o sus hijos; los compañeros no se mueven (regla del owner).
 */
import Phaser from 'phaser';
import { collectAssetKeys, textureKey, spriteGeom, bgCoverScale, BG_DRIFT, HERO_ART, ENEMY_ART, ATTACK_FX, ATTACK_FX_FRAME } from './artMap';
import { computeFormation, enemyList, lyingBoxes, WORLD, DEAD_FLAT, DEAD_LEN, fallDir, BREATH } from './formation';
import { createRoundQueue } from './eventPlanner';
import { QUALITY, DEFAULT_QUALITY } from './combatQuality';

const { w: W, h: H } = WORLD;
const FONT = "'IM Fell English SC', 'IM Fell English', serif";
const toInt = (hex) => parseInt(String(hex || '#ffffff').replace('#', ''), 16) || 0xffffff;
// Caja real de un texto flotante (origen en el borde inferior central, con la escala del momento), en el mundo.
const floatBox = (o) => {
  const hw = (o.width * Math.abs(o.scaleX || 1)) / 2;
  return { x0: o.x - hw, x1: o.x + hw, y0: o.y - o.height * Math.abs(o.scaleY || 1), y1: o.y };
};
// V4 (enmienda Last Asylum + decisión del owner del 2026-11-09): tamaños en px de PANTALLA (CSS), no de mundo.
export const FLOAT_NORMAL = 40;   // 36–44 px CSS en daño normal…
export const FLOAT_CRIT = 60;     // …56–64 px CSS en crítico
export const FLOAT_STACK_GAP = 4; // apilado: cada número nuevo arranca 4 px CSS por encima del alto real del anterior
export const FLOAT_RISE = 60;     // sube 60 px CSS…
export const FLOAT_MS = 800;      // …en ≤800 ms
export const FLOAT_POP_MS = 120;  // pop 1,4 → 1 en 120 ms
export const FLOAT_POP_FROM = 1.4;
export const FLOAT_HEAD_GAP = 6;  // el número arranca 6 px CSS por encima de la cabeza (tope de la silueta)
export const FLOAT_EDGE = 8;      // y dentro del lienzo, a 8 px CSS de sus bordes
export const DEAD_ALPHA = 0.85;   // V6: tendido, nunca fantasma
const DEAD_TINT = 0x9a9a9a;       // V6: apagado (con WebGL además se desatura con una matriz de color)
export const FALL_MS = 450;       // V6: caída ≤600 ms
const LUNGE_PX = 40;
const RECOIL_PX = 24;
export const AIM_MAX_DEG = 30;    // V7: el tirador se inclina hacia su objetivo (el pie hace de pivote), como mucho 30°
export const SHOT_MS = 110;       // el proyectil va de la boca del arma al objetivo en 110 ms…
export const TRACER_MS = 220;     // …y la estela se apaga en 220 ms
const FACING = { hero: 1, enemy: -1 }; // V7: hacia dónde miran las poses (+1 derecha) sin voltear
const RANGED = new Set(['ranger']);

export function prefersReducedMotion() {
  try {
    return !!(typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  } catch {
    return false;
  }
}

export default class CombatScene extends Phaser.Scene {
  constructor() {
    super('combat');
    this.inbox = [];
    this.ready = false;
    this.failed = new Set();
    this.actors = {};
  }

  init(data) {
    this.opts = data || {};
    this.q = QUALITY[this.opts.quality && this.opts.quality.name ? this.opts.quality.name : this.opts.quality] || QUALITY[DEFAULT_QUALITY];
    this.reduced = this.opts.reducedMotion ?? prefersReducedMotion();
    this.state0 = this.opts.state || {};
    this.node = this.opts.node || null;
    this.hud = this.opts.hud || null;   // bordes reales del HUD en el mundo (H2), si el panel ya los midió
    this.queue = createRoundQueue({ warn: (m) => console.warn(m) });
    this.assets = collectAssetKeys(this.state0, this.node);
  }

  preload() {
    // R31: una textura que no carga no detiene el combate; se marca y se dibuja un marcador generado.
    this.load.on('loaderror', (file) => {
      this.failed.add(file && file.key);
      console.warn(`[combat] textura no cargó: ${file && file.key}`);
    });
    for (const a of this.assets) this.load.image(a.key, a.url);
  }

  texFor(kind, key, pose) {
    const k = textureKey(kind, key, pose);
    if (!this.failed.has(k) && this.textures.exists(k)) return k;
    return this.placeholder(k, kind);
  }

  /** Silueta generada (R31): rectángulo con cabeza, del tono del bando. */
  placeholder(forKey, kind) {
    const ph = `ph:${forKey}`;
    if (this.textures.exists(ph)) return ph;
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    const color = kind === 'enemy' ? 0x7a1f1a : kind === 'bg' ? 0x14110d : 0x4a4a48;
    g.fillStyle(color, 1);
    if (kind === 'bg') g.fillRect(0, 0, 64, 128);
    else { g.fillRoundedRect(8, 40, 64, 100, 10); g.fillCircle(40, 24, 18); }
    g.generateTexture(ph, kind === 'bg' ? 64 : 80, kind === 'bg' ? 128 : 144);
    g.destroy();
    return ph;
  }

  makeTextures() {
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    for (let r = 16; r > 0; r--) { g.fillStyle(0xffffff, (1 - r / 16) ** 2); g.fillCircle(16, 16, r); }
    g.generateTexture('spark', 32, 32); g.clear();
    for (let r = 64; r > 0; r -= 2) { g.fillStyle(0x000000, 0.035); g.fillEllipse(128, 32, r * 4, r); }
    g.generateTexture('shadow', 256, 64); g.clear();
    for (let r = 128; r > 0; r -= 4) { g.fillStyle(0xffffff, 0.02); g.fillEllipse(256, 128, r * 4, r * 2); }
    g.generateTexture('fog', 512, 256); g.clear();
    // estela del disparo: 64×8, más brillante en el centro
    for (let r = 4; r > 0; r--) { g.fillStyle(0xfff1c4, 0.28); g.fillRect(0, 4 - r, 64, r * 2); }
    g.generateTexture('tracer', 64, 8);
    g.destroy();
  }

  create() {
    this.makeTextures();
    const cam = this.cameras.main;

    // fondo (cover) con leve deriva: la misma transformación con la que se calibró la línea de suelo (artMap.js)
    const bgKey = this.texFor('bg', this.assets.find((a) => a.key.startsWith('bg:'))?.key.slice(3) || 'crypt');
    const bg = this.add.image(W / 2, H / 2, bgKey);
    const s = bgCoverScale(bg.width || W, bg.height || H);
    bg.setScale(s);
    if (!this.reduced) this.tweens.add({ targets: bg, scale: s * BG_DRIFT, x: W / 2 - 8, duration: 9000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // luces (PointLight): solo según calidad; `low` no crea ninguna (R46)
    if (this.q.lights > 0 && this.add.pointlight) {
      const LIGHTS = [
        { x: 70, y: 905, c: 0xe8933a, r: 260, i: 0.16 }, { x: 760, y: 905, c: 0xe8933a, r: 260, i: 0.16 },
        { x: 412, y: 260, c: 0x9fd35a, r: 420, i: 0.07 }, { x: 412, y: 1300, c: 0xe8933a, r: 300, i: 0.06 },
      ];
      for (const L of LIGHTS.slice(0, this.q.lights)) {
        const pl = this.add.pointlight(L.x, L.y, L.c, L.r, L.i, 0.06);
        if (!this.reduced) this.tweens.add({ targets: pl, intensity: L.i * 0.6, duration: 130, yoyo: true, repeat: -1, ease: 'Stepped' });
      }
    }

    this.dim = this.add.rectangle(W / 2, H / 2, W * 2, H * 2, 0x000000, 0).setDepth(2000);
    this.buildActors();

    this.sparks = this.add.particles(0, 0, 'spark', {
      lifespan: { min: 250, max: 650 }, speed: { min: 250, max: 750 }, scale: { start: 0.9, end: 0 },
      alpha: { start: 1, end: 0 }, blendMode: 'ADD', gravityY: 900, emitting: false, maxAliveParticles: this.q.maxParticles,
    }).setDepth(2500);

    // post-FX: viñeta (medium/high) y bloom (high), siempre guardados (R47)
    if (this.q.postFX && cam.postFX) {
      if (this.q.vignette) cam.postFX.addVignette(0.5, 0.48, 0.92, 0.42);
      if (this.q.bloom) this.bloom = cam.postFX.addBloom(0xffffff, 1, 1, 1, 0.55, 3);
    }

    // un toque en el lienzo salta la animación (R18)
    if (this.input && this.input.on) this.input.on('pointerdown', () => this.skip());

    this.queue.setUnits(this.state0);
    this.ready = true;
    for (const job of this.inbox.splice(0)) this.playRound(job.events, job.state);
    if (this.opts.onReady) this.opts.onReady(this);
  }

  buildActors() {
    const enemies = enemyList(this.state0);
    const boss = !!(this.node && (this.node.isBoss || this.node.type === 'boss'));
    const f = computeFormation(this.state0.heroes || [], enemies, { boss, node: this.node, hud: this.hud });
    this.formation = f;
    this.lying = lyingBoxes(f);
    const mk = (b, kind) => {
      const c = this.add.container(b.cx, b.lane).setDepth(b.depth);
      const sh = this.add.image(0, 6, 'shadow');
      const sp = this.add.image(0, 0, this.texFor(kind, b.art, 'idle'));
      c.add([sh, sp]);
      const sc = b.h / (sp.height || b.h);
      const a = {
        id: b.id, kind, art: b.art, row: b.row, c, sp, sh, markers: {},
        base: { x: b.cx, y: b.lane, sc, h: b.h, headY: b.alpha.y, alphaH: b.alpha.h, alphaW: b.alpha.w },
      };
      this.setPose(a, 'idle', false);
      sh.setScale((b.alpha.w / 256) * 1.1, 1.1);
      if (!this.reduced) {
        a.breath = this.tweens.add({ targets: sp, scaleY: sc * BREATH.y, scaleX: sc * BREATH.x, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: (Math.round(b.cx) % 7) * 90 });
      }
      this.actors[b.id] = a;
    };
    for (const b of f.heroes) mk(b, 'hero');
    for (const b of f.enemies) mk(b, 'enemy');

    // Aplicar la vista del estado inicial: las unidades ya caídas empiezan tendidas (B6/M3)
    const view0 = {};
    if (this.state0.heroes) {
      for (const h of this.state0.heroes) view0[`h${h.slot}`] = { alive: h.alive !== false };
    }
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      const hp = e.hp !== undefined ? Number(e.hp) : 1;
      view0[e.id ?? `e${i}`] = { alive: hp > 0 };
    }
    this.applyView(view0);
  }

  // ── API pública ──────────────────────────────────────────────────────────

  /** Encola una ronda (eventos ya resueltos por el servidor) y su estado autoritativo (R15). */
  playRound(events, state) {
    if (!this.ready) { this.inbox.push({ events, state }); return; }
    const units = new Set(Object.keys(this.actors));
    this.queue.enqueueRound(events, { units });
    this.waiting = true;
    this.finalState = state;
  }

  /**
   * H2: el panel mide en tiempo de ejecución el borde superior real de los botones de héroe y el inferior de las barras
   * (y los vuelve a medir si cambia el alto, p. ej. en Telegram). Si cambian los carriles, cada personaje se recoloca.
   */
  setHud(hud) {
    if (!hud) return;
    const same = this.hud && ['bottom', 'top', 'zoneBottom'].every((k) => Math.abs((this.hud[k] ?? 0) - (hud[k] ?? 0)) < 0.5);
    this.hud = hud;
    if (same || !this.ready) return;
    this.relayout();
  }

  relayout() {
    const enemies = enemyList(this.state0);
    const boss = !!(this.node && (this.node.isBoss || this.node.type === 'boss'));
    const f = computeFormation(this.state0.heroes || [], enemies, { boss, node: this.node, hud: this.hud });
    this.formation = f;
    this.lying = lyingBoxes(f);
    for (const b of [...f.heroes, ...f.enemies]) {
      const a = this.actors[b.id];
      if (!a || (a.base.x === b.cx && a.base.y === b.lane)) continue;
      // H-a (review ronda 3): se recoloca la pantalla, no se corta la animación de nadie. El carril (y) va a su sitio
      // nuevo; una embestida o un retroceso en curso (tween de x) sigue y al terminar queda en la x nueva; una caída en
      // curso sigue relativa a su contenedor.
      Object.assign(a.base, { x: b.cx, y: b.lane, headY: b.alpha.y });
      a.c.y = b.lane;
      if (!this.isTweening(a.c)) a.c.x = b.cx;
      a.c.setDepth(b.depth);
      if (a.dead && !this.isTweening(a.sp)) this.layDown(a);
    }
  }

  isTweening(o) {
    return !!(this.tweens && this.tweens.isTweening && this.tweens.isTweening(o));
  }

  skip() {
    this.queue.skip();
    const f = this.queue.speed;
    if (this.tweens) this.tweens.timeScale = f;
    if (this.time) this.time.timeScale = f;
  }

  update(_time, delta) {
    if (!this.ready) return;
    for (const b of this.queue.tick(delta)) this.playBeat(b);
    if (this.waiting && this.queue.isIdle()) {
      this.waiting = false;
      if (this.tweens) this.tweens.timeScale = 1;
      if (this.time) this.time.timeScale = 1;
      this.applyView(this.queue.reconcile(this.finalState));
      if (this.opts.onRoundDone) this.opts.onRoundDone({ lastT: this.queue.lastT });
    }
  }

  // ── Personajes ───────────────────────────────────────────────────────────

  /**
   * Pose + orientación con el pie fijo: el origen de cada textura apoya la fila inferior con alfa en el carril y deja
   * el cuerpo donde estaba en la idle (SPRITE_GEOM); al voltear, el origen X se refleja para que el cuerpo no salte.
   */
  setPose(a, pose, flip = false) {
    const p = this.poseFor(a, pose);
    const key = this.texFor(a.kind, a.art, p);
    const g = key.startsWith('ph:') ? null : spriteGeom(a.kind, a.art, p);
    // El tirador dispara sin el fogonazo pintado en la textura: usa un cuadro que termina en la boca del arma (el disparo
    // lo dibuja shoot). Es un cuadro, no un recorte: volteado, Phaser espeja el recorte y mostraba el fogonazo sin cuerpo.
    const fx = g && a.kind === 'hero' && p === 'attack' ? ATTACK_FX[a.art] : null;
    const frame = fx ? this.fxFrame(key, fx) : undefined;
    a.sp.setTexture(key, frame);
    // el pie queda en la misma columna de la textura: en el cuadro corto el origen se cuenta sobre su ancho
    const fw = frame ? fx.crop[2] : g ? g.W : 1;
    const ox = g ? (g.ox * g.W) / fw : 0.5;
    const oy = g ? g.oy : 1;
    a.sp.setFlipX(!!flip).setOrigin(flip ? 1 - ox : ox, oy);
    a.sp.setScale(a.base.h / (a.sp.height || a.base.h));
  }

  /** Cuadro `ATTACK_FX_FRAME` de la textura (se crea una vez): la pose de ataque hasta la boca del arma. */
  fxFrame(key, fx) {
    const tex = this.textures.get ? this.textures.get(key) : null;
    if (!tex || !tex.add) return undefined;
    if (!(tex.has && tex.has(ATTACK_FX_FRAME))) tex.add(ATTACK_FX_FRAME, 0, ...fx.crop);
    return ATTACK_FX_FRAME;
  }

  /** Boca del arma del tirador en el mundo, con su volteo, escala, giro y la posición del contenedor. */
  muzzleWorld(a) {
    const fx = ATTACK_FX[a.art];
    const g = spriteGeom(a.kind, a.art, 'attack');
    const fw = a.sp.width || g.W;   // ancho del cuadro que se dibuja (el de la pose hasta la boca, o la textura entera)
    const mx = a.sp.flipX ? fw - fx.muzzle[0] : fx.muzzle[0];
    const lx = (mx - a.sp.originX * fw) * a.sp.scaleX;
    const ly = (fx.muzzle[1] - a.sp.originY * g.H) * a.sp.scaleY;
    const r = (a.sp.angle * Math.PI) / 180;
    return {
      x: a.c.x + a.sp.x + lx * Math.cos(r) - ly * Math.sin(r),
      y: a.c.y + a.sp.y + lx * Math.sin(r) + ly * Math.cos(r),
    };
  }

  /**
   * B5: el fogonazo no puede caer sobre un compañero. Si la boca del arma queda sobre la silueta de otro personaje de su
   * bando, el tirador se inclina un poco más (de 3 en 3 grados, hasta AIM_MAX_DEG): la boca sube y sale de encima.
   */
  clearMuzzle(a, flip) {
    const sign = (FACING[a.kind] > 0) !== !!flip ? -1 : 1;
    const over = (p) => this.matesUnder(a, p).length > 0;
    a.sp.x = 0;
    for (let deg = Math.abs(a.sp.angle); deg <= AIM_MAX_DEG && over(this.muzzleWorld(a)); deg += 3) {
      a.sp.setAngle(sign * Math.min(AIM_MAX_DEG, deg + 3));
    }
  }

  /** Compañeros (de pie) de `a` cuya silueta tiene encima el punto `p` del mundo. */
  matesUnder(a, p) {
    return Object.values(this.actors).filter((o) => o !== a && o.kind === a.kind && !o.dead
      && Math.abs(p.x - o.base.x) < o.base.alphaW / 2 && p.y > o.base.headY && p.y < o.base.y);
  }

  /** Bordes en x (mundo) de la silueta de la pose actual, con volteo, escala y giro sobre el pie y sin corrimiento. */
  silhouetteX(a) {
    const key = a.sp.texture && a.sp.texture.key !== undefined ? a.sp.texture.key : a.sp.texture;
    const m = /^(hero|enemy):([a-z_]+):([a-z]+)$/.exec(String(key));
    if (!m) return null;
    const g = spriteGeom(m[1], m[2], m[3]);
    const fw = a.sp.width || g.W;
    const fx = m[1] === 'hero' && m[3] === 'attack' ? ATTACK_FX[m[2]] : null;
    // el tirador: envolvente medida de su silueta (la esquina de la caja alfa inclinada queda lejos del dibujo)
    const pts = fx && fx.hull && fw === fx.crop[2] ? fx.hull
      : [[g.l, g.t], [Math.min(g.r + 1, fw), g.t], [g.l, g.b + 1], [Math.min(g.r + 1, fw), g.b + 1]];
    const sx = Math.abs(a.sp.scaleX);
    const sy = Math.abs(a.sp.scaleY);
    const r = (a.sp.angle * Math.PI) / 180;
    const xs = pts.map(([u, v]) => {
      const lx = ((a.sp.flipX ? fw - u : u) - a.sp.originX * fw) * sx;
      const ly = (v - a.sp.originY * g.H) * sy;
      return a.c.x + lx * Math.cos(r) - ly * Math.sin(r);
    });
    return { lo: Math.min(...xs), hi: Math.max(...xs) };
  }

  /**
   * La silueta de la pose actual no sale del lienzo: si una pose más ancha o inclinada asomaría por un borde (el tirador
   * de la derecha inclinado hasta 30°), el sprite se corre dentro de su contenedor lo justo. Al tirador no se lo corre
   * tanto que la boca del arma quede sobre un compañero (B5 manda): se queda pegado a la silueta de ese compañero.
   * Vuelve a 0 con la pose de reposo.
   */
  keepInside(a) {
    a.sp.x = 0;
    const s = this.silhouetteX(a);
    if (!s) return;
    const e = 4;
    let dx = s.hi > W - e ? W - e - s.hi : s.lo < e ? e - s.lo : 0;
    if (dx !== 0 && ATTACK_FX[a.art] && a.sp.width === ATTACK_FX[a.art].crop[2]) {
      const m = this.muzzleWorld(a);
      for (const o of Object.values(this.actors)) {
        if (o === a || o.kind !== a.kind || o.dead || !(m.y > o.base.headY && m.y < o.base.y)) continue;
        const x0 = o.base.x - o.base.alphaW / 2;
        const x1 = o.base.x + o.base.alphaW / 2;
        if (dx < 0 && m.x >= x1) dx = Math.max(dx, x1 + 1 - m.x);
        if (dx > 0 && m.x <= x0) dx = Math.min(dx, x0 - 1 - m.x);
      }
    }
    a.sp.x = dx;
  }

  /** V7 (B5): el disparo va de la boca del arma al pecho del objetivo: proyectil, estela y fogonazo en la boca. */
  shoot(a, target) {
    if (!ATTACK_FX[a.art]) return null;
    const p = this.muzzleWorld(a);
    const tx = target.base.x;
    const ty = target.base.y - target.base.alphaH * 0.55;
    const dist = Math.hypot(tx - p.x, ty - p.y);
    const tracer = this.add.image(p.x, p.y, 'tracer').setOrigin(0, 0.5).setDepth(2650)
      .setRotation(Math.atan2(ty - p.y, tx - p.x)).setScale(dist / 64, 1).setBlendMode('ADD');
    this.tweens.add({ targets: tracer, alpha: 0, duration: TRACER_MS, ease: 'Quad.easeIn', onComplete: () => tracer.destroy() });
    const ball = this.add.image(p.x, p.y, 'spark').setDepth(2660).setScale(0.9).setBlendMode('ADD');
    this.tweens.add({ targets: ball, x: tx, y: ty, duration: SHOT_MS, ease: 'Linear', onComplete: () => ball.destroy() });
    // fogonazo corto y quieto en la boca (sin chispas que salgan volando sobre los demás)
    const flash = this.add.image(p.x, p.y, 'spark').setDepth(2660).setScale(2).setBlendMode('ADD').setTint(0xffd27a);
    this.tweens.add({ targets: flash, alpha: 0, scale: 2.8, duration: 120, ease: 'Quad.easeOut', onComplete: () => flash.destroy() });
    return { muzzle: p, to: { x: tx, y: ty }, tracer, ball, flash };
  }

  /**
   * Pose real de un actor: los enemigos atacan con su pose `hit` y los héroes no tienen `hit` (se quedan en `idle`; el
   * destello y el retroceso ya marcan el golpe). Una pose que el arte no tiene cae a `idle`, nunca al marcador de R31.
   */
  poseFor(a, pose) {
    let p = pose;
    if (a.kind === 'enemy' && p === 'attack') p = 'hit';
    if (a.kind === 'hero' && p === 'hit') p = 'idle';
    const poses = (a.kind === 'enemy' ? ENEMY_ART : HERO_ART)[a.art];
    return poses && !poses.includes(p) ? 'idle' : p;
  }

  applyView(view) {
    for (const [id, u] of Object.entries(view)) {
      const a = this.actors[id];
      if (!a) continue;
      if (u.alive) {
        if (!a.dead) { a.sp.setAlpha(1); a.sh.setAlpha(1); }
      } else {
        this.layDown(a);
      }
    }
  }

  /**
   * Pose tendida (V6, B3), en coordenadas del contenedor: todos los de un bando caen hacia el mismo lado (fallDir), con
   * el largo al 90 % y el grosor aplanado, apoyados sobre su carril y centrados en su x sin salirse del lienzo
   * (la caja de `lyingBoxes` de formation.js: si dos de la misma fila se pisan, se separan lo justo).
   */
  deadPose(a) {
    const g = spriteGeom(a.kind, a.art, a.kind === 'enemy' ? 'hit' : 'idle');
    const s = a.base.h / g.H;
    const dir = fallDir(a.kind);                 // +1 = la cabeza queda a la derecha
    // con el pie como pivote, el eje X local (el ancho del cuerpo) queda en vertical: se aplana (DEAD_FLAT) y se sube
    // lo que sobresale por debajo del carril
    const below = (dir > 0 ? (g.r + 1 - g.ox * g.W) : (g.ox * g.W - g.l)) * s * DEAD_FLAT;
    const half = ((g.b - g.t + 1) * s * DEAD_LEN) / 2;
    const L = this.lying && this.lying[a.id];
    const cx = L ? L.cx : Math.min(W - half - 4, Math.max(half + 4, a.base.x));
    return { angle: dir * 90, x: cx - a.base.x - dir * half, y: -below, scaleX: s * DEAD_FLAT, scaleY: s * DEAD_LEN };
  }

  desaturate(a) {
    a.sp.setTint(DEAD_TINT);
    try {
      if (a.sp.preFX && !a.gray) a.gray = a.sp.preFX.addColorMatrix().saturate(-0.85);
    } catch { /* sin WebGL: queda el tinte */ }
  }

  layDown(a) {
    if (a.breath) { a.breath.stop(); a.breath = null; }
    this.tweens.killTweensOf([a.c, a.sp]);
    a.dead = true;
    a.c.setPosition(a.base.x, a.base.y);
    this.setPose(a, a.kind === 'enemy' ? 'hit' : 'idle', false);
    const p = this.deadPose(a);
    a.sp.setAngle(p.angle).setPosition(p.x, p.y).setScale(p.scaleX, p.scaleY).setAlpha(DEAD_ALPHA);
    this.desaturate(a);
    a.sh.setAlpha(0.5);
    for (const k of Object.keys(a.markers)) this.clearMarker(a, k);
  }

  /** V6: caída animada (rotación + bajada, FALL_MS ≤ 600) hasta quedar tendido; sin fantasma translúcido de pie. */
  fall(a) {
    if (a.dead) return;
    if (this.reduced) { this.layDown(a); return; }
    if (a.breath) { a.breath.stop(); a.breath = null; }
    a.dead = true;
    this.tweens.killTweensOf([a.c, a.sp]);
    a.c.setPosition(a.base.x, a.base.y);
    this.setPose(a, a.kind === 'enemy' ? 'hit' : 'idle', false);
    this.desaturate(a);
    for (const k of Object.keys(a.markers)) this.clearMarker(a, k);
    const p = this.deadPose(a);
    this.tweens.add({ targets: a.sp, angle: p.angle, x: p.x, y: p.y, scaleX: p.scaleX, scaleY: p.scaleY, alpha: DEAD_ALPHA, duration: FALL_MS, ease: 'Cubic.easeIn' });
    this.tweens.add({ targets: a.sh, alpha: 0.5, duration: FALL_MS });
  }

  /** V7: ¿hay que voltear al atacante para que mire a su objetivo? */
  flipToward(a, target) {
    const dx = target.base.x - a.base.x;
    if (Math.abs(dx) < 12) return false;
    return Math.sign(dx) !== FACING[a.kind];
  }

  /** V7: el tirador se inclina hacia el objetivo (el pie hace de pivote), como mucho AIM_MAX_DEG. */
  aimAngle(a, target, flip) {
    if (!RANGED.has(a.art)) return 0;
    const dx = Math.abs(target.base.x - a.base.x) || 1;
    const dy = (a.base.y - a.base.alphaH * 0.6) - (target.base.y - target.base.alphaH * 0.5);
    const deg = Math.min(AIM_MAX_DEG, Math.max(0, (Math.atan2(dy, dx) * 180) / Math.PI));
    const facingRight = (FACING[a.kind] > 0) !== !!flip;
    return facingRight ? -deg : deg;
  }

  /** px CSS por unidad del mundo (el lienzo 824×1720 se escala FIT en la pantalla). Sin escala conocida: 412 px de ancho. */
  cssPerWorld() {
    const d = this.scale && this.scale.displaySize;
    return d && d.width > 0 ? d.width / W : 0.5;
  }

  /**
   * Daño/texto flotante (V4): `css` = tamaño en px de pantalla. Pop 1,4→1 en 120 ms; sube 60 px CSS; se desvanece y
   * desaparece a los 800 ms. (x, y) es el borde inferior central del texto, en el mundo. `place(t)`, si viene, decide la
   * posición con el tamaño REAL del texto (ya con el pop) antes de que arranquen las animaciones.
   */
  float(x, y, text, color, css = FLOAT_NORMAL, place = null) {
    const k = this.cssPerWorld();
    const size = Math.round(css / k);
    const t = this.add.text(x, y, String(text), {
      fontFamily: FONT, fontSize: `${size}px`, color: color || '#e6dcc3', stroke: '#120a07', strokeThickness: Math.max(4, Math.round(size / 8)),
    }).setOrigin(0.5, 1).setDepth(2700).setScale(FLOAT_POP_FROM);
    t.cssSize = css;
    if (place) { const p = place(t); t.setPosition(p.x, p.y); }
    t.spawnX = t.x;
    t.spawnY = t.y;
    this.tweens.add({ targets: t, scale: 1, duration: FLOAT_POP_MS, ease: 'Quad.easeOut' });
    this.tweens.add({ targets: t, y: t.spawnY - FLOAT_RISE / k, duration: FLOAT_MS, ease: 'Cubic.easeOut' });
    this.tweens.add({ targets: t, alpha: 0, duration: FLOAT_MS * 0.4, delay: FLOAT_MS * 0.6, onComplete: () => t.destroy() });
    return t;
  }

  /**
   * Flotante SOBRE LA CABEZA del actor (nunca sobre la cara = 35 % superior de la silueta): su borde inferior arranca
   * FLOAT_HEAD_GAP px CSS por encima del tope de la silueta. Si el actor ya tiene números a la vista, el nuevo se apila
   * 4 px CSS por encima del borde superior REAL (con la escala del momento) de todos los que tiene debajo: nunca se
   * pisan, ni al nacer ni después (todos suben lo mismo con una curva que frena, así que el más nuevo, que va arriba,
   * es el más rápido y se aleja). Si apilado ya no queda a la vista (por debajo de las barras de vida del HUD, o del borde
   * del lienzo si no hay medida), va en una columna al lado, desde la cabeza y sin cruzarse con ninguna otra; si tampoco
   * cabe al lado, se queda en la pila aunque quede bajo las barras: nunca encima de otro.
   */
  floatAt(a, text, color, crit = false) {
    const css = crit ? FLOAT_CRIT : FLOAT_NORMAL;
    const k = this.cssPerWorld();
    const gap = FLOAT_STACK_GAP / k;
    const edge = FLOAT_EDGE / k;
    const seen = Math.max(edge, this.hud && Number.isFinite(this.hud.top) ? this.hud.top + gap : -Infinity);
    a.floats = (a.floats || []).filter((o) => o.active !== false && o.alpha > 0.02);
    const live = a.floats.map(floatBox);
    const prev = a.floats[a.floats.length - 1];
    const head = a.base.headY - FLOAT_HEAD_GAP / k;
    const t = this.float(a.base.x, head, text, color, css, (txt) => {
      const hw = (txt.width * Math.abs(txt.scaleX || 1)) / 2;
      const h = txt.height * Math.abs(txt.scaleY || 1);
      const clampX = (x) => Math.min(W - edge - hw, Math.max(edge + hw, x));
      const crosses = (x, b) => x - hw - gap < b.x1 && b.x0 < x + hw + gap;
      const x1 = clampX(prev ? prev.x : a.base.x);
      const y1 = Math.min(head, ...live.filter((b) => crosses(x1, b)).map((b) => b.y0 - gap));
      if (!live.length || y1 - h >= seen) return { x: x1, y: y1 };
      const side = [clampX(Math.max(...live.map((b) => b.x1)) + gap + hw), clampX(Math.min(...live.map((b) => b.x0)) - gap - hw)]
        .filter((x) => !live.some((b) => crosses(x, b)))
        .sort((p, q) => Math.abs(p - a.base.x) - Math.abs(q - a.base.x));
      return side.length ? { x: side[0], y: head } : { x: x1, y: y1 };
    });
    a.floats.push(t);
    return t;
  }

  flash(a, color = 0xffffff, ms = 70) {
    a.sp.setTintFill(color);
    this.time.delayedCall(ms, () => {
      if (!a.sp || a.sp.active === false) return;
      if (a.dead) a.sp.setTint(DEAD_TINT); else a.sp.clearTint();
    });
  }

  restoreLater(a, ms) {
    this.time.delayedCall(ms, () => {
      if (a.dead) return;
      this.setPose(a, 'idle', false);
      a.sp.setAngle(0);
      a.sp.x = 0;
    });
  }

  burst(x, y, n, color) {
    this.sparks.setParticleTint(color);
    this.sparks.explode(Math.min(n, this.q.maxParticles), x, y);
  }

  playBeat(b) {
    const actor = b.actorId ? this.actors[b.actorId] : null;
    const target = b.targetId ? this.actors[b.targetId] : null;
    const tint = toInt(b.color);
    const cam = this.cameras.main;
    const at = target || actor;
    if (!at && b.kind !== 'end' && b.scope !== 'squad') return;
    const tx = at ? at.base.x : W / 2;
    const ty = at ? at.base.y - at.base.alphaH * 0.55 : H / 2;

    switch (b.kind) {
      case 'hit':
      case 'skill': {
        if (b.scope === 'squad') { this.float(W / 2, 1100, b.text || 'Escudo', b.color, FLOAT_NORMAL); break; }
        if (actor && !actor.dead) {
          const flip = target ? this.flipToward(actor, target) : false;
          this.setPose(actor, 'attack', flip);
          if (target) {
            actor.sp.setAngle(this.aimAngle(actor, target, flip));
            if (ATTACK_FX[actor.art]) this.clearMuzzle(actor, flip);
            this.keepInside(actor);
            this.lastShot = this.shoot(actor, target);
          }
          // el tirador dispara desde su sitio (embestir correría la boca del arma sobre la fila de atrás)
          if (!this.reduced && target && !ATTACK_FX[actor.art]) {
            const dir = Math.sign(target.base.x - actor.base.x) || 1;
            this.tweens.add({
              targets: actor.c, x: actor.base.x + dir * LUNGE_PX, duration: 110, yoyo: true, ease: 'Quad.easeOut',
              onComplete: () => { actor.c.x = actor.base.x; },   // si la pantalla se recolocó en medio, termina en su x nueva
            });
          }
          this.restoreLater(actor, 420);
        }
        if (target) {
          if (b.num !== undefined) {
            if (!target.dead) {
              this.setPose(target, 'hit', false);
              this.flash(target, 0xffffff, 60);
            }
            this.burst(tx, ty, b.intensity > 1.5 ? 40 : 24, [tint, 0xffd27a]);
            if (!this.reduced) {
              cam.shake(b.intensity > 1.5 ? 260 : 170, b.intensity > 1.5 ? 0.014 : 0.008);
              if (!target.dead) {
                const away = actor ? Math.sign(target.base.x - actor.base.x) || 1 : 1;
                this.tweens.add({
                  targets: target.c, x: target.base.x + away * RECOIL_PX, duration: 90, yoyo: true, ease: 'Quad.easeOut',
                  onComplete: () => { target.c.x = target.base.x; },
                });
              }
            }
            this.restoreLater(target, 360);
            this.floatAt(target, b.intensity > 1.5 ? `${b.num}!` : b.num, b.color, b.intensity > 1.5);
          } else if (b.text) {
            this.floatAt(target, b.text, b.color);
          }
        }
        break;
      }
      case 'death': {
        if (!target) break;
        this.burst(tx, ty, 18, 0xe8d9a0);
        this.fall(target);
        break;
      }
      case 'status': {
        if (!target) break;
        if (b.marker === 'add' && !target.dead) this.setMarker(target, b.status.type, tint);
        else if (b.marker === 'remove') this.clearMarker(target, b.status.type);
        if (b.text) this.floatAt(target, b.text, b.color);
        break;
      }
      case 'dot':
      case 'heal': {
        if (!target) break;
        this.burst(tx, ty, 8, tint);
        if (b.num !== undefined) this.floatAt(target, b.kind === 'heal' ? `+${b.num}` : b.num, b.color);
        break;
      }
      case 'passive': {
        // «¡Crítico!» sale sobre quien lo hace; sobre el objetivo queda el número (el crítico ya va grande y con «!»).
        // Así el número no tiene que apilarse sobre el cartel y, en un enemigo alto, subir bajo las barras del HUD.
        const who = actor || at;
        if (b.text && who) this.floatAt(who, b.text, b.color);
        else if (b.text) this.float(tx, ty, b.text, b.color, FLOAT_NORMAL);
        else this.burst(tx, ty, 6, tint);
        break;
      }
      case 'text':
        if (b.text && at) this.floatAt(at, b.text, b.color);
        else if (b.text) this.float(tx, ty, b.text, b.color, FLOAT_NORMAL);
        break;
      default:
        break;
    }
  }

  /** Marcador de estado sobre la cabeza, dentro del contenedor del personaje (se mueve con él). */
  setMarker(a, type, color) {
    if (a.markers[type]) return;
    const n = Object.keys(a.markers).length;
    const m = this.add.image(-40 + n * 28, -a.base.alphaH - 24, 'spark').setTint(color).setScale(0.9);
    a.c.add(m);
    a.markers[type] = m;
  }

  clearMarker(a, type) {
    const m = a.markers[type];
    if (m) { m.destroy(); delete a.markers[type]; }
  }
}
