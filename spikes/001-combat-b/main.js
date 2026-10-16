/* Spike 001 — combate "dirección B" en Phaser 3.90 puro (sin motor nuevo).
 * Valida: arte ilustrado de perfil + cambio de pose (idle/ataque/golpe) + luz,
 * partículas, cámara y post-FX de Phaser bastan para un combate con peso.
 * Espacio lógico 824×1720 (= 412×860 @2x), escalado FIT dentro de #phone. */
'use strict';
const W = 824, H = 1720;
const A = '/assets/b/';

const HEROES = [
  { id: 'ranger',  name: 'Isolde', cls: 'Batidora',  x: 112, y: 1180, h: 360, hp: 70,  dmg: [9, 14],  kind: 'bolt',
    face: { x: 46, y: 9, s: 330 } },
  { id: 'mage',    name: 'Vaun',   cls: 'Arcanista', x: 292, y: 1262, h: 390, hp: 60,  dmg: [13, 19], kind: 'storm',
    face: { x: 57, y: 14, s: 330 } },
  { id: 'warrior', name: 'Kael',   cls: 'Guardián',  x: 488, y: 1350, h: 440, hp: 120, dmg: [10, 16], kind: 'melee',
    face: { x: 66, y: 8, s: 360 } },
];
const ENEMY = { name: 'Bruto del Velo', x: 628, y: 1010, h: 480, hp: 160, dmg: [11, 18] };

const rnd = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const emit = (type, detail = {}) => window.dispatchEvent(new CustomEvent('kh', { detail: { type, ...detail } }));

class Combat extends Phaser.Scene {
  constructor() { super('combat'); }

  preload() {
    this.load.image('bg', A + 'bg/combat_crypt.webp');
    for (const h of HEROES) {
      this.load.image(`${h.id}_idle`, `${A}heroes/${h.id}_idle.webp`);
      this.load.image(`${h.id}_attack`, `${A}heroes/${h.id}_attack.webp`);
    }
    this.load.image('bruto_idle', A + 'enemies/bruto_idle.webp');
    this.load.image('bruto_hit', A + 'enemies/bruto_hit.webp');
  }

  makeTextures() {
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    // chispa suave (radial)
    for (let r = 16; r > 0; r--) { g.fillStyle(0xffffff, (1 - r / 16) ** 2); g.fillCircle(16, 16, r); }
    g.generateTexture('spark', 32, 32); g.clear();
    // brasa alargada
    g.fillStyle(0xffffff, 1); g.fillEllipse(4, 10, 6, 18); g.generateTexture('ember', 8, 20); g.clear();
    // niebla: elipse muy difusa
    for (let r = 128; r > 0; r -= 2) { g.fillStyle(0xffffff, 0.012); g.fillEllipse(256, 128, r * 4, r * 2); }
    g.generateTexture('fog', 512, 256); g.clear();
    // sombra de contacto
    for (let r = 64; r > 0; r -= 2) { g.fillStyle(0x000000, 0.035); g.fillEllipse(128, 32, r * 4, r); }
    g.generateTexture('shadow', 256, 64); g.clear();
    // tajo: media luna
    g.fillStyle(0xffffff, 1);
    g.slice(160, 160, 150, Phaser.Math.DegToRad(200), Phaser.Math.DegToRad(340), false); g.fillPath();
    g.fillStyle(0x000000, 1);
    g.slice(160, 185, 140, Phaser.Math.DegToRad(195), Phaser.Math.DegToRad(345), false); g.fillPath();
    g.generateTexture('slashRaw', 320, 200); g.destroy();
    // el negro del tajo → transparente (máscara por canal): se pinta con ADD, así que el negro no suma
  }

  create() {
    this.makeTextures();
    const cam = this.cameras.main;

    // ── fondo (cover) con leve deriva ──
    const bg = this.add.image(W / 2, H / 2, 'bg');
    const s = Math.max(W / bg.width, H / bg.height) * 1.04;
    bg.setScale(s);
    this.tweens.add({ targets: bg, scale: s * 1.025, x: W / 2 - 8, duration: 9000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // ── luces: braseros + ventana (PointLight = glow aditivo barato) ──
    const lights = [
      { x: 70, y: 905, c: 0xe8933a, r: 260, i: 0.16 }, { x: 760, y: 905, c: 0xe8933a, r: 260, i: 0.16 },
      { x: 412, y: 330, c: 0x4fd8c8, r: 380, i: 0.08 },
    ];
    for (const L of lights) {
      const pl = this.add.pointlight(L.x, L.y, L.c, L.r, L.i, 0.06);
      if (L.c === 0xe8933a) this.tweens.add({ targets: pl, intensity: L.i * 0.6, radius: L.r * 0.92,
        duration: rnd(90, 160), yoyo: true, repeat: -1, repeatDelay: rnd(20, 120), ease: 'Stepped' });
      else this.tweens.add({ targets: pl, intensity: L.i * 0.5, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    // ── niebla baja ──
    for (let k = 0; k < 3; k++) {
      const f = this.add.image(rnd(0, W), rnd(1050, 1350), 'fog').setScale(2.2, 1.4).setAlpha(0.5).setTint(0x8a8fa0);
      this.tweens.add({ targets: f, x: f.x + (k % 2 ? 260 : -260), duration: rnd(16000, 22000), yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    // ── capa de atenuación (foco en el ataque) ──
    this.dim = this.add.rectangle(W / 2, H / 2, W * 2, H * 2, 0x000000, 0).setDepth(50);

    // ── actores ──
    this.actors = {};
    const mkActor = (key, x, y, h, id) => {
      const sh = this.add.image(x, y + 6, 'shadow').setDepth(y - 1);
      const sp = this.add.image(x, y, key).setOrigin(0.5, 1).setDepth(y);
      const sc = h / sp.height;
      sp.setScale(sc);
      sh.setScale((sp.displayWidth / 256) * 1.05, 1.1);
      const a = { id, sp, sh, base: { x, y, sc, h }, idleKey: key };
      a.breath = this.tweens.add({ targets: sp, scaleY: sc * 1.014, scaleX: sc * 0.996, duration: rnd(1300, 1700),
        yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: rnd(0, 800) });
      this.actors[id] = a;
      return a;
    };
    for (const h of HEROES) mkActor(`${h.id}_idle`, h.x, h.y, h.h, h.id);
    this.enemy = mkActor('bruto_idle', ENEMY.x, ENEMY.y, ENEMY.h, 'enemy');
    this.enemy.sp.setFlipX(false);
    this.state = { ehp: ENEMY.hp, round: 1, heroes: Object.fromEntries(HEROES.map((h) => [h.id, h.hp])) };

    // ── brasas ──
    this.add.particles(0, 0, 'ember', {
      x: { min: 0, max: W }, y: H + 20, lifespan: { min: 4000, max: 7000 }, speedY: { min: -60, max: -130 },
      speedX: { min: -20, max: 25 }, scale: { start: 0.9, end: 0.2 }, alpha: { start: 0.9, end: 0 },
      tint: [0xe8933a, 0xffb050, 0xd9a441], blendMode: 'ADD', frequency: 140, rotate: { min: -20, max: 20 },
    }).setDepth(900);
    this.sparks = this.add.particles(0, 0, 'spark', {
      lifespan: { min: 250, max: 650 }, speed: { min: 250, max: 750 }, scale: { start: 0.9, end: 0 },
      alpha: { start: 1, end: 0 }, blendMode: 'ADD', gravityY: 900, emitting: false,
    }).setDepth(1000);
    this.blood = this.add.particles(0, 0, 'spark', {
      lifespan: { min: 400, max: 900 }, speed: { min: 150, max: 520 }, scale: { start: 0.7, end: 0.15 },
      tint: [0x6e0d0a, 0x9a1812, 0x3a0705], gravityY: 1400, emitting: false,
    }).setDepth(999);

    // ── post-FX de cámara: viñeta + bloom suave ──
    if (cam.postFX) {
      cam.postFX.addVignette(0.5, 0.48, 0.92, 0.42);
      this.bloom = cam.postFX.addBloom(0xffffff, 1, 1, 1, 0.55, 3);
    }
    this.lightning = this.add.graphics().setDepth(1001).setBlendMode('ADD');

    emit('init', { heroes: HEROES, enemy: ENEMY });
    this.queue = ['warrior', 'mage', 'ranger', 'enemy'];
    this.turn = 0;
    this.busy = false;
    window.addEventListener('kh-cmd', (e) => { if (e.detail === 'next') this.next(); });
    this.autoplay();
  }

  // ── utilidades de animación ──
  tw(cfg) { return new Promise((r) => this.tweens.add({ ...cfg, onComplete: r })); }
  wait(ms) { return new Promise((r) => this.time.delayedCall(ms, r)); }
  hitStop(ms) { this.tweens.pauseAll(); return new Promise((r) => setTimeout(() => { this.tweens.resumeAll(); r(); }, ms)); }

  autoplay() {
    clearTimeout(this._auto);
    this._auto = setTimeout(() => { if (!this.busy) this.next(); this.autoplay(); }, 2600);
  }

  async next() {
    if (this.busy) return;
    this.busy = true;
    const who = this.queue[this.turn % this.queue.length];
    this.turn++;
    try {
      if (who === 'enemy') await this.enemyTurn();
      else await this.heroTurn(HEROES.find((h) => h.id === who));
    } finally { this.busy = false; }
    if (this.turn % this.queue.length === 0) { this.state.round++; emit('round', { round: this.state.round }); }
  }

  focus(attacker, target, on) {
    const cam = this.cameras.main;
    if (on) {
      attacker.sp.setDepth(60 + attacker.base.y / 100); target.sp.setDepth(60 + target.base.y / 100);
      const mx = (attacker.base.x + target.base.x) / 2, my = (attacker.base.y + target.base.y) / 2 - 220;
      cam.pan(mx, my, 420, 'Cubic.easeOut'); cam.zoomTo(1.2, 420, 'Cubic.easeOut');
      this.tw({ targets: this.dim, fillAlpha: 0.5, duration: 300 });
      return this.wait(380);
    }
    cam.pan(W / 2, H / 2, 520, 'Cubic.easeInOut'); cam.zoomTo(1, 520, 'Cubic.easeInOut');
    this.tw({ targets: this.dim, fillAlpha: 0, duration: 450 });
    return this.wait(260).then(() => { attacker.sp.setDepth(attacker.base.y); target.sp.setDepth(target.base.y); });
  }

  pose(actor, key) {
    // cada pose tiene otro recorte → normalizar por alto para que no "salte" de tamaño
    actor.sp.setTexture(key);
    actor.sp.setScale(actor.base.h / actor.sp.height);
  }

  restore(actor) {
    actor.sp.setTexture(actor.idleKey);
    actor.sp.setScale(actor.base.sc);
    actor.sp.x = actor.base.x; actor.sp.y = actor.base.y; actor.sp.angle = 0;
    actor.sp.clearTint();
  }

  flash(actor, color = 0xffffff, ms = 70) {
    actor.sp.setTintFill(color);
    this.time.delayedCall(ms, () => actor.sp.clearTint());
  }

  dmgText(x, y, n, crit) {
    const t = this.add.text(x, y, crit ? `${n}!` : `${n}`, {
      fontFamily: 'Cinzel', fontStyle: '800', fontSize: crit ? '96px' : '76px',
      color: crit ? '#ff5a3c' : '#f3e2b8', stroke: '#120a07', strokeThickness: 12,
      shadow: { offsetX: 0, offsetY: 6, color: '#000', blur: 8, fill: true, stroke: true },
    }).setOrigin(0.5).setDepth(1100).setScale(0.3);
    this.tweens.chain({ targets: t, tweens: [
      { scale: crit ? 1.35 : 1.15, duration: 120, ease: 'Back.easeOut' },
      { scale: 1, duration: 120 },
      { y: y - 120, alpha: 0, duration: 700, delay: 350, ease: 'Cubic.easeIn' },
    ], onComplete: () => t.destroy() });
  }

  slash(x, y) {
    const s = this.add.image(x, y, 'slashRaw').setBlendMode('ADD').setDepth(1002).setTint(0xfff1d0)
      .setAngle(-25).setScale(0.6, 0.4).setAlpha(1);
    this.tweens.add({ targets: s, scaleX: 1.6, scaleY: 1.1, angle: 10, alpha: 0, duration: 260, ease: 'Cubic.easeOut', onComplete: () => s.destroy() });
  }

  bolt(x0, y0, x1, y1, ms = 260) {
    const g = this.lightning, segs = 9;
    const draw = () => {
      g.clear();
      const pts = [[x0, y0]];
      for (let i = 1; i < segs; i++) {
        const t = i / segs;
        pts.push([x0 + (x1 - x0) * t + rnd(-26, 26), y0 + (y1 - y0) * t + rnd(-34, 34)]);
      }
      pts.push([x1, y1]);
      for (const [w, a, c] of [[26, 0.12, 0x4fd8c8], [12, 0.45, 0x4fd8c8], [4, 1, 0xe9fffb]]) {
        g.lineStyle(w, c, a); g.beginPath(); g.moveTo(...pts[0]); for (const p of pts) g.lineTo(...p); g.strokePath();
      }
    };
    const ev = this.time.addEvent({ delay: 45, loop: true, callback: draw });
    draw();
    return this.wait(ms).then(() => { ev.remove(); g.clear(); });
  }

  impact(target, n, crit, color) {
    const e = target.sp, cx = e.x - 20, cy = e.y - target.base.h * 0.55;
    this.pose(target, 'bruto_hit');
    this.flash(target, 0xffffff, 60);
    this.sparks.setParticleTint(color);
    this.sparks.explode(crit ? 40 : 24, cx, cy);
    this.blood.explode(crit ? 26 : 14, cx, cy);
    this.cameras.main.shake(crit ? 260 : 170, crit ? 0.014 : 0.008);
    this.tweens.add({ targets: e, x: target.base.x + 46, duration: 90, yoyo: true, ease: 'Quad.easeOut' });
    this.dmgText(cx + rnd(-20, 30), cy - 60, n, crit);
    this.state.ehp = Math.max(0, this.state.ehp - n);
    emit('enemyHp', { hp: this.state.ehp, max: ENEMY.hp });
  }

  async heroTurn(h) {
    const a = this.actors[h.id], e = this.enemy;
    emit('turn', { id: h.id, name: h.name });
    await this.focus(a, e, true);
    const crit = Math.random() < 0.25;
    const n = rnd(...h.dmg) * (crit ? 2 : 1);
    a.breath.pause();
    if (h.kind === 'melee') {
      // anticipación → dash → golpe
      await this.tw({ targets: a.sp, x: a.base.x - 26, scaleX: a.base.sc * 0.96, duration: 140, ease: 'Quad.easeOut' });
      this.pose(a, `${h.id}_attack`);
      await this.tw({ targets: a.sp, x: e.base.x - 210, y: a.base.y - 40, duration: 150, ease: 'Expo.easeIn' });
      this.slash(e.sp.x - 30, e.sp.y - ENEMY.h * 0.55);
      await this.hitStop(crit ? 110 : 70);
      this.impact(e, n, crit, [0xffffff, 0xffd27a, 0xe8933a]);
      await this.wait(520);
    } else if (h.kind === 'storm') {
      this.pose(a, `${h.id}_attack`);
      const tipX = a.sp.x + a.sp.displayWidth * 0.42, tipY = a.sp.y - a.base.h * 0.86;
      await this.tw({ targets: a.sp, x: a.base.x + 18, duration: 160, ease: 'Quad.easeOut' });
      if (this.bloom) this.tw({ targets: this.bloom, strength: 1.6, duration: 120, yoyo: true });
      const p = this.bolt(tipX, tipY, e.sp.x - 30, e.sp.y - ENEMY.h * 0.55, 300);
      await this.wait(120);
      await this.hitStop(60);
      this.impact(e, n, crit, [0x4fd8c8, 0xe9fffb]);
      await p; await this.wait(420);
    } else {
      this.pose(a, `${h.id}_attack`);
      await this.tw({ targets: a.sp, x: a.base.x - 16, duration: 90, ease: 'Quad.easeOut' }); // retroceso
      const sx = a.sp.x + a.sp.displayWidth * 0.45, sy = a.sp.y - a.base.h * 0.66;
      const tx = e.sp.x - 30, ty = e.sp.y - ENEMY.h * 0.55;
      const b = this.add.rectangle(sx, sy, 70, 5, 0xfff1d0).setDepth(1002).setBlendMode('ADD')
        .setRotation(Math.atan2(ty - sy, tx - sx));
      await this.tw({ targets: b, x: tx, y: ty, duration: 120, ease: 'Linear' });
      b.destroy();
      await this.hitStop(50);
      this.impact(e, n, crit, [0xffffff, 0xe8933a]);
      await this.wait(480);
    }
    this.restore(e);
    if (this.state.ehp <= 0) { await this.focus(a, e, false); this.restore(a); a.breath.resume(); return this.victory(); }
    await this.focus(a, e, false);
    this.restore(a);
    a.breath.resume();
  }

  async enemyTurn() {
    const e = this.enemy;
    const targets = HEROES.filter((h) => this.state.heroes[h.id] > 0);
    const h = targets[rnd(0, targets.length - 1)];
    const a = this.actors[h.id];
    emit('turn', { id: 'enemy', name: ENEMY.name });
    await this.focus(e, a, true);
    e.breath.pause();
    // anticipación pesada: se encoge y se echa atrás
    await this.tw({ targets: e.sp, x: e.base.x + 40, scaleY: e.base.sc * 0.93, scaleX: e.base.sc * 1.04, angle: 6, duration: 320, ease: 'Quad.easeOut' });
    await this.tw({ targets: e.sp, x: a.base.x + 230, y: e.base.y + 90, scaleY: e.base.sc, scaleX: e.base.sc, angle: -10, duration: 160, ease: 'Expo.easeIn' });
    const n = rnd(...ENEMY.dmg);
    await this.hitStop(90);
    this.flash(a, 0xff3b2a, 110);
    this.cameras.main.shake(300, 0.016);
    this.sparks.setParticleTint([0xffffff, 0xffb070]);
    this.sparks.explode(26, a.sp.x + 40, a.sp.y - a.base.h * 0.6);
    this.blood.explode(16, a.sp.x + 40, a.sp.y - a.base.h * 0.6);
    this.tweens.add({ targets: a.sp, x: a.base.x - 50, angle: -5, duration: 110, yoyo: true, ease: 'Quad.easeOut' });
    this.dmgText(a.sp.x + 30, a.sp.y - a.base.h - 30, n, false);
    this.state.heroes[h.id] = Math.max(0, this.state.heroes[h.id] - n);
    emit('heroHp', { id: h.id, hp: this.state.heroes[h.id], max: h.hp });
    await this.wait(420);
    await this.tw({ targets: e.sp, x: e.base.x, y: e.base.y, angle: 0, duration: 380, ease: 'Cubic.easeInOut' });
    await this.focus(e, a, false);
    this.restore(a);
    e.breath.resume();
  }

  async victory() {
    const e = this.enemy;
    e.breath.pause();
    this.sparks.setParticleTint([0x4fd8c8, 0x9fffee]);
    for (let i = 0; i < 6; i++) { this.sparks.explode(18, e.sp.x + rnd(-120, 120), e.sp.y - rnd(80, 420)); await this.wait(90); }
    await this.tw({ targets: [e.sp, e.sh], alpha: 0, duration: 900, ease: 'Cubic.easeIn' });
    emit('victory');
    await this.wait(2600);
    // reinicio de la demo
    this.state.ehp = ENEMY.hp; this.state.round = 1; this.turn = 0;
    for (const h of HEROES) this.state.heroes[h.id] = h.hp;
    e.sp.alpha = 1; e.sh.alpha = 1; this.restore(e); e.breath.resume();
    emit('reset', { heroes: HEROES, enemy: ENEMY });
  }
}

// ── UI DOM (en el juego real esto es el chrome React) ──
(function ui() {
  const $ = (id) => document.getElementById(id);
  const card = (h) => `
    <div class="hero" id="card-${h.id}">
      <div class="portrait"><div class="face" style="background-image:url(${A}heroes/${h.id}_idle.webp);
        background-size:${h.face.s}%;background-position:${h.face.x}% ${h.face.y}%"></div><div class="ring"></div></div>
      <div class="hname">${h.name}</div><div class="cls">${h.cls}</div>
      <div class="bar"><i class="ghost" id="g-${h.id}" style="width:100%"></i><i class="fill" id="f-${h.id}" style="width:100%"></i></div>
      <div class="hp" id="t-${h.id}">${h.hp} / ${h.hp}</div>
    </div>`;
  let turnT;
  window.addEventListener('kh', ({ detail: d }) => {
    if (d.type === 'init' || d.type === 'reset') {
      // innerHTML seguro: sólo datos constantes de HEROES (sin entrada de usuario)
      $('squad').innerHTML = d.heroes.slice().reverse().map(card).join('');
      $('eFill').style.width = $('eGhost').style.width = '100%';
      $('round').textContent = 'RONDA 1 · DE 8';
      $('banner').classList.remove('on');
    }
    if (d.type === 'turn') {
      document.querySelectorAll('.hero').forEach((c) => c.classList.toggle('active', c.id === `card-${d.id}`));
      $('turn').textContent = d.id === 'enemy' ? 'EL ENEMIGO ATACA' : `TURNO DE ${d.name.toUpperCase()}`;
      $('turn').classList.add('on'); clearTimeout(turnT); turnT = setTimeout(() => $('turn').classList.remove('on'), 1100);
    }
    if (d.type === 'enemyHp') { const p = (100 * d.hp) / d.max + '%'; $('eFill').style.width = p; $('eGhost').style.width = p; }
    if (d.type === 'heroHp') {
      const p = (100 * d.hp) / d.max + '%'; $(`f-${d.id}`).style.width = p; $(`g-${d.id}`).style.width = p;
      $(`t-${d.id}`).textContent = `${d.hp} / ${d.max}`;
      const c = $(`card-${d.id}`); c.classList.remove('hurt'); void c.offsetWidth; c.classList.add('hurt');
      $('hurtFlash').classList.add('on'); setTimeout(() => $('hurtFlash').classList.remove('on'), 60);
    }
    if (d.type === 'round') $('round').textContent = `RONDA ${Math.min(d.round, 8)} · DE 8`;
    if (d.type === 'victory') { $('banner').classList.add('on'); document.querySelectorAll('.hero').forEach((c) => c.classList.remove('active')); }
  });
  const next = () => window.dispatchEvent(new CustomEvent('kh-cmd', { detail: 'next' }));
  $('btnAtk').onclick = next; $('btnSkill').onclick = next;
})();

document.fonts.load('800 76px Cinzel').finally(() => window.game = new Phaser.Game({
  type: Phaser.WEBGL, parent: 'game', backgroundColor: '#000000',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: W, height: H },
  scene: [Combat],
}));
