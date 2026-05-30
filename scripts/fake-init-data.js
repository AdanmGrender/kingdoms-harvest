/**
 * Forge valid Telegram initData for a test user, then sanity-check every
 * panel-backing endpoint with that auth so we can spot which routes blow up
 * even when authenticated.
 */
const crypto = require('crypto');
const https = require('https');

// Load from env so the literal never ends up in git again. Run as:
//   TELEGRAM_BOT_TOKEN=... node scripts/fake-init-data.js
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error('TELEGRAM_BOT_TOKEN env var required');
  process.exit(1);
}
const BASE = process.env.KH_BASE_URL || 'https://adamn-vps.duckdns.org';

const user = {
  id: 999999999,
  first_name: 'CavemanExplorer',
  username: 'caveman_explorer',
  language_code: 'es',
  allows_write_to_pm: true,
};

function buildInitData() {
  const auth_date = Math.floor(Date.now() / 1000);
  const params = new URLSearchParams({
    auth_date: String(auth_date),
    user: JSON.stringify(user),
  });
  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  params.set('hash', hash);
  return params.toString();
}

async function request(method, path, initData, body) {
  return new Promise((resolve) => {
    const opts = {
      method,
      hostname: 'adamn-vps.duckdns.org',
      port: 443,
      path,
      headers: {
        'X-Telegram-Init-Data': initData,
        'Content-Type': 'application/json',
      },
    };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', (e) => resolve({ status: 0, body: e.message }));
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

(async () => {
  const initData = buildInitData();
  console.log(`→ initData built for user ${user.id}`);

  // Step 1: init player
  const init = await request('POST', '/api/player/init', initData, {});
  console.log(`POST /api/player/init  → ${init.status}`);
  if (init.status !== 200) {
    console.log('  body:', init.body.slice(0, 300));
    process.exit(1);
  }

  // Step 2: probe panel-backing endpoints
  const probes = [
    'GET /api/player/resources',
    'GET /api/buildings',
    'GET /api/farm/plots',
    'GET /api/missions',
    'GET /api/villagers',
    'GET /api/factions',
    'GET /api/territories',
    'GET /api/achievements',
    'GET /api/marketplace',
    'GET /api/alliances',
    'GET /api/events/active',
    'GET /api/tournaments/active',
    'GET /api/wars/faction/active',
    'GET /api/wars/alliance/active',
    'GET /api/tech',
    'GET /api/heroes',
    'GET /api/crafting',
    'GET /api/world-events',
    'GET /api/notifications/prefs',
    'GET /api/market',
    'GET /api/seasonal',
    'GET /api/prestige',
    'GET /api/guilds',
    'GET /api/guilds/mine',
    'GET /api/tasks/daily',
    'GET /api/tasks/social',
    'GET /api/player/leaderboard',
    'GET /api/combat/troops',
  ];

  const findings = [];
  for (const p of probes) {
    const [m, path] = p.split(' ');
    const r = await request(m, path, initData);
    const tag = r.status >= 200 && r.status < 300 ? '✅' :
                r.status === 404 ? '🚫 404' :
                r.status >= 500 ? '💀' : `⚠️ ${r.status}`;
    const bodyHead = r.body.length < 80 ? r.body : r.body.slice(0, 80) + '…';
    console.log(`${m.padEnd(4)} ${path.padEnd(40)} ${tag} ${bodyHead}`);
    if (r.status >= 400) findings.push({ path, status: r.status, body: r.body.slice(0, 240) });
  }

  console.log('');
  console.log(`\n=== Issues (${findings.length}) ===`);
  for (const f of findings) console.log(`${f.path} → ${f.status}\n  ${f.body}\n`);
})();
