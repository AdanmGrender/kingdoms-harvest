// Piezas 9-slice del kit B (ui_kit_b etapa B) y tokens kh-* en hex para estilos inline.
// Los `slice` salen de medir cada webp con sharp (perfil de alfa/color por fila y columna):
//   panel_frame.webp 674×900  → marco de madera de ~100 px por lado; el centro es pergamino.
//   btn_red.webp     391×160  → cantonera de latón de ~32 px.   btn_stone.webp 410×160 → igual.
//   bar_frame.webp   458×64   → arriba 18, derecha 44, abajo 16, izquierda 48 (tapas de latón).
//   portrait_ring.webp 261×256 → aro de ~15 px (x 13–27); el interior es un disco opaco.

export const KH = {
  ink: '#14110d',
  oak: '#2a2119',
  'oak-light': '#3d3024',
  iron: '#4a4a48',
  brass: '#b08d57',
  'brass-light': '#d9b77a',
  bone: '#e6dcc3',
  'bone-dim': '#a89c84',
  parchment: '#d8c8a0',
  'parchment-ink': '#2b1f14',
  seal: '#7a1f1a',
  ember: '#e07b2a',
  macula: '#8fae3a',
};

const UI = '/assets/b/ui';

export const PANEL_FRAME = { src: `${UI}/panel_frame.webp`, slice: 100, width: 14 };
export const BTN_PIECES = {
  primary: { src: `${UI}/btn_red.webp`, slice: 32, width: 12 },
  secondary: { src: `${UI}/btn_stone.webp`, slice: 32, width: 12 },
};
export const BAR_FRAME = { src: `${UI}/bar_frame.webp`, slice: '18 44 16 48', width: '4px 10px 4px 10px' };
export const RING = { src: `${UI}/portrait_ring.webp`, w: 261, h: 256, innerRadius: 0.391 };

export const BAR_TONES = { ember: KH.ember, seal: KH.seal, macula: KH.macula };

/** `border-image` inline de una pieza cuadrada (panel/botón). */
export function borderImageStyle({ src, slice, width }) {
  return {
    borderStyle: 'solid',
    borderWidth: width,
    borderImageSource: `url(${src})`,
    borderImageSlice: slice,
    borderImageWidth: width,
    borderImageRepeat: 'stretch',
  };
}
