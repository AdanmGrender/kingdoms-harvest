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
import { collectAssetKeys, textureKey, spriteGeom, bgCoverScale, BG_DRIFT } from './artMap';
import { computeFormation, enemyList, WORLD } from './formation';
import { createRoundQueue } from './eventPlanner';
import { QUALITY, DEFAULT_QUALITY } from './combatQuality';

const { w: W, h: H } = WORLD;
const FONT = "'IM Fell English SC', 'IM Fell English', serif";
const toInt = (hex) => parseInt(String(hex || '#ffffff').replace('#', ''), 16) || 0xffffff;
export const FLOAT_NORMAL = 40;   // V4 (enmienda): 36–44 px de mundo en daño normal…
export const FLOAT_CRIT = 60;     // …56–64 px en crítico
export const FLOAT_STACK = 28;    // apilado: offset vertical entre números simultáneos
export const FLOAT_RISE = 60;     // sube 60 px…
export const FLOAT_MS = 800;      // …en ≤800 ms
export const FLOAT_POP_MS = 120;  // pop 1,4 → 1 en 120 ms
export const FLOAT_POP_FROM = 1.4;
export const FLOAT_HEAD_GAP = 12; // el número arranca 12 px por encima de la cabeza (tope de la silueta)
export const DEAD_ALPHA = 0.85;   // V6: tendido, nunca fantasma
const DEAD_TINT = 0x9a9a9a;       // V6: apagado (con WebGL además se desatura con una matriz de color)
export const FALL_MS = 450;       // V6: caída ≤600 ms
const LUNGE_PX = 40;
const RECOIL_PX = 24;
export const AIM_MAX_DEG = 15;    // V7: el tirador inclina el arma hacia su objetivo, como mucho 15°
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
    g.generateTexture('fog', 512, 256);
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
    const f = computeFormation(this.state0.heroes || [], enemies, { boss, node: this.node });
    this.formation = f;
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
        a.breath = this.tweens.add({ targets: sp, scaleY: sc * 1.014, scaleX: sc * 0.996, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: (Math.round(b.cx) % 7) * 90 });
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
    const p = a.kind === 'enemy' && pose === 'attack' ? 'hit' : pose;
    const key = this.texFor(a.kind, a.art, p);
    a.sp.setTexture(key);
    const g = key.startsWith('ph:') ? null : spriteGeom(a.kind, a.art, p);
    const ox = g ? g.ox : 0.5;
    const oy = g ? g.oy : 1;
    a.sp.setFlipX(!!flip).setOrigin(flip ? 1 - ox : ox, oy);
    a.sp.setScale(a.base.h / (a.sp.height || a.base.h));
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

  /** Pose tendida (V6), en coordenadas del contenedor: cae hacia el centro, apoyada sobre su carril y centrada en x. */
  deadPose(a) {
    const g = spriteGeom(a.kind, a.art, a.kind === 'enemy' ? 'hit' : 'idle');
    const s = a.base.h / g.H;
    const dir = a.base.x >= W / 2 ? -1 : 1;     // +1 = gira a la derecha (la cabeza queda a la derecha)
    // con el pie como pivote, el grosor del cuerpo queda en vertical: se sube lo que sobresale por debajo del carril
    const below = dir > 0 ? (g.r + 1 - g.ox * g.W) * s : (g.ox * g.W - g.l) * s;
    // tendido, el cuerpo ocupa alphaH a lo ancho: se centra en su x, sin salirse del lienzo
    const half = a.base.alphaH / 2;
    const cx = Math.min(W - half - 4, Math.max(half + 4, a.base.x));
    return { angle: dir * 90, x: cx - a.base.x - dir * half, y: -below };
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
    a.sp.setAngle(p.angle).setPosition(p.x, p.y).setAlpha(DEAD_ALPHA);
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
    this.tweens.add({ targets: a.sp, angle: p.angle, x: p.x, y: p.y, alpha: DEAD_ALPHA, duration: FALL_MS, ease: 'Cubic.easeIn' });
    this.tweens.add({ targets: a.sh, alpha: 0.5, duration: FALL_MS });
  }

  /** V7: ¿hay que voltear al atacante para que mire a su objetivo? */
  flipToward(a, target) {
    const dx = target.base.x - a.base.x;
    if (Math.abs(dx) < 12) return false;
    return Math.sign(dx) !== FACING[a.kind];
  }

  /** V7: el tirador inclina el arma hacia el objetivo (el pie hace de pivote), como mucho AIM_MAX_DEG. */
  aimAngle(a, target, flip) {
    if (!RANGED.has(a.art)) return 0;
    const dx = Math.abs(target.base.x - a.base.x) || 1;
    const dy = (a.base.y - a.base.alphaH * 0.6) - (target.base.y - target.base.alphaH * 0.5);
    const deg = Math.min(AIM_MAX_DEG, Math.max(0, (Math.atan2(dy, dx) * 180) / Math.PI));
    const facingRight = (FACING[a.kind] > 0) !== !!flip;
    return facingRight ? -deg : deg;
  }

  /** Daño/texto flotante (V4 enmendada): pop 1,4→1 en 120 ms, sube 60 px y se desvanece en ≤800 ms. */
  float(x, y, text, color, size = FLOAT_NORMAL) {
    const t = this.add.text(x, y, String(text), {
      fontFamily: FONT, fontSize: `${size}px`, color: color || '#e6dcc3', stroke: '#120a07', strokeThickness: Math.max(4, Math.round(size / 8)),
    }).setOrigin(0.5, 1).setDepth(2700).setScale(FLOAT_POP_FROM);
    this.tweens.add({ targets: t, scale: 1, duration: FLOAT_POP_MS, ease: 'Quad.easeOut' });
    this.tweens.add({ targets: t, y: y - FLOAT_RISE, duration: FLOAT_MS, ease: 'Cubic.easeOut' });
    this.tweens.add({ targets: t, alpha: 0, duration: FLOAT_MS * 0.4, delay: FLOAT_MS * 0.6, onComplete: () => t.destroy() });
    return t;
  }

  /**
   * Flotante SOBRE LA CABEZA del actor (nunca sobre la cara = 35 % superior de la silueta): su borde inferior arranca
   * FLOAT_HEAD_GAP px por encima del tope de la silueta. `crit` → 56–64 px. Los simultáneos se apilan 28 px.
   */
  floatAt(a, text, color, crit = false, lane = 0) {
    const size = crit ? FLOAT_CRIT : FLOAT_NORMAL;
    const now = this.time ? this.time.now : 0;
    if (a.floatAt === undefined || now - a.floatAt > FLOAT_POP_MS * 4) a.floatLane = -1;   // solo se apilan los simultáneos
    a.floatAt = now;
    const lanes = a.floatLane = (a.floatLane ?? -1) + 1;
    const n = lane || Math.min(lanes, 3);
    const x = Math.min(W - 70, Math.max(70, a.base.x));
    const y = a.base.headY - FLOAT_HEAD_GAP - n * FLOAT_STACK;
    return this.float(x, Math.max(size + 8, y), text, color, size);
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
          if (target) actor.sp.setAngle(this.aimAngle(actor, target, flip));
          if (!this.reduced && target) {
            const dir = Math.sign(target.base.x - actor.base.x) || 1;
            this.tweens.add({ targets: actor.c, x: actor.base.x + dir * LUNGE_PX, duration: 110, yoyo: true, ease: 'Quad.easeOut' });
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
                this.tweens.add({ targets: target.c, x: target.base.x + away * RECOIL_PX, duration: 90, yoyo: true, ease: 'Quad.easeOut' });
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
        if (b.text && at) this.floatAt(at, b.text, b.color);
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
