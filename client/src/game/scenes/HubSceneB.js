// Hub B (design.md §6): escena ilustrada del Bastión en el espacio lógico 824×1720, a resolución de dispositivo.
// Lee buildings/activeStorm/overlayState del store, habla con React solo por EventBridge y no guarda estado de negocio.
import Phaser from 'phaser';
import useGameStore from '../../store/gameStore';
import EventBridge from '../EventBridge';
import DayNightSystem from '../systems/DayNightSystem';
import ParticleSystem from '../systems/ParticleSystem';
import AmbientSystem from '../systems/AmbientSystem';
import { TAP_SLOP_CSS, textResolutionFor } from '../display';
import {
  HUB_W, HUB_H, HUB_DEPTHS, HUB_SLOTS, HUB_TEXTURES, TOKEN_FONT_PX,
  computeHubViewport, selectHubBuildings, stormAmbience, ambienceSignature, isTap, shouldAcceptTap,
  buildSelectionPayload, findFreeTile,
} from '../hub/hubLayout';

const SKY_COVER_BOOST = 1.04; // como el fondo del spike: cover × 1.04 con deriva a × 1.025
const SKY_DRIFT = 1.025;
const AMBIENCE_FADE_MS = 1200;
const CONSTRUCTION_TINT = 0x8a8478;
const FOG_BANKS = 5;

const rnd = (a, b) => Phaser.Math.Between(a, b);

function lerpColor(a, b, t) {
  const ar = (a >> 16) & 255; const ag = (a >> 8) & 255; const ab = a & 255;
  const br = (b >> 16) & 255; const bg = (b >> 8) & 255; const bb = b & 255;
  return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t);
}

export default class HubSceneB extends Phaser.Scene {
  constructor() {
    super({ key: 'HubSceneB' });
  }

  init() {
    this.renderScale = this.registry.get('renderScale') || 1;
    this.missing = new Set();
    this.bldSprites = new Map();
    this.fxOn = AmbientSystem.enabledInSettings();
    this.ambSig = null;
    this.ambState = null;
    this.ambTween = null;
    this.ambEmitters = new Map();
    this.flashTimer = null;
    this.fogBanks = [];
    this.fire = null;
    this.placing = null;
    this.ghost = null;
    this.down = null;
    this.tornDown = false;
  }

  preload() {
    this.load.on('loaderror', (file) => {
      this.missing.add(file.key);
      console.warn('[HubSceneB] textura faltante, se usa placeholder:', file.key);
    });
    for (const { key, url } of HUB_TEXTURES) this.load.image(key, url);
  }

  create() {
    this.makeTextures();
    for (const { key } of HUB_TEXTURES) {
      if (this.hasTex(key)) this.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
    }

    this.createLayers();
    this.applyViewport();
    this.scale.on('resize', this.onResize, this);

    if (this.fxOn && this.cameras.main.postFX) this.cameras.main.postFX.addVignette(0.5, 0.48, 0.92, 0.42);

    const state = useGameStore.getState();
    this.syncBuildings(state.buildings);
    this.applyStorm(state.activeStorm, { instant: true });
    this.unsub = useGameStore.subscribe((s, prev) => {
      if (s.buildings !== prev.buildings) this.syncBuildings(s.buildings);
      if (s.activeStorm !== prev.activeStorm) this.applyStorm(s.activeStorm);
    });

    // Solo interesa el evento time:updated (TopResourceBar); el ciclo día/noche visual no es de esta feature.
    this.dayNight = new DayNightSystem(this);
    this.dayNight.overlay.setVisible(false);

    this.particles = new ParticleSystem(this);
    this.setupInput();
    this.setupBridge();

    this.events.once('shutdown', this.teardown, this);
    this.events.once('destroy', this.teardown, this);
  }

  update(_time, delta) {
    if (this.dayNight) this.dayNight.update(delta);
  }

  // ─── Texturas ───────────────────────────────────────────────

  hasTex(key) {
    return !!key && this.textures.exists(key) && !this.missing.has(key);
  }

  tex(key, fallbackKey = null) {
    return this.hasTex(key) ? key : fallbackKey;
  }

  // Texturas generadas (difusas, fuera de R42/R43), como makeTextures() del spike.
  makeTextures() {
    if (this.textures.exists('hubb_fog')) return;
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    for (let r = 128; r > 0; r -= 2) { g.fillStyle(0xffffff, 0.012); g.fillEllipse(256, 128, r * 4, r * 2); }
    g.generateTexture('hubb_fog', 512, 256); g.clear();
    for (let r = 16; r > 0; r--) { g.fillStyle(0xffffff, (1 - r / 16) ** 2); g.fillCircle(16, 16, r); }
    g.generateTexture('hubb_spark', 32, 32); g.clear();
    g.fillStyle(0xffffff, 1); g.fillEllipse(4, 10, 6, 18);
    g.generateTexture('hubb_ember', 8, 20); g.clear();
    for (let r = 8; r > 0; r--) { g.fillStyle(0xffffff, (1 - r / 8) ** 1.5); g.fillCircle(8, 8, r); }
    g.generateTexture('hubb_mote', 16, 16); g.clear();
    g.fillStyle(0x332f2b, 1); g.fillRect(0, 0, 128, 128);
    g.lineStyle(6, 0xd9a441, 1); g.strokeRect(3, 3, 122, 122);
    g.generateTexture('hubb_placeholder', 128, 128); g.clear();
    for (let y = 0; y < 256; y++) { g.fillStyle(lerpColor(0x2e2a26, 0x8a8070, y / 255), 1); g.fillRect(0, y, 8, 1); }
    g.generateTexture('hubb_sky_fallback', 8, 256);
    g.destroy();
  }

  // ─── Capas fijas ───────────────────────────────────────────

  createLayers() {
    this.skies = {};
    for (const name of ['sky_calm', 'sky_storm']) {
      const img = this.add.image(HUB_W / 2, HUB_H / 2, this.tex(`hubb_${name}`, 'hubb_sky_fallback'))
        .setDepth(HUB_DEPTHS.sky + (name === 'sky_storm' ? 1 : 0)).setAlpha(0);
      const sc = Math.max(HUB_W / img.width, HUB_H / img.height) * SKY_COVER_BOOST;
      img.setScale(sc);
      img.setData('baseScale', sc);
      this.skies[name] = img;
    }
    // Deriva lenta de nubes (spike: cover × 1.04 → × 1.025 y 8 px a la izquierda, yoyo 9 s). Un contador común
    // mantiene la escala base de cada cielo (el fallback generado tiene otra).
    this.skyDrift = this.tweens.addCounter({
      from: 0, to: 1, duration: 9000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      onUpdate: (tw) => {
        const k = tw.getValue();
        for (const img of Object.values(this.skies)) {
          img.setScale(img.getData('baseScale') * (1 + (SKY_DRIFT - 1) * k)).setX(HUB_W / 2 - 8 * k);
        }
      },
    });

    const base = this.tex('hubb_base');
    if (base) {
      const img = this.add.image(HUB_W / 2, HUB_H, base).setOrigin(0.5, 1).setDepth(HUB_DEPTHS.base);
      img.setScale(HUB_W / img.width);
    }
    const fg = this.tex('hubb_fg');
    if (fg) {
      const img = this.add.image(HUB_W / 2, HUB_H, fg).setOrigin(0.5, 1).setDepth(HUB_DEPTHS.fg);
      img.setScale(HUB_W / img.width);
    }

    // Gradación y destello cubren el espacio lógico con margen (la cámara es fija y siempre queda dentro).
    this.grade = this.add.rectangle(HUB_W / 2, HUB_H / 2, HUB_W * 1.5, HUB_H * 1.5, 0x000000, 0)
      .setDepth(HUB_DEPTHS.grade);
    this.flashRect = this.add.rectangle(HUB_W / 2, HUB_H / 2, HUB_W * 1.5, HUB_H * 1.5, 0xffffff, 1)
      .setDepth(HUB_DEPTHS.flash).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setVisible(false);
  }

  applyViewport() {
    const cam = this.cameras.main;
    const { zoom } = computeHubViewport(this.scale.width, this.scale.height);
    cam.setSize(this.scale.width, this.scale.height);
    cam.setZoom(zoom);
    cam.centerOn(HUB_W / 2, HUB_H / 2);
  }

  onResize() {
    this.renderScale = this.registry.get('renderScale') || 1;
    this.applyViewport();
  }

  // ─── Edificios ─────────────────────────────────────────────

  syncBuildings(buildings) {
    const list = selectHubBuildings(buildings);
    const seen = new Set();
    for (const item of list) {
      seen.add(item.buildingId);
      let entry = this.bldSprites.get(item.buildingId);
      if (!entry) {
        entry = { sprite: this.createBuildingSprite(item.buildingId), worker: null, smoke: null, state: null };
        this.bldSprites.set(item.buildingId, entry);
      }
      entry.record = item.record;
      entry.sprite.setData('record', item.record);
      if (entry.state !== item.state) {
        entry.state = item.state;
        if (item.state === 'construction') {
          entry.sprite.setTint(CONSTRUCTION_TINT).setAlpha(0.75);
          this.destroyWorker(entry);
          this.destroySmoke(entry);
        } else {
          entry.sprite.clearTint().setAlpha(1);
          if (item.worker) this.createWorker(entry, item.slot, item.worker);
          if (item.slot.smoke) this.createSmoke(entry, item.slot);
        }
      }
    }
    for (const [id, entry] of this.bldSprites) {
      if (seen.has(id)) continue;
      this.destroyWorker(entry);
      this.destroySmoke(entry);
      entry.sprite.destroy();
      this.bldSprites.delete(id);
    }
    this.syncFire();
  }

  createBuildingSprite(buildingId) {
    const slot = HUB_SLOTS[buildingId];
    const sprite = this.add.image(slot.x, slot.y, this.tex(`hubb_bld_${buildingId}`, 'hubb_placeholder'))
      .setOrigin(0.5, 1).setDepth(HUB_DEPTHS.buildings + slot.y);
    const sc = Math.min(slot.w / sprite.width, slot.h / sprite.height);
    sprite.setScale(sc);
    sprite.setData('baseScale', sc);
    sprite.setData('buildingId', buildingId);
    sprite.setInteractive({ pixelPerfect: true, alphaTolerance: 8 });
    return sprite;
  }

  // Trabajador: alternancia de 2 poses normalizadas por alto + respiración (técnica del spike, design.md §5.2).
  createWorker(entry, slot, cfg) {
    if (entry.worker) return;
    const poses = ['a', 'b'].map((p) => this.tex(`hubb_wk_${cfg.kind}_${p}`)).filter(Boolean);
    if (!poses.length) return;
    const sp = this.add.image(slot.x + cfg.dx, slot.y + cfg.dy, poses[0]).setOrigin(0.5, 1)
      .setDepth(HUB_DEPTHS.buildings + slot.y + 1)
      .setFlipX(cfg.dx > 0); // el arte mira a la derecha: los que quedan a la derecha del edificio miran hacia él
    const w = { sp, h: cfg.h, poses, idx: 0, sc: 0, breath: null, timer: null };
    this.setWorkerPose(w, 0);
    if (poses.length > 1) {
      w.timer = this.time.addEvent({
        delay: cfg.periodMs, loop: true, startAt: rnd(0, cfg.periodMs - 1),
        callback: () => this.setWorkerPose(w, (w.idx + 1) % w.poses.length),
      });
    }
    entry.worker = w;
  }

  // Cada pose tiene otro recorte → se normaliza por alto (spike pose()); la respiración se rearma si cambia la escala.
  setWorkerPose(w, idx) {
    w.idx = idx;
    w.sp.setTexture(w.poses[idx]);
    const sc = w.h / w.sp.frame.realHeight;
    if (w.breath && Math.abs(sc - w.sc) < 1e-6) return;
    w.sc = sc;
    if (w.breath) w.breath.remove();
    w.sp.setScale(sc);
    w.breath = this.tweens.add({
      targets: w.sp, scaleY: sc * 1.014, scaleX: sc * 0.996, duration: rnd(1300, 1700),
      yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: rnd(0, 800),
    });
  }

  destroyWorker(entry) {
    const w = entry.worker;
    if (!w) return;
    if (w.timer) w.timer.remove();
    if (w.breath) w.breath.remove();
    w.sp.destroy();
    entry.worker = null;
  }

  createSmoke(entry, slot) {
    if (entry.smoke || !this.fxOn) return;
    entry.smoke = this.add.particles(slot.x + slot.smoke.dx, slot.y + slot.smoke.dy, 'hubb_fog', {
      lifespan: { min: 2600, max: 3600 }, speedY: { min: -45, max: -25 }, speedX: { min: 4, max: 16 },
      scale: { start: 0.07, end: 0.32 }, alpha: { start: 0.5, end: 0 }, tint: [0x8e897e, 0x6b665e],
      frequency: 320, maxAliveParticles: 12,
    }).setDepth(HUB_DEPTHS.buildings + slot.y + 2);
  }

  destroySmoke(entry) {
    if (!entry.smoke) return;
    entry.smoke.destroy();
    entry.smoke = null;
  }

  // Fuego Votivo en el brasero de la Torre del Señor: PointLight con parpadeo Stepped + chispas (solo con FX).
  syncFire() {
    const throne = this.bldSprites.get('throne_room');
    const want = this.fxOn && throne && throne.state === 'built' && HUB_SLOTS.throne_room.fire;
    if (!want) {
      if (this.fire) {
        this.fire.flicker.remove();
        this.fire.light.destroy();
        this.fire.sparks.destroy();
        this.fire = null;
      }
      return;
    }
    if (this.fire) return;
    const slot = HUB_SLOTS.throne_room;
    const x = slot.x + slot.fire.dx;
    const y = slot.y + slot.fire.dy;
    const depth = HUB_DEPTHS.buildings + slot.y + 2;
    const light = this.add.pointlight(x, y, 0xe8933a, 110, 0.22, 0.06).setDepth(depth);
    const flicker = this.tweens.add({
      targets: light, intensity: 0.13, radius: 100, duration: rnd(90, 160), yoyo: true, repeat: -1,
      repeatDelay: rnd(20, 120), ease: 'Stepped',
    });
    const sparks = this.add.particles(x, y, 'hubb_spark', {
      x: { min: -10, max: 10 }, lifespan: { min: 600, max: 1100 }, speedY: { min: -90, max: -40 },
      speedX: { min: -15, max: 15 }, scale: { start: 0.35, end: 0 }, alpha: { start: 0.9, end: 0 },
      tint: [0xe8933a, 0xffb050], blendMode: 'ADD', frequency: 90, maxAliveParticles: 15,
    }).setDepth(depth);
    this.fire = { light, flicker, sparks };
  }

  // ─── Tormenta (design.md §5.3, §6.5) ───────────────────────

  applyStorm(storm, { instant = false } = {}) {
    const amb = stormAmbience(storm);
    const sig = `${ambienceSignature(amb)}|${amb.grade ? `${amb.grade.color}/${amb.grade.alpha}` : '-'}`;
    if (sig === this.ambSig) return;
    this.ambSig = sig;

    const from = this.ambState || { calm: 0, storm: 0, tint: 0xffffff, gradeColor: 0x000000, gradeAlpha: 0 };
    const to = {
      calm: amb.sky === 'sky_calm' ? 1 : 0,
      storm: amb.sky === 'sky_storm' ? 1 : 0,
      tint: amb.skyTint ?? 0xffffff,
      gradeColor: amb.grade ? amb.grade.color : from.gradeColor,
      gradeAlpha: amb.grade ? amb.grade.alpha : 0,
    };
    // Si no había gradación, el color destino entra directo (solo se funde el alpha).
    const fromGradeColor = from.gradeAlpha > 0 ? from.gradeColor : to.gradeColor;
    const set = (t) => {
      const cur = {
        calm: from.calm + (to.calm - from.calm) * t,
        storm: from.storm + (to.storm - from.storm) * t,
        tint: lerpColor(from.tint, to.tint, t),
        gradeColor: lerpColor(fromGradeColor, to.gradeColor, t),
        gradeAlpha: from.gradeAlpha + (to.gradeAlpha - from.gradeAlpha) * t,
      };
      this.skies.sky_calm.setAlpha(cur.calm).setTint(cur.tint);
      this.skies.sky_storm.setAlpha(cur.storm).setTint(cur.tint);
      this.grade.setFillStyle(cur.gradeColor, cur.gradeAlpha);
      this.ambState = cur;
    };
    if (this.ambTween) this.ambTween.remove();
    this.ambTween = null;
    if (instant) set(1);
    else {
      this.ambTween = this.tweens.addCounter({
        from: 0, to: 1, duration: AMBIENCE_FADE_MS, ease: 'Sine.easeInOut',
        onUpdate: (tw) => set(tw.getValue()),
        onComplete: () => set(1),
      });
    }

    if (amb.cloudDrift) this.skyDrift.resume();
    else this.skyDrift.pause();

    // Sin FX (kh_ambient_fx = false, R38): solo cielo, tinte y gradación.
    if (!this.fxOn) return;
    this.setFog(amb.fog, instant);
    this.setAmbientParticles(amb);
    this.setFlash(amb.flash);
  }

  setFog(fog, instant) {
    if (fog && !this.fogBanks.length) {
      for (let k = 0; k < FOG_BANKS; k++) {
        const f = this.add.image(rnd(0, HUB_W), rnd(780, 1360), 'hubb_fog').setScale(2.2, 1.4).setAlpha(0)
          .setTint(0x9a8aa6).setDepth(HUB_DEPTHS.fog);
        this.tweens.add({
          targets: f, x: f.x + (k % 2 ? 260 : -260), duration: rnd(16000, 22000), yoyo: true, repeat: -1,
          ease: 'Sine.easeInOut',
        });
        this.fogBanks.push(f);
      }
    }
    const alpha = fog ? fog.alpha : 0;
    for (const f of this.fogBanks) {
      this.tweens.killTweensOf(f, ['alpha']);
      if (instant) f.setAlpha(alpha);
      else this.tweens.add({ targets: f, alpha, duration: AMBIENCE_FADE_MS, ease: 'Sine.easeInOut' });
    }
  }

  // Un emisor por estilo, creado una vez y prendido/apagado (sin basura); ≤ 1 activo.
  setAmbientParticles(amb) {
    for (const em of this.ambEmitters.values()) em.emitting = false;
    if (amb.particles === 'none') return;
    const key = `${amb.particles}|${amb.particleColors.join(',')}`;
    let em = this.ambEmitters.get(key);
    if (!em) {
      const tint = amb.particleColors.length ? amb.particleColors : [0xe8933a];
      em = amb.particles === 'embers_fall'
        ? this.add.particles(0, 0, 'hubb_ember', {
          x: { min: -120, max: HUB_W + 60 }, y: { min: 120, max: 260 }, lifespan: { min: 4500, max: 6500 },
          speedY: { min: 120, max: 210 }, speedX: { min: 40, max: 90 }, rotate: { min: -40, max: -20 },
          scale: { start: 0.9, end: 0.3 }, alpha: { start: 0.9, end: 0 }, tint, blendMode: 'ADD',
          frequency: 90, maxAliveParticles: 80,
        })
        : this.add.particles(0, 0, 'hubb_mote', {
          x: { min: 40, max: HUB_W - 40 }, y: { min: 900, max: 1400 }, lifespan: { min: 4000, max: 6000 },
          speedY: { min: -60, max: -25 }, speedX: { min: -12, max: 12 }, scale: { start: 0.6, end: 1.4 },
          alpha: { start: 0.85, end: 0 }, tint, blendMode: 'ADD', frequency: 120, maxAliveParticles: 60,
        });
      em.setDepth(HUB_DEPTHS.particles);
      this.ambEmitters.set(key, em);
    }
    em.emitting = true;
  }

  setFlash(flash) {
    if (this.flashTimer) this.flashTimer.remove();
    this.flashTimer = null;
    if (!flash) return;
    const schedule = () => {
      this.flashTimer = this.time.delayedCall(rnd(flash.everyMs[0], flash.everyMs[1]), () => {
        this.flashRect.setFillStyle(flash.color, 1).setVisible(true).setAlpha(0);
        this.tweens.add({
          targets: this.flashRect, alpha: 0.35, duration: 110, yoyo: true, ease: 'Quad.easeOut',
          onComplete: () => this.flashRect.setVisible(false),
        });
        schedule();
      });
    };
    schedule();
  }

  // ─── Input (design.md §6.3) ────────────────────────────────

  setupInput() {
    // pointer.x/y llegan en px de dispositivo (displayScale = s): el slop del tap se escala con renderScale.
    this.input.on('pointerdown', (pointer) => {
      this.down = { x: pointer.x, y: pointer.y, t: this.time.now };
    });
    this.input.on('pointerup', (pointer, over) => {
      const down = this.down;
      this.down = null;
      const up = { x: pointer.x, y: pointer.y, t: this.time.now };
      if (!isTap(down, up, TAP_SLOP_CSS * this.renderScale)) return;
      if (!shouldAcceptTap(useGameStore.getState().overlayState)) return;
      const target = (over || []).find((o) => o.getData && o.getData('buildingId'));
      if (target) {
        const base = target.getData('baseScale');
        this.tweens.killTweensOf(target);
        target.setScale(base);
        this.tweens.add({ targets: target, scale: base * 1.04, duration: 120, yoyo: true, ease: 'Quad.easeOut' });
        EventBridge.emit('entity:selected', buildSelectionPayload(target.getData('record')));
      } else {
        EventBridge.emit('entity:deselected');
      }
    });
  }

  // ─── EventBridge ───────────────────────────────────────────

  setupBridge() {
    // building:addToScene no hace falta (buildNew → loadBuildings → suscripción) y camera:centerOnCastle es un
    // no-op con cámara fija: no se escuchan a propósito.
    this.bridge = {
      'token:earned': (payload) => {
        const amount = Number(payload && payload.amount);
        if (!(amount > 0)) return;
        const cam = this.cameras.main;
        const view = cam.worldView;
        this.particles.emitTokenGain(HUB_W / 2, view.y + view.height / 3, amount, {
          fontSize: TOKEN_FONT_PX, resolution: textResolutionFor(cam.zoom), depth: HUB_DEPTHS.particles,
        });
      },
      'building:startPlacement': (payload) => this.startPlacement(payload && payload.buildingId),
      'building:confirmPlacement': () => this.confirmPlacement(),
      'building:cancelPlacement': () => this.endPlacement(),
    };
    for (const [evt, fn] of Object.entries(this.bridge)) EventBridge.on(evt, fn);
  }

  // ─── Construcción (design.md §6.4) ─────────────────────────

  startPlacement(buildingId) {
    const slot = buildingId && HUB_SLOTS[buildingId];
    if (!slot) return;
    this.clearGhost();
    this.placing = buildingId;
    const ghost = this.add.image(slot.x, slot.y, this.tex(`hubb_bld_${buildingId}`, 'hubb_placeholder'))
      .setOrigin(0.5, 1).setDepth(HUB_DEPTHS.fog - 1).setAlpha(0.5);
    ghost.setScale(Math.min(slot.w / ghost.width, slot.h / ghost.height));
    this.tweens.add({ targets: ghost, alpha: 0.3, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.ghost = ghost;
    EventBridge.emit('placement:started', { buildingId });
  }

  confirmPlacement() {
    if (!this.placing) return;
    const buildingId = this.placing;
    const pos = findFreeTile(useGameStore.getState().buildings, buildingId);
    if (pos) EventBridge.emit('building:placed', { buildingId, ...pos });
    else EventBridge.emit('game:notification', { text: 'No queda lugar en el Bastión para esa obra', type: 'error' });
    this.endPlacement();
  }

  endPlacement() {
    const wasPlacing = !!this.placing || !!this.ghost;
    this.clearGhost();
    this.placing = null;
    if (wasPlacing) EventBridge.emit('placement:ended');
  }

  clearGhost() {
    if (!this.ghost) return;
    this.tweens.killTweensOf(this.ghost);
    this.ghost.destroy();
    this.ghost = null;
  }

  // ─── Cierre: solo los handlers propios (nunca removeAllListeners, que borraría los de React) ───

  teardown() {
    if (this.tornDown) return;
    this.tornDown = true;
    if (this.unsub) this.unsub();
    this.unsub = null;
    if (this.bridge) for (const [evt, fn] of Object.entries(this.bridge)) EventBridge.off(evt, fn);
    this.bridge = null;
    this.scale.off('resize', this.onResize, this);
    if (this.dayNight) this.dayNight.destroy();
    this.dayNight = null;
    if (this.particles) this.particles.destroy();
    this.particles = null;
  }
}
