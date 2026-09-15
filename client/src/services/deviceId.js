/**
 * deviceId — identidad de dispositivo para la app standalone (APK/web sin
 * Telegram). Reemplaza el HMAC de Telegram como llave de jugador en Fase 1.
 *
 * Sync a propósito: el interceptor de axios y el handshake del socket lo leen
 * de forma síncrona. localStorage persiste bien en el WebView de Capacitor.
 * (Auth débil — cualquiera puede mandar un id; se endurece en Fase 2.)
 */
const KEY = 'kh_device_id';

function makeUuid() {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  } catch { /* fallthrough */ }
  // Fallback si randomUUID no existe (WebViews viejos).
  return 'dev-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

let cached = null;

export function getDeviceId() {
  if (cached) return cached;
  try {
    let id = localStorage.getItem(KEY);
    if (!id) { id = makeUuid(); localStorage.setItem(KEY, id); }
    cached = id;
    return id;
  } catch {
    // Sin localStorage (modo privado raro): id efímero por sesión.
    if (!cached) cached = makeUuid();
    return cached;
  }
}

/** True si corremos dentro de Telegram (entonces usamos HMAC, no device-id). */
export function inTelegram() {
  return !!(typeof window !== 'undefined' && window.Telegram?.WebApp?.initData);
}
