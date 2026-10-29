// Alto visible de la app (fix_pantalla_movil). Un único valor → variable CSS --kh-app-h.
// MAX_ASPECT es espejo de --kh-max-aspect en styles/index.css (lo verifica viewport.test.js).
export const MAX_ASPECT = 2.1;

/**
 * Alto visible en px, o null si debe mandar el valor CSS (100dvh).
 * 1) Telegram (initData no vacío y viewportStableHeight > 0): el menor entre el estable y innerHeight.
 * 2) Sin soporte de dvh: innerHeight.
 * 3) Si no: null.
 */
export function computeAppHeight({ tgInitData, tgStableHeight, innerHeight, supportsDvh } = {}) {
  const inner = Number(innerHeight) > 0 ? Number(innerHeight) : null;
  const stable = Number(tgStableHeight);
  if (tgInitData && stable > 0) {
    return Math.round(inner ? Math.min(stable, inner) : stable);
  }
  if (!supportsDvh && inner) return Math.round(inner);
  return null;
}

/** Instala --kh-app-h en :root y lo recalcula en resize/orientationchange/viewportChanged. Devuelve el cleanup. */
export function installViewportVars({ win = window, doc = document } = {}) {
  const root = doc.documentElement;
  const update = () => {
    const tg = win.Telegram && win.Telegram.WebApp;
    const supportsDvh = !!(win.CSS && typeof win.CSS.supports === 'function' && win.CSS.supports('height', '100dvh'));
    const h = computeAppHeight({
      tgInitData: tg && tg.initData,
      tgStableHeight: tg && tg.viewportStableHeight,
      innerHeight: win.innerHeight,
      supportsDvh,
    });
    if (h === null) root.style.removeProperty('--kh-app-h');
    else root.style.setProperty('--kh-app-h', `${h}px`);
  };
  update();
  win.addEventListener('resize', update);
  win.addEventListener('orientationchange', update);
  const tg = win.Telegram && win.Telegram.WebApp;
  const hasTgEvents = !!(tg && typeof tg.onEvent === 'function');
  if (hasTgEvents) tg.onEvent('viewportChanged', update);
  return () => {
    win.removeEventListener('resize', update);
    win.removeEventListener('orientationchange', update);
    if (hasTgEvents && typeof tg.offEvent === 'function') tg.offEvent('viewportChanged', update);
  };
}
