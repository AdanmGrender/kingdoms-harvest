/**
 * AudioEngine — Motor de audio 100% PROCEDURAL (Web Audio API) para Kingdoms
 * Harvest. Cero archivos de audio: todo se SINTETIZA en el navegador con
 * osciladores, ruido, envolventes, filtros y una reverb por convolución cuyo
 * impulse response también se genera en código. Esto encaja con un juego que
 * cobra dinero real: no hay problema de licencias/IP porque no existe ningún
 * sample de terceros.
 *
 * Ambientación (ver docs/lore.md, docs/art-style.md): GRIMDARK industrial-gótico.
 * El Bastión Cadmion asediado bajo un cielo de tormenta perpetua. El sonido debe
 * evocar: drones graves y disonancia contenida (opresión), texturas metálicas,
 * viento/estática de fondo (el "Velo" que se filtra) y destellos teal escasos
 * para la "magia del Velo" (el teal holograma es el color mágico del juego).
 * NADA alegre ni caricaturesco.
 *
 * Diseño:
 *  - AudioContext PEREZOSO: se crea/reanuda en el PRIMER gesto del usuario
 *    (política de autoplay). Antes de eso NADA suena (correcto).
 *  - Un único AudioContext. Nodos reusados. SFX bajo demanda con auto-limpieza.
 *  - LECHO AMBIENTE continuo (pocos nodos) que evoluciona solo con LFOs lentos y
 *    reacciona al ciclo día/noche y a las Tormentas Disformes.
 *  - DEFENSIVO: si no hay Web Audio (SSR / tests / navegador viejo) el motor es
 *    un no-op silencioso — nunca rompe el arranque de la app.
 *
 * API pública: init(), teardown(), setMuted(bool), setVolume(0..1),
 *              playSfx(name), wireEvents(), unwire().
 */
import EventBridge from '../game/EventBridge';

// Constructor de AudioContext protegido: en SSR/tests `window` no existe, y en
// navegadores viejos puede venir prefijado. Si no hay ninguno, el motor es no-op.
const AC =
  typeof window !== 'undefined'
    ? window.AudioContext || window.webkitAudioContext || null
    : null;

const LS_MUTED = 'kh_audio_muted';
const LS_VOLUME = 'kh_audio_volume';
const DEFAULT_VOLUME = 0.7; // el master arranca moderado; el ambiente es tenue

// Frecuencia raíz del drone: G1 ≈ 49 Hz. Muy grave = peso/opresión del asedio.
const ROOT = 49;
const MAX_VOICES = 16; // techo de voces SFX simultáneas (anti-saturación/clipping)

// Utilidad localStorage a prueba de modo privado / SSR.
function lsGet(key, fallback) {
  try {
    if (typeof localStorage === 'undefined') return fallback;
    const v = localStorage.getItem(key);
    return v === null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
}
function lsSet(key, value) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(value));
    }
  } catch {
    /* modo privado: ignorar */
  }
}

const clamp01 = (n) => Math.max(0, Math.min(1, Number(n) || 0));

class AudioEngine {
  constructor() {
    this.supported = !!AC;
    this.ctx = null;

    // Estado persistido: el usuario pudo silenciar en una sesión anterior.
    this.muted = !!lsGet(LS_MUTED, false);
    this.volume = clamp01(lsGet(LS_VOLUME, DEFAULT_VOLUME));

    // Nodos maestros (se crean con el ctx).
    this.master = null;
    this.reverbSend = null; // bus de envío a la reverb
    this.reverbReturn = null;
    this.convolver = null;
    this.ambientBus = null;

    // Nodos del lecho ambiente (continuos).
    this._ambient = null;
    this._ambientStarted = false;

    // Buffers reusados (ruido / impulse response de reverb).
    this._noiseBuffer = null;

    // Estado ambiental reactivo.
    this._period = 'morning';
    this._storm = false;

    // Anti-spam SFX.
    this._voiceCount = 0;
    this._lastSfxAt = Object.create(null);

    // Flags de ciclo de vida.
    this._initialized = false;
    this._wired = false;
    this._unlockHandler = null;
    this._unlockEvents = ['pointerdown', 'touchstart', 'mousedown', 'keydown'];
    this._bridgeHandlers = null;

    // Ligamos this en el handler que resuelve el AudioContext.
    this._suspendTimer = null;
  }

  // ── Ciclo de vida ────────────────────────────────────────────────────────

  /**
   * Arranca el motor: registra el desbloqueo por gesto y engancha EventBridge.
   * Idempotente (React StrictMode invoca el efecto dos veces en dev).
   */
  init() {
    if (!this.supported || this._initialized) return;
    this._initialized = true;

    // Mango DEV para tooling/tests (Vite lo elimina en el build de producción,
    // igual que window.__gameStore / window.__phaserGame). Permite auscultar el
    // motor desde Playwright: no se puede verificar el sonido "de oído" en CI,
    // pero sí que el AudioContext despierte y que los SFX no lancen.
    if (import.meta.env.DEV) window.__audio = this;

    // La política de autoplay obliga a esperar un gesto real del usuario antes
    // de sonar. Escuchamos varios tipos de gesto UNA vez.
    this._unlockHandler = () => this._unlock();
    for (const ev of this._unlockEvents) {
      try {
        window.addEventListener(ev, this._unlockHandler, {
          once: true,
          passive: true,
        });
      } catch {
        /* noop */
      }
    }

    this.wireEvents();
  }

  /**
   * Desmonte: quita listeners de EventBridge y de desbloqueo. NO cierra el grafo
   * de audio (el motor es singleton; el ambiente sobrevive a un remount de App).
   */
  teardown() {
    if (!this._initialized) return;
    this._initialized = false;
    this.unwire();
    if (this._unlockHandler) {
      for (const ev of this._unlockEvents) {
        try {
          window.removeEventListener(ev, this._unlockHandler);
        } catch {
          /* noop */
        }
      }
      this._unlockHandler = null;
    }
  }

  /** Crea el AudioContext y el grafo en el primer gesto; reanuda si hace falta. */
  _unlock() {
    if (!this.supported) return;
    try {
      if (!this.ctx) this._buildGraph();
      if (!this.ctx) return;

      // Reanudar sólo si NO está silenciado (el gesto autoriza el resume).
      if (!this.muted && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      this._startAmbient();
      this._applyMasterGain(false);
    } catch {
      /* si el audio falla, el juego sigue mudo pero funcional */
    }
  }

  _buildGraph() {
    try {
      this.ctx = new AC();
    } catch {
      this.ctx = null;
      this.supported = false;
      return;
    }
    const ctx = this.ctx;

    // Master: puerta de volumen/mute de todo el motor.
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.volume;
    this.master.connect(ctx.destination);

    // Reverb por convolución: da "sala de piedra" a los sonidos mágicos/alertas
    // y aire al ambiente. El IR es ruido con caída exponencial (cola oscura).
    this.convolver = ctx.createConvolver();
    this.convolver.buffer = this._makeReverbIR(2.4, 3.2);
    this.reverbSend = ctx.createGain(); // suma de envíos → reverb
    this.reverbSend.gain.value = 1.0;
    this.reverbReturn = ctx.createGain(); // nivel del retorno húmedo
    this.reverbReturn.gain.value = 0.32;
    this.reverbSend.connect(this.convolver);
    this.convolver.connect(this.reverbReturn);
    this.reverbReturn.connect(this.master);

    // Bus del ambiente (para poder mandar todo el lecho a la reverb de una).
    this.ambientBus = ctx.createGain();
    this.ambientBus.gain.value = 1.0;
    this.ambientBus.connect(this.master);
    this.ambientBus.connect(this.reverbSend);
  }

  // ── Estado de mute / volumen ──────────────────────────────────────────────

  setMuted(muted) {
    this.muted = !!muted;
    lsSet(LS_MUTED, this.muted);
    if (!this.ctx) return; // aún sin gesto: sólo persistimos el estado

    if (this.muted) {
      this._applyMasterGain(true); // rampa a 0 (sin clicks)
      // Suspender tras la rampa ahorra batería/CPU (el lecho deja de correr).
      clearTimeout(this._suspendTimer);
      this._suspendTimer = setTimeout(() => {
        if (this.muted && this.ctx && this.ctx.state === 'running') {
          this.ctx.suspend().catch(() => {});
        }
      }, 450);
    } else {
      clearTimeout(this._suspendTimer);
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      this._startAmbient();
      this._applyMasterGain(false);
    }
  }

  setVolume(v) {
    this.volume = clamp01(v);
    lsSet(LS_VOLUME, this.volume);
    if (this.ctx && !this.muted) this._applyMasterGain(false);
  }

  /** Rampa suave del master (evita clicks al cambiar volumen/mute). */
  _applyMasterGain(toZero) {
    if (!this.master || !this.ctx) return;
    const t = this.ctx.currentTime;
    const target = toZero ? 0.0001 : Math.max(0.0001, this.volume);
    try {
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setValueAtTime(Math.max(0.0001, this.master.gain.value), t);
      this.master.gain.linearRampToValueAtTime(target, t + 0.18);
    } catch {
      this.master.gain.value = toZero ? 0 : this.volume;
    }
  }

  // ── Buffers procedurales ──────────────────────────────────────────────────

  /** Impulse response de reverb: ruido con caída exponencial = cola oscura. */
  _makeReverbIR(seconds, decay) {
    const ctx = this.ctx;
    const rate = ctx.sampleRate;
    const len = Math.max(1, Math.floor(rate * seconds));
    const buf = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        // Ruido blanco * envolvente decreciente. La cola larga y sin brillo
        // evoca un interior de piedra/fundición enorme y vacío.
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }

  /** Buffer de ruido blanco reusable (viento/estática y crujidos de SFX). */
  _noise() {
    if (this._noiseBuffer) return this._noiseBuffer;
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * 2);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this._noiseBuffer = buf;
    return buf;
  }

  // ── LECHO AMBIENTE ────────────────────────────────────────────────────────

  /**
   * Construye e inicia el lecho ambiente continuo (una sola vez). Estructura:
   *  - 3 osciladores graves (root + root detuneado + quinta) → lowpass con LFO
   *    lento: drone evolvente, base de la opresión.
   *  - 1 oscilador disonante (segunda menor sobre la raíz) normalmente en
   *    silencio: la TORMENTA lo abre → tensión/pavor "contenido" que aflora.
   *  - 1 sub (32 Hz) también en silencio: retumbo de tormenta.
   *  - Lecho de ruido filtrado (viento/estática del Velo) con LFO de ráfagas.
   */
  _startAmbient() {
    if (!this.ctx || this._ambientStarted) return;
    this._ambientStarted = true;
    const ctx = this.ctx;
    const t = ctx.currentTime;

    // Filtro común del drone (lowpass): tapa los armónicos → sonido sordo,
    // subterráneo. Un LFO lento mueve el corte para que "respire".
    const droneFilter = ctx.createBiquadFilter();
    droneFilter.type = 'lowpass';
    droneFilter.frequency.value = 320;
    droneFilter.Q.value = 0.7;
    droneFilter.connect(this.ambientBus);

    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.075; // el ambiente es FONDO: volumen bajo
    droneGain.connect(droneFilter);

    // Osciladores del drone.
    const osc1 = ctx.createOscillator(); // raíz, triángulo = cuerpo redondo
    osc1.type = 'triangle';
    osc1.frequency.value = ROOT;
    const g1 = ctx.createGain();
    g1.gain.value = 0.6;
    osc1.connect(g1).connect(droneGain);

    const osc2 = ctx.createOscillator(); // raíz detuneada, sierra = aspereza metálica
    osc2.type = 'sawtooth';
    osc2.frequency.value = ROOT;
    osc2.detune.value = -9; // batido lento contra osc1 → textura viva, inquieta
    const g2 = ctx.createGain();
    g2.gain.value = 0.28;
    osc2.connect(g2).connect(droneGain);

    const osc3 = ctx.createOscillator(); // quinta: da algo de consonancia (no papilla)
    osc3.type = 'triangle';
    osc3.frequency.value = ROOT * 1.5;
    const g3 = ctx.createGain();
    g3.gain.value = 0.22;
    osc3.connect(g3).connect(droneGain);

    // Oscilador disonante (segunda menor ≈ ×1.0595): choca con la raíz y produce
    // un batido de ~3 Hz. En calma casi mudo; la tormenta lo despierta.
    const oscDiss = ctx.createOscillator();
    oscDiss.type = 'triangle';
    oscDiss.frequency.value = ROOT * 1.0595;
    const dissGain = ctx.createGain();
    dissGain.gain.value = 0.0001;
    oscDiss.connect(dissGain).connect(droneFilter);

    // Sub-retumbo (sólo tormenta): peso físico bajo el resto.
    const oscSub = ctx.createOscillator();
    oscSub.type = 'sine';
    oscSub.frequency.value = 32;
    const subGain = ctx.createGain();
    subGain.gain.value = 0.0001;
    oscSub.connect(subGain).connect(this.ambientBus);

    // Lecho de ruido = viento/estática del Velo. Lowpass para que sea "aire"
    // grave, no siseo agudo molesto.
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = this._noise();
    noiseSrc.loop = true;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.value = 700;
    noiseFilter.Q.value = 0.5;
    const noiseLFOGain = ctx.createGain(); // modulado por LFO → ráfagas de viento
    noiseLFOGain.gain.value = 0.7;
    const noiseGain = ctx.createGain(); // nivel del ruido (lo mueve día/noche/tormenta)
    noiseGain.gain.value = 0.04;
    noiseSrc.connect(noiseFilter).connect(noiseLFOGain).connect(noiseGain);
    noiseGain.connect(this.ambientBus);

    // LFOs (osciladores lentísimos que animan parámetros; sin ellos el lecho
    // sería estático y molesto).
    const lfoCut = ctx.createOscillator(); // mueve el corte del drone
    lfoCut.type = 'sine';
    lfoCut.frequency.value = 0.06;
    const lfoCutGain = ctx.createGain();
    lfoCutGain.gain.value = 120; // ±120 Hz alrededor del corte base
    lfoCut.connect(lfoCutGain).connect(droneFilter.frequency);

    const lfoGust = ctx.createOscillator(); // ráfagas del viento
    lfoGust.type = 'sine';
    lfoGust.frequency.value = 0.08;
    const lfoGustGain = ctx.createGain();
    lfoGustGain.gain.value = 0.35;
    lfoGust.connect(lfoGustGain).connect(noiseLFOGain.gain);

    const lfoDetune = ctx.createOscillator(); // detune vivo en la sierra
    lfoDetune.type = 'sine';
    lfoDetune.frequency.value = 0.05;
    const lfoDetuneGain = ctx.createGain();
    lfoDetuneGain.gain.value = 6;
    lfoDetune.connect(lfoDetuneGain).connect(osc2.detune);

    // Arrancar todo.
    for (const o of [osc1, osc2, osc3, oscDiss, oscSub, lfoCut, lfoGust, lfoDetune]) {
      try {
        o.start(t);
      } catch {
        /* noop */
      }
    }

    this._ambient = {
      droneFilter,
      droneGain,
      dissGain,
      subGain,
      noiseGain,
      noiseFilter,
    };

    // Aplicar el perfil día/noche + tormenta actual.
    this._applyAmbientProfile();
  }

  /**
   * Ajusta el lecho según el momento del día y si hay tormenta. Todo con rampas
   * suaves (setTargetAtTime) para que nada haga clic.
   *  - Noche/atardecer: más grave, más oscuro, menos aire (opresión).
   *  - Mediodía/mañana: un poco más de aire y menos peso (respiro tenue).
   *  - Tormenta: sube disonancia + sub-retumbo + estática, y abre el corte
   *    (sonido más áspero e inquietante).
   */
  _applyAmbientProfile() {
    if (!this._ambient || !this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const tau = 2.5; // constante de tiempo: transiciones lentas, ambientales

    // Perfiles por periodo del día (corte del drone, nivel del drone, ruido).
    const profiles = {
      dawn: { cutoff: 300, drone: 0.08, noise: 0.035 },
      morning: { cutoff: 360, drone: 0.072, noise: 0.045 },
      midday: { cutoff: 420, drone: 0.066, noise: 0.05 }, // más aire, menos peso
      evening: { cutoff: 250, drone: 0.088, noise: 0.03 },
      night: { cutoff: 185, drone: 0.10, noise: 0.022 }, // grave, oscuro, callado
    };
    const p = profiles[this._period] || profiles.morning;

    const a = this._ambient;
    const set = (param, value) => {
      try {
        param.setTargetAtTime(value, t, tau);
      } catch {
        param.value = value;
      }
    };

    if (this._storm) {
      // La tormenta corrompe el ambiente: corte más abierto (áspero), drone más
      // fuerte, estática arriba, y despiertan disonancia y sub-retumbo.
      set(a.droneFilter.frequency, p.cutoff + 140);
      set(a.droneGain.gain, p.drone + 0.02);
      set(a.noiseGain.gain, p.noise + 0.05);
      set(a.dissGain.gain, 0.05);
      set(a.subGain.gain, 0.13);
    } else {
      set(a.droneFilter.frequency, p.cutoff);
      set(a.droneGain.gain, p.drone);
      set(a.noiseGain.gain, p.noise);
      set(a.dissGain.gain, 0.0001); // disonancia se retira en calma
      set(a.subGain.gain, 0.0001);
    }
  }

  setPeriod(period) {
    if (typeof period !== 'string') return;
    this._period = period;
    this._applyAmbientProfile();
  }

  setStorm(active) {
    this._storm = !!active;
    this._applyAmbientProfile();
  }

  // ── SFX (síntesis bajo demanda con auto-limpieza) ─────────────────────────

  /**
   * Dispara un SFX por nombre. Aplica anti-spam (throttle por nombre + techo de
   * voces) para que ráfagas (p.ej. token:earned) no saturen ni cuelguen voces.
   */
  playSfx(name, opts = {}) {
    if (!this.supported || !this.ctx || this.muted) return;
    if (this.ctx.state === 'suspended') return; // sin gesto todavía
    const recipe = this._recipes[name];
    if (!recipe) return;

    // Throttle por nombre (ms mínimos entre disparos del mismo SFX).
    const now = this.ctx.currentTime * 1000;
    const minGap = recipe.throttle ?? 25;
    if (this._lastSfxAt[name] && now - this._lastSfxAt[name] < minGap) return;
    this._lastSfxAt[name] = now;

    // Techo de voces: si hay demasiadas sonando, descartar (evita clipping).
    if (this._voiceCount >= MAX_VOICES) return;

    try {
      recipe.play.call(this, this.ctx.currentTime, opts);
    } catch {
      /* una receta que falle no debe tumbar el juego */
    }
  }

  /**
   * Crea la ganancia de una voz y la conecta al master (+ envío a reverb si se
   * pide). Registra la voz para el conteo y la limpieza.
   */
  _voiceGain(reverb, sends) {
    const g = this.ctx.createGain();
    g.gain.value = 0.0001;
    g.connect(this.master);
    if (reverb && this.reverbSend) {
      const s = this.ctx.createGain();
      s.gain.value = sends ?? 0.5;
      g.connect(s).connect(this.reverbSend);
    }
    this._voiceCount++;
    return g;
  }

  /** Cierra una voz: desconecta sus nodos y libera el slot. */
  _release(nodes, gain) {
    for (const n of nodes) {
      try {
        n.stop && n.stop();
      } catch {
        /* ya detenido */
      }
      try {
        n.disconnect();
      } catch {
        /* noop */
      }
    }
    try {
      gain && gain.disconnect();
    } catch {
      /* noop */
    }
    this._voiceCount = Math.max(0, this._voiceCount - 1);
  }

  /**
   * Envolvente percusiva simple (attack lineal → decaída exponencial). Devuelve
   * el instante final para programar el stop del oscilador.
   */
  _perc(param, t0, { attack = 0.005, decay = 0.15, peak = 0.3 }) {
    param.cancelScheduledValues(t0);
    param.setValueAtTime(0.0001, t0);
    param.linearRampToValueAtTime(peak, t0 + attack);
    param.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
    return t0 + attack + decay;
  }

  /** Osc con envolvente propia hacia un destino. Se auto-limpia al terminar. */
  _blip(t0, { type, freq, freqEnd, attack, decay, peak, detune, dest }) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd && freqEnd !== freq) {
      // Barrido exponencial: pitch-drop de impacto o ascenso de destello.
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + (attack + decay));
    }
    if (detune) osc.detune.value = detune;
    const g = ctx.createGain();
    const tEnd = this._perc(g.gain, t0, { attack, decay, peak });
    osc.connect(g).connect(dest);
    osc.start(t0);
    osc.stop(tEnd + 0.03);
    osc.onended = () => this._release([osc], g);
    return { osc, g, tEnd };
  }

  /** Ráfaga de ruido filtrado. Base de crujidos, impactos y whooshes. */
  _noiseBurst(t0, { filterType = 'bandpass', freq, q = 1, freqEnd, attack, decay, peak, dest }) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this._noise();
    const filt = ctx.createBiquadFilter();
    filt.type = filterType;
    filt.frequency.setValueAtTime(freq, t0);
    if (freqEnd && freqEnd !== freq) {
      filt.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + (attack + decay));
    }
    filt.Q.value = q;
    const g = ctx.createGain();
    const tEnd = this._perc(g.gain, t0, { attack, decay, peak });
    src.connect(filt).connect(g).connect(dest);
    src.start(t0);
    src.stop(tEnd + 0.05);
    src.onended = () => this._release([src], g);
    return { src, filt, g, tEnd };
  }

  // ── Recetas de SFX ────────────────────────────────────────────────────────
  // Cada receta mapea un evento del juego a una textura grimdark concreta.
  get _recipes() {
    if (this.__recipes) return this.__recipes;
    this.__recipes = {
      // Tap corto y SECO: click metálico de UI. Triángulo agudo + pizca de ruido.
      ui_click: {
        throttle: 30,
        play(t0) {
          const g = this._voiceGain(false);
          this._blip(t0, {
            type: 'triangle',
            freq: 1150,
            freqEnd: 720,
            attack: 0.002,
            decay: 0.05,
            peak: 0.22,
            dest: g,
          });
          this._noiseBurst(t0, {
            filterType: 'highpass',
            freq: 2600,
            q: 0.7,
            attack: 0.001,
            decay: 0.028,
            peak: 0.06,
            dest: g,
          });
          setTimeout(() => this._release([], g), 200);
        },
      },

      // Abrir panel: whoosh GRAVE ascendente (una compuerta de acero que corre).
      ui_open: {
        throttle: 40,
        play(t0) {
          const g = this._voiceGain(true, 0.3);
          this._noiseBurst(t0, {
            filterType: 'bandpass',
            freq: 200,
            freqEnd: 900,
            q: 1.2,
            attack: 0.02,
            decay: 0.32,
            peak: 0.14,
            dest: g,
          });
          this._blip(t0, {
            type: 'sine',
            freq: 90,
            freqEnd: 180,
            attack: 0.03,
            decay: 0.28,
            peak: 0.1,
            dest: g,
          });
          setTimeout(() => this._release([], g), 500);
        },
      },

      // Cerrar panel: whoosh grave DESCENDENTE, más corto (la compuerta baja).
      ui_close: {
        throttle: 40,
        play(t0) {
          const g = this._voiceGain(true, 0.25);
          this._noiseBurst(t0, {
            filterType: 'bandpass',
            freq: 800,
            freqEnd: 180,
            q: 1.2,
            attack: 0.005,
            decay: 0.22,
            peak: 0.12,
            dest: g,
          });
          this._blip(t0, {
            type: 'sine',
            freq: 170,
            freqEnd: 70,
            attack: 0.005,
            decay: 0.2,
            peak: 0.09,
            dest: g,
          });
          setTimeout(() => this._release([], g), 400);
        },
      },

      // Cosecha: crujido ORGÁNICO (grano/tallo que se arranca) + tono mate.
      harvest: {
        throttle: 40,
        play(t0) {
          const g = this._voiceGain(false);
          // Dos golpecitos de ruido bandpass = fibra que cede.
          this._noiseBurst(t0, {
            filterType: 'bandpass',
            freq: 1500,
            q: 2.5,
            attack: 0.003,
            decay: 0.08,
            peak: 0.16,
            dest: g,
          });
          this._noiseBurst(t0 + 0.05, {
            filterType: 'bandpass',
            freq: 1000,
            q: 2.5,
            attack: 0.003,
            decay: 0.06,
            peak: 0.1,
            dest: g,
          });
          // Tono grave breve = el "cuerpo" de lo cosechado.
          this._blip(t0, {
            type: 'triangle',
            freq: 220,
            freqEnd: 180,
            attack: 0.004,
            decay: 0.14,
            peak: 0.12,
            dest: g,
          });
          setTimeout(() => this._release([], g), 400);
        },
      },

      // Recompensa KH: DESTELLO TEAL. Campana vítrea + arpegio corto ascendente
      // (la "magia del Velo"). Único momento luminoso; con reverb para brillo.
      token: {
        throttle: 60, // token:earned puede venir en ráfaga → limitamos fuerte
        play(t0) {
          const g = this._voiceGain(true, 0.6);
          // Arpegio menor pentatónico ascendente (teal = agudo, cristalino).
          const notes = [880, 1046.5, 1318.5, 1568]; // A5 · C6 · E6 · G6
          notes.forEach((f, i) => {
            const dt = t0 + i * 0.055;
            // Timbre de campana: portadora sine + un armónico agudo tenue.
            this._blip(dt, {
              type: 'sine',
              freq: f,
              attack: 0.003,
              decay: 0.28 - i * 0.03,
              peak: 0.16,
              dest: g,
            });
            this._blip(dt, {
              type: 'triangle',
              freq: f * 2.01, // ligera inarmonía = brillo "vítreo"
              attack: 0.003,
              decay: 0.12,
              peak: 0.04,
              dest: g,
            });
          });
          setTimeout(() => this._release([], g), 600);
        },
      },

      // Construcción: THUNK grave de piedra/metal con cuerpo + anillo metálico.
      build: {
        throttle: 60,
        play(t0) {
          const g = this._voiceGain(true, 0.25);
          // Impacto: pitch-drop grave = masa que se asienta.
          this._blip(t0, {
            type: 'sine',
            freq: 130,
            freqEnd: 48,
            attack: 0.002,
            decay: 0.22,
            peak: 0.34,
            dest: g,
          });
          // Cuerpo de ruido lowpass = polvo/escombro del golpe.
          this._noiseBurst(t0, {
            filterType: 'lowpass',
            freq: 400,
            q: 0.8,
            attack: 0.001,
            decay: 0.12,
            peak: 0.2,
            dest: g,
          });
          // Anillo metálico breve = herraje/estructura.
          this._blip(t0 + 0.01, {
            type: 'square',
            freq: 320,
            freqEnd: 300,
            attack: 0.001,
            decay: 0.09,
            peak: 0.05,
            dest: g,
          });
          setTimeout(() => this._release([], g), 450);
        },
      },

      // Aviso suave: DOS tonos (intervalo menor, algo ominoso pero gentil).
      notify: {
        throttle: 80,
        play(t0) {
          const g = this._voiceGain(true, 0.4);
          // Cuarta justa hacia una nota más baja: campana de aviso apagada.
          this._blip(t0, {
            type: 'triangle',
            freq: 587.3, // D5
            attack: 0.01,
            decay: 0.22,
            peak: 0.14,
            dest: g,
          });
          this._blip(t0 + 0.14, {
            type: 'triangle',
            freq: 440, // A4 (baja → sensación de peso/alerta contenida)
            attack: 0.01,
            decay: 0.3,
            peak: 0.13,
            dest: g,
          });
          setTimeout(() => this._release([], g), 600);
        },
      },

      // Tormenta: RETUMBO profundo de acento al empezar (sobre el cambio del
      // lecho). Sub-seno lento + hinchazón de ruido = trueno de irrealidad.
      storm: {
        throttle: 500,
        play(t0) {
          const g = this._voiceGain(true, 0.5);
          // Sub muy grave con ataque lento y cola larga = presión que llega.
          this._blip(t0, {
            type: 'sine',
            freq: 46,
            freqEnd: 30,
            attack: 0.08,
            decay: 1.2,
            peak: 0.4,
            dest: g,
          });
          // Hinchazón de estática grave = la tormenta cargando.
          this._noiseBurst(t0, {
            filterType: 'lowpass',
            freq: 300,
            freqEnd: 120,
            q: 0.6,
            attack: 0.25,
            decay: 1.1,
            peak: 0.22,
            dest: g,
          });
          setTimeout(() => this._release([], g), 1600);
        },
      },
    };
    return this.__recipes;
  }

  // ── Cableado a EventBridge ────────────────────────────────────────────────

  /** Engancha los eventos del juego a SFX / transiciones de ambiente. */
  wireEvents() {
    if (this._wired) return;
    this._wired = true;

    const h = {
      // Recompensas / economía → destello teal.
      'token:earned': () => this.playSfx('token'),

      // Cosecha (dos nombres posibles según escena).
      'resource:harvest': () => this.playSfx('harvest'),

      // Construcción.
      'building:placed': () => this.playSfx('build'),
      'building:completed': () => this.playSfx('build'),

      // UI: paneles y modo colocación.
      'overlay:open': () => this.playSfx('ui_open'),
      'overlay:close': () => this.playSfx('ui_close'),
      'placement:started': () => this.playSfx('ui_open'),
      'placement:ended': () => this.playSfx('ui_close'),

      // Selección / taps.
      'entity:selected': () => this.playSfx('ui_click'),
      'structure:selected': () => this.playSfx('ui_click'),

      // Alertas suaves.
      'game:notification': () => this.playSfx('notify'),

      // Tormentas Disformes: acento + intensificación del lecho.
      'storm:started': () => {
        this.setStorm(true);
        this.playSfx('storm');
      },
      'storm:ended': () => this.setStorm(false),

      // Ciclo día/noche: oscurece/aclara el lecho.
      'time:updated': (p) => {
        if (p && p.period) this.setPeriod(p.period);
      },

      // Ajustes de audio desde SettingsPanel. Un mismo evento transporta mute
      // y/o volumen (el slider emite { volume }, el toggle { muted }).
      'settings:audio': (p) => {
        if (!p) return;
        if (typeof p.muted !== 'undefined') this.setMuted(p.muted);
        if (typeof p.volume !== 'undefined') this.setVolume(p.volume);
      },
    };

    this._bridgeHandlers = h;
    for (const [evt, fn] of Object.entries(h)) EventBridge.on(evt, fn);
  }

  /** Quita todos los listeners de EventBridge que registró el motor. */
  unwire() {
    if (!this._wired || !this._bridgeHandlers) return;
    for (const [evt, fn] of Object.entries(this._bridgeHandlers)) {
      EventBridge.off(evt, fn);
    }
    this._bridgeHandlers = null;
    this._wired = false;
  }
}

// Singleton: un solo motor para toda la app.
const audio = new AudioEngine();

export default audio;
export { AudioEngine };
