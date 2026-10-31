/**
 * Escena de combate B (combate_b T5, R3, R31, R46, R47). Portada del spike `spikes/001-combat-b/main.js`.
 * La escena NO decide cifras ni usa azar: reproduce los beats que planifica `eventPlanner` (R3) y
 * avisa con `onRoundDone` al vaciar la cola. Nada de `window.dispatchEvent` ni unidades de viewport.
 */
import Phaser from 'phaser';
import { collectAssetKeys, textureKey } from './artMap';
import { computeFormation, enemyList, WORLD } from './formation';
import { createRoundQueue } from './eventPlanner';
import { QUALITY, DEFAULT_QUALITY } from './combatQuality';
import { profileFor, attackPlan, impactPlan, fallPlan, victoryPlan, idleParams, nextShift, idleState, sampleSteps, stepsEnd, compose, hash01, mulberry32, NEUTRAL, CHANNELS } from './motion';
import { resolvePose, isExtraPose, extraAssetKeys } from './poseMap';

const { w: W, h: H } = WORLD;
const FONT = "'IM Fell English SC', 'IM Fell English', serif";
const toInt = (hex) => parseInt(String(hex || '#ffffff').replace('#', ''), 16) || 0xffffff;

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
    for (const a of [...this.assets, ...extraAssetKeys(this.assets)]) this.load.image(a.key, a.url); // poses extra (poseMap): si no cargan, hay fallback
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

    // fondo (cover) con leve deriva
    const bgKey = this.texFor('bg', this.assets.find((a) => a.key.startsWith('bg:'))?.key.slice(3) || 'crypt');
    const bg = this.add.image(W / 2, H / 2, bgKey);
    const s = Math.max(W / (bg.width || W), H / (bg.height || H)) * 1.04;
    bg.setScale(s);
    if (!this.reduced) this.tweens.add({ targets: bg, scale: s * 1.025, x: W / 2 - 8, duration: 9000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

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
    // polvo (aterrizajes, impactos, caídas): sin blend aditivo, tono tierra
    this.dustFx = this.add.particles(0, 0, 'spark', {
      lifespan: { min: 300, max: 700 }, speed: { min: 40, max: 200 }, angle: { min: 200, max: 340 }, scale: { start: 0.9, end: 0.2 },
      alpha: { start: 0.55, end: 0 }, gravityY: 120, emitting: false, maxAliveParticles: this.q.maxParticles, tint: 0xb8a98a,
    }).setDepth(2400);

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
    const f = computeFormation(this.state0.heroes || [], enemies, { boss });
    this.formation = f;
    const mk = (b, kind, art) => {
      const key = this.texFor(kind, art, 'idle');
      const sh = this.add.image(b.cx, b.anchor.y + 6, 'shadow').setDepth(b.anchor.y - 1);
      const sp = this.add.image(b.cx, b.anchor.y, key).setOrigin(0.5, 1).setDepth(b.anchor.y);
      const sc = b.h / (sp.height || b.h);
      sp.setScale(sc);
      sh.setScale((sp.displayWidth / 256) * 1.05, 1.1);
      const a = { id: b.id, kind, art, sp, sh, base: { x: b.cx, y: b.anchor.y, sc, h: b.h }, markers: {}, key, sc, dead: false, tok: 0, maxHp: this.maxHpOf(b.id) };
      this.initMotion(a);
      this.actors[b.id] = a;
    };
    for (const b of f.heroes) mk(b, 'hero', b.art);
    const enemyArtKey = (this.assets.find((a) => a.key.startsWith('enemy:')) || { key: 'enemy:bruto:idle' }).key.split(':')[1];
    for (const b of f.enemies) mk(b, 'enemy', enemyArtKey);
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
    this.stepMotion(delta);
    for (const b of this.queue.tick(delta)) this.playBeat(b);
    if (this.waiting && this.queue.isIdle()) {
      this.waiting = false;
      if (this.tweens) this.tweens.timeScale = 1;
      if (this.time) this.time.timeScale = 1;
      this.applyView(this.queue.reconcile(this.finalState));
      if (this.opts.onRoundDone) this.opts.onRoundDone({ lastT: this.queue.lastT });
    }
  }

  // ── Reproducción de beats ────────────────────────────────────────────────

  // ── Movimiento por código (motion.js): canales act/hit/idle/end por actor, avanzados con el reloj de la cola ──

  maxHpOf(id) {
    const s = this.state0 || {};
    const h = (s.heroes || []).find((x) => `h${x.slot}` === id);
    if (h) return h.maxHp ?? h.hp ?? 100;
    const e = enemyList(s).find((x, i) => (x && x.id ? x.id : `e${i}`) === id);
    return (e && (e.maxHp ?? e.hp)) || 100;
  }

  initMotion(a) {
    a.prof = profileFor(a.kind, a.art);
    a.tr = {}; a.ch = {};
    for (const c of CHANNELS) { a.tr[c] = { steps: null, from: NEUTRAL, cur: NEUTRAL, t: 0 }; a.ch[c] = NEUTRAL; }
    a.mt = 0;
    const phase = hash01(a.id);
    const ip = idleParams(a.prof, { reduced: this.reduced, phase });
    a.idle = ip ? { ip, rng: mulberry32(phase), from: 0, to: 0, t: 0, dur: 1, nextAt: ip.firstShiftIn } : null;
  }

  runSteps(a, ch, steps) {
    if (this.reduced || !steps || !steps.length) return;
    const tr = a.tr[ch];
    tr.from = tr.cur; tr.steps = steps; tr.t = 0;
  }

  stepMotion(delta) {
    const dt = Math.max(0, delta) * (this.queue && this.queue.speed ? this.queue.speed : 1);
    for (const a of Object.values(this.actors)) {
      if (!a.tr) continue;
      a.mt += dt;
      for (const c of ['act', 'hit', 'end']) {
        const tr = a.tr[c];
        if (!tr.steps) continue;
        tr.t += dt;
        tr.cur = sampleSteps(tr.steps, tr.from, tr.t);
        if (tr.t >= stepsEnd(tr.steps)) tr.steps = null;
        a.ch[c] = tr.cur;
      }
      if (a.idle && !a.dead) {
        const I = a.idle;
        if (a.mt >= I.nextAt) {
          const n = nextShift(a.prof, I.rng);
          I.from += (I.to - I.from) * Math.min(1, I.t / I.dur); I.to = n.dx; I.t = 0; I.dur = n.dur; I.nextAt = a.mt + n.wait;
        }
        I.t += dt;
        const k = Math.min(1, I.t / I.dur);
        const sh = I.from + (I.to - I.from) * (-(Math.cos(Math.PI * k) - 1) / 2);
        a.ch.idle = { ...idleState(I.ip, a.mt), x: sh };
      } else if (a.dead) a.ch.idle = NEUTRAL;
      if (this.reduced) continue; // Q10: sin desplazamientos ni escalas animadas
      const o = compose(a.ch, a.out || (a.out = {}));
      a.sp.x = a.base.x + o.x; a.sp.y = a.base.y + o.y;
      a.sp.scaleX = a.sc * (1 + o.sx); a.sp.scaleY = a.sc * (1 + o.sy);
      a.sp.angle = o.rot;
      a.sh.x = a.base.x + o.x;
    }
  }

  applyView(view) {
    for (const [id, u] of Object.entries(view)) {
      const a = this.actors[id];
      if (!a) continue;
      a.sp.setAlpha(u.alive ? 1 : (a.kind === 'enemy' ? 0 : 0.35));
      a.sh.setAlpha(u.alive ? 1 : 0);
      if (!u.alive) {
        if (!a.dead) { a.dead = true; a.tok += 1; this.pose(a, 'ko'); } // muerte no reproducida (salto): pose de KO directa
        a.sp.setTint(0x555555);
      }
    }
  }

  float(x, y, text, color, size = 84) {
    const t = this.add.text(x, y, String(text), {
      fontFamily: FONT, fontSize: `${size}px`, color: color || '#e6dcc3', stroke: '#120a07', strokeThickness: 12,
    }).setOrigin(0.5).setDepth(2700).setScale(0.3);
    this.tweens.add({ targets: t, scale: 1, duration: 140, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, y: y - 120, alpha: 0, duration: 700, delay: 350, ease: 'Cubic.easeIn', onComplete: () => t.destroy() });
  }

  flash(a, color = 0xffffff, ms = 70) {
    a.sp.setTintFill(color);
    this.time.delayedCall(ms, () => { if (a.sp && a.sp.active !== false) a.sp.clearTint(); });
  }

  hasTex(kind, art, pose) {
    const k = textureKey(kind, art, pose);
    return !this.failed.has(k) && this.textures.exists(k);
  }

  /** Cambia de pose con fallback (poseMap): sin la pose pedida usa la siguiente de la cadena y el movimiento cuenta el resto. */
  pose(a, want) {
    const p = resolvePose(a.kind, a.art, want, (k, art, ps) => ps === 'idle' || this.hasTex(k, art, ps));
    if (p === null) return; // KO sin arte propio: conserva la pose actual
    a.tok += 1;
    a.sp.setTexture(this.texFor(a.kind, a.art, p));
    // las poses extra conservan la escala del idle (un KO queda más bajo); attack/hit base se normalizan a la altura de formación
    a.sc = p === 'idle' || isExtraPose(a.kind, a.art, p) ? a.base.sc : a.base.h / (a.sp.height || a.base.h);
    a.sp.setScale(a.sc);
  }

  restoreLater(a, ms) {
    const tok = a.tok;
    this.time.delayedCall(ms, () => {
      if (a.dead || a.tok !== tok) return; // murió o cambió de pose en el ínterin
      a.sp.setTexture(this.texFor(a.kind, a.art, 'idle'));
      a.sc = a.base.sc;
      a.sp.setScale(a.sc);
    });
  }

  dust(x, y, n) {
    if (this.reduced || !this.dustFx) return;
    this.dustFx.explode(Math.min(n, this.q.maxParticles), x, y);
  }

  /** Impacto en el objetivo: pose hit + flash + retroceso proporcional al daño + chispas y polvo en el punto de golpe. */
  impact(b, actor, target, tint, tx, ty) {
    this.pose(target, 'hit');
    this.flash(target, 0xffffff, 80);
    this.burst(tx, ty, b.intensity > 1.5 ? 40 : 24, [tint, 0xffd27a]);
    this.dust(tx, target.base.y - 6, 7);
    if (!this.reduced) {
      this.cameras.main.shake(b.intensity > 1.5 ? 260 : 170, b.intensity > 1.5 ? 0.014 : 0.008);
      const dirX = actor ? target.base.x - actor.base.x : (target.kind === 'enemy' ? 1 : -1);
      const dirY = actor ? target.base.y - actor.base.y : 0;
      const ratio = (Number(b.num) || 0) / (target.maxHp || 100);
      this.runSteps(target, 'hit', impactPlan(target.prof, { dur: 360, dmgRatio: ratio, intensity: b.intensity, dirX, dirY, reduced: false }).steps);
    }
    this.restoreLater(target, 360);
  }

  /** Victoria: los vivos adoptan la pose de victoria (o se quedan en idle) y dan un salto corto. Decoración tras el final de la ronda. */
  celebrate() {
    for (const a of Object.values(this.actors)) {
      if (a.kind !== 'hero' || a.dead) continue;
      a.tok += 1;
      this.pose(a, 'victory');
      this.runSteps(a, 'end', victoryPlan(a.prof, { reduced: this.reduced }).steps);
    }
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
    const ty = at ? at.base.y - at.base.h * 0.55 : H / 2;

    switch (b.kind) {
      case 'hit':
      case 'skill': {
        if (b.scope === 'squad') { this.float(W / 2, 1100, b.text || 'Escudo', b.color, 72); break; }
        if (actor) {
          const isSkill = b.kind === 'skill';
          this.pose(actor, isSkill ? 'skill' : 'attack');
          if (!this.reduced && target) {
            const plan = attackPlan(actor.prof, {
              dur: b.dur, dirX: target.base.x - actor.base.x, dirY: target.base.y - actor.base.y,
              dist: Math.hypot(target.base.x - actor.base.x, target.base.y - actor.base.y), reduced: false,
            });
            this.runSteps(actor, 'act', plan.steps);
            // polvo al aterrizar la embestida
            this.time.delayedCall(plan.contactAt, () => this.dust(actor.base.x + actor.ch.act.x, actor.base.y - 6, 5));
          }
          this.restoreLater(actor, Math.min(isSkill ? 650 : 420, b.dur));
        }
        if (target) {
          if (b.num !== undefined) {
            this.impact(b, actor, target, tint, tx, ty);
            this.float(tx, ty - 60, b.intensity > 1.5 ? `${b.num}!` : b.num, b.color, b.intensity > 1.5 ? 104 : 84);
          } else if (b.text) {
            this.float(tx, ty - 60, b.text, b.color, 64);
          }
        }
        break;
      }
      case 'death': {
        if (!target) break;
        this.burst(tx, ty, 18, 0xe8d9a0);
        target.dead = true;
        target.tok += 1; // cancela restauraciones de pose pendientes
        this.pose(target, 'ko');
        this.dust(target.base.x, target.base.y - 6, 12);
        if (!this.reduced) {
          this.runSteps(target, 'end', fallPlan(target.prof, { cap: b.dur + 250, side: target.kind === 'enemy' ? 1 : -1 }).steps);
        }
        // el héroe vencido queda tendido (alfa 0.35, como antes); el enemigo se desvanece. Solo fundido en reduced-motion.
        this.tweens.add({ targets: [target.sp, target.sh], alpha: target.kind === 'enemy' ? 0 : 0.35, duration: 700, delay: this.reduced ? 0 : 120, ease: 'Cubic.easeIn' });
        break;
      }
      case 'end': {
        if (b.result === 'victory') this.celebrate();
        break;
      }
      case 'status': {
        if (!target) break;
        if (b.marker === 'add') this.setMarker(target, b.status.type, tint);
        else if (b.marker === 'remove') this.clearMarker(target, b.status.type);
        if (b.text) this.float(tx, ty - 40, b.text, b.color, 56);
        break;
      }
      case 'dot':
      case 'heal': {
        if (!target) break;
        this.burst(tx, ty, 8, tint);
        if (b.num !== undefined) this.float(tx, ty - 40, b.kind === 'heal' ? `+${b.num}` : b.num, b.color, 60);
        break;
      }
      case 'passive': {
        if (b.text) this.float(tx, ty - 90, b.text, b.color, 64);
        else this.burst(tx, ty, 6, tint);
        break;
      }
      case 'text':
        if (b.text) this.float(tx, ty - 40, b.text, b.color, 56);
        break;
      default:
        break;
    }
  }

  setMarker(a, type, color) {
    if (a.markers[type]) return;
    const n = Object.keys(a.markers).length;
    const m = this.add.image(a.base.x - 40 + n * 28, a.base.y - a.base.h - 24, 'spark').setTint(color).setScale(0.9).setDepth(2600);
    a.markers[type] = m;
  }

  clearMarker(a, type) {
    const m = a.markers[type];
    if (m) { m.destroy(); delete a.markers[type]; }
  }
}
