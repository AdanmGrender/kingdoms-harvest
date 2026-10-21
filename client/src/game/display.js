// Resolución de render y escena inicial por entrada del juego (hub/preview).
// Módulo puro: sin phaser ni store (lo testea src/tests/display.test.js).

export const MAX_RENDER_SCALE = 3;
export const TAP_SLOP_CSS = 12;

const HUB_SCENES = ['BootScene', 'HubSceneB'];
const PREVIEW_SCENES = ['BootScene', 'WorldScene', 'IsoScene', 'IsoWorldScene'];

export function computeRenderScale(dpr) {
  if (typeof dpr !== 'number' || !Number.isFinite(dpr)) return 1;
  return Math.min(Math.max(dpr, 1), MAX_RENDER_SCALE);
}

export function computeBackingSize(cssW, cssH, s) {
  return { width: Math.round(cssW * s), height: Math.round(cssH * s), zoom: 1 / s };
}

// Un contenedor medido en 0 px (montaje antes del layout) nunca debe dar un canvas vacío.
function safeCss(v) {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 1;
}

export function buildDisplaySettings({ entry, cssWidth, cssHeight, dpr } = {}) {
  if (entry !== 'hub') {
    return {
      entry: 'preview',
      mode: 'RESIZE',
      renderScale: 1,
      width: '100%',
      height: '100%',
      zoom: 1,
      pixelArt: true,
      antialias: false,
      roundPixels: true,
      scenes: [...PREVIEW_SCENES],
    };
  }
  const s = computeRenderScale(dpr);
  const { width, height, zoom } = computeBackingSize(safeCss(cssWidth), safeCss(cssHeight), s);
  return {
    entry: 'hub',
    mode: 'NONE',
    renderScale: s,
    width,
    height,
    zoom,
    pixelArt: false,
    antialias: true,
    roundPixels: false,
    scenes: [...HUB_SCENES],
  };
}

export function resolveStartScene({ entry, isoMode, search } = {}) {
  if (entry === 'hub') return 'HubSceneB';
  if (isoMode) return 'IsoWorldScene';
  const params = new URLSearchParams(search || '');
  if (params.get('iso') === '1') return 'IsoScene';
  return 'WorldScene';
}

export function textResolutionFor(zoom) {
  return typeof zoom === 'number' && Number.isFinite(zoom) ? Math.max(1, zoom) : 1;
}
