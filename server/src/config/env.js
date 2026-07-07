'use strict';
/**
 * env.js — validación de entorno al arrancar. En producción, el server DEBE
 * negarse a arrancar si faltan secretos críticos (mejor caer ruidoso al inicio
 * que servir requests rotas o inseguras). En dev/test solo advierte.
 *
 * Se llama una vez desde index.js justo tras cargar dotenv.
 */
const REQUIRED_PROD = ['BOT_TOKEN', 'WEBAPP_URL'];

// Faltantes que NO impiden arrancar, pero degradan funciones — se avisan.
const OPTIONAL_PROD = [
  ['TON_HOT_WALLET_MNEMONIC', 'los retiros TON quedarán deshabilitados'],
  ['REDIS_URL', 'rate-limit y caché usarán memoria local (no compartida entre workers)'],
  ['SENTRY_DSN', 'sin monitoreo de errores'],
];

function fail(msg) {
  console.error(`\n[env] ✗ ${msg}`);
}

/**
 * @returns {{ prod: boolean }} — para que el caller sepa el modo.
 * En producción hace process.exit(1) si falta algo requerido o si el bypass
 * de auth quedó encendido por error.
 */
function validateEnv() {
  const prod = process.env.NODE_ENV === 'production';
  if (!prod) {
    if (!process.env.BOT_TOKEN && process.env.SKIP_AUTH !== 'true') {
      console.warn('[env] dev: sin BOT_TOKEN — usá SKIP_AUTH=true para bypass de auth local');
    }
    return { prod };
  }

  const missing = REQUIRED_PROD.filter((k) => !process.env[k]);
  let ok = true;

  if (missing.length) {
    fail(`faltan variables requeridas en producción: ${missing.join(', ')}`);
    ok = false;
  }

  // Defensa en profundidad: el bypass de auth JAMÁS debe estar activo en prod.
  // El middleware ya lo ignora, pero si alguien lo dejó puesto, es un
  // misconfig grave → caer ruidoso en vez de arrancar "casi seguro".
  if (process.env.SKIP_AUTH === 'true') {
    fail('SKIP_AUTH=true está activo en producción — quitalo antes de arrancar');
    ok = false;
  }

  if (!ok) {
    console.error('[env] abortando arranque por configuración insegura/incompleta.\n');
    process.exit(1);
  }

  for (const [key, effect] of OPTIONAL_PROD) {
    if (!process.env[key]) console.warn(`[env] ⚠ ${key} no seteado — ${effect}`);
  }
  console.log('[env] ✓ configuración de producción validada');
  return { prod };
}

module.exports = { validateEnv };
