// Siembra LOCAL (db ignorada por git): deja a1n1/a1n2 limpios y a1n3 disponible para el device id de captura.
// Uso (server detenido): node specs/combate_b/evidencia/sembrar_a1n3.cjs [deviceId]
process.env.NODE_ENV = 'development';
process.env.BOT_TOKEN = process.env.BOT_TOKEN || 'dummy:token';
const path = require('path');
const root = path.resolve(__dirname, '../../../server');
const db = require(path.join(root, 'src/config/database.js'));

function deviceIdToPlayerId(deviceId) { // copia de telegramAuth.js
  let h = 0x811c9dc5;
  for (let i = 0; i < deviceId.length; i++) { h ^= deviceId.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0) + 2000000000;
}

(async () => {
  const deviceId = process.argv[2] || 'captura-combate-b-0001';
  const pid = deviceIdToPlayerId(deviceId);
  await db.initDatabase();
  await db.migrate.latest({ directory: path.join(root, 'migrations') });
  await db('player_campaign_progress').where('player_id', pid).del();
  const now = new Date().toISOString();
  await db('player_campaign_progress').insert([
    { player_id: pid, node_id: 'a1n1', status: 'cleared', cleared_at: now },
    { player_id: pid, node_id: 'a1n2', status: 'cleared', cleared_at: now },
    { player_id: pid, node_id: 'a1n3', status: 'available' },
  ]);
  db.flushNow();
  console.log('sembrado', { deviceId, playerId: pid });
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
