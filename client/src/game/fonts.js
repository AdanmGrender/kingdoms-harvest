/**
 * Tipografía de texto Phaser (ui_kit_b R10–R12). Única fuente de la cadena de fuente del canvas:
 * el chrome React usa las clases Tailwind `font-display` / `font-body` / `font-numeric`.
 */
export const UI_FONT = "'IM Fell English SC', serif";

/**
 * Espera la carga de las dos familias de texto Phaser o el timeout; resuelve siempre y nunca rechaza (R11, R12).
 * Sin `document.fonts` (jsdom, navegadores viejos) resuelve de inmediato.
 */
export async function loadUiFonts(timeoutMs = 3000) {
  if (typeof document === 'undefined' || !document.fonts || typeof document.fonts.load !== 'function') return;
  let timer;
  const timeout = new Promise((resolve) => { timer = setTimeout(resolve, timeoutMs); });
  const loaded = (async () => {
    await Promise.all([
      document.fonts.load("16px 'IM Fell English'"),
      document.fonts.load("16px 'IM Fell English SC'"),
    ]);
  })().catch(() => {});
  try {
    await Promise.race([loaded, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
