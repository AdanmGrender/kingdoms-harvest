#!/usr/bin/env node
/**
 * run-kingdoms-harvest driver — self-contained smoke + screenshot harness.
 *
 * Boots the Express server (:3001) and the Vite client (:5173), health-checks
 * the API through the auth bypass, screenshots the running game, and tears
 * everything down. One command = proof the app actually runs.
 *
 *   node .claude/skills/run-kingdoms-harvest/driver.mjs [flags]
 *
 * Flags:
 *   --iso            Screenshot the IsoWorldScene experiment (?iso=1) instead
 *                    of the default WorldScene (?preview=world).
 *   --out <path>     Screenshot output path (default: screenshots/driver-<ts>.png).
 *   --wait <sec>     Seconds to wait after canvas appears (default 10) — the
 *                    Phaser scene needs a few seconds to paint.
 *   --keep           Leave server + client running after the screenshot (for
 *                    manual poking); the driver prints the URLs and exits 0.
 *   --url <full>     Override the URL to screenshot (implies servers already up
 *                    OR that --keep-managed servers serve it).
 *   --no-screenshot  Health-check only, skip Playwright.
 *
 * Requires: server/.env with BOT_TOKEN set (any non-empty value), deps installed
 * (npm install at root + server + client), and `npx playwright install chromium`.
 */
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import path from 'node:path';
import fs from 'node:fs';
import http from 'node:http';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Skill lives at <repo>/.claude/skills/run-kingdoms-harvest/ → repo root is 3 up.
const ROOT = path.resolve(__dirname, '../../..');
const SERVER_DIR = path.join(ROOT, 'server');
const CLIENT_DIR = path.join(ROOT, 'client');
const IS_WIN = process.platform === 'win32';

// ─── Args ──────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const a = { iso: false, out: null, wait: 10, keep: false, url: null, screenshot: true };
  for (let i = 2; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--iso') a.iso = true;
    else if (t === '--keep') a.keep = true;
    else if (t === '--no-screenshot') a.screenshot = false;
    else if (t === '--out') a.out = argv[++i];
    else if (t === '--wait') a.wait = Number(argv[++i]);
    else if (t === '--url') a.url = argv[++i];
  }
  return a;
}
const args = parseArgs(process.argv);

// ─── Small HTTP helpers (no deps) ────────────────────────────────────────────
function request(opts, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.setTimeout(3000, () => req.destroy(new Error('timeout')));
    if (body) req.write(body);
    req.end();
  });
}

async function serverHealthy() {
  try {
    const res = await request(
      {
        host: 'localhost', port: 3001, path: '/api/player/init', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-skip-auth': 'true' },
      },
      '{}',
    );
    return res.status === 200 && res.body.includes('telegram_id');
  } catch { return false; }
}

async function clientHealthy() {
  try {
    const res = await request({ host: 'localhost', port: 5173, path: '/', method: 'GET' });
    return res.status === 200;
  } catch { return false; }
}

async function waitFor(fn, label, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await fn()) return true;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Timed out waiting for ${label} (${timeoutMs}ms)`);
}

// ─── Process management ──────────────────────────────────────────────────────
const spawned = [];

function launch(cmd, cmdArgs, cwd, env, { needsShell = false } = {}) {
  const child = spawn(cmd, cmdArgs, {
    cwd,
    env: { ...process.env, ...env },
    shell: needsShell && IS_WIN, // only npm needs the shell on Windows (npm.cmd)
    detached: !IS_WIN,           // POSIX: own process group so we can kill the tree
    stdio: 'ignore',
  });
  spawned.push(child);
  return child;
}

function killTree(child) {
  if (!child || child.killed || child.pid == null) return;
  try {
    if (IS_WIN) {
      spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' });
    } else {
      process.kill(-child.pid, 'SIGTERM'); // negative pid = process group
    }
  } catch { /* already gone */ }
}

function teardown() {
  for (const c of spawned) killTree(c);
}

// ─── Main ────────────────────────────────────────────────────────────────────
(async () => {
  if (!fs.existsSync(path.join(SERVER_DIR, '.env'))) {
    console.error('✗ server/.env missing. Copy server/.env.example and set BOT_TOKEN=<anything>.');
    process.exit(1);
  }

  // Reuse already-running processes if present (idempotent).
  let ownServer = false, ownClient = false;

  if (await serverHealthy()) {
    console.log('• server already up on :3001 — reusing');
  } else {
    console.log('• starting server (SKIP_AUTH=true, BOT_POLLING=false) …');
    launch('node', ['src/index.js'], SERVER_DIR, { SKIP_AUTH: 'true', BOT_POLLING: 'false' });
    ownServer = true;
    await waitFor(serverHealthy, 'server :3001');
  }
  console.log('✓ server healthy — POST /api/player/init returns player JSON');

  if (await clientHealthy()) {
    console.log('• client already up on :5173 — reusing');
  } else {
    console.log('• starting Vite client …');
    launch('npm', ['run', 'dev'], CLIENT_DIR, {}, { needsShell: true });
    ownClient = true;
    await waitFor(clientHealthy, 'client :5173');
  }
  console.log('✓ client serving on :5173');

  const url = args.url || `http://localhost:5173/?${args.iso ? 'iso=1' : 'preview=world'}`;

  if (!args.screenshot) {
    console.log(`✓ health OK. Open ${url}`);
    if (args.keep) { console.log('• --keep: leaving server + client running'); process.exit(0); }
    teardown();
    return;
  }

  // Screenshot via Playwright (already a devDependency at repo root).
  const pwPath = path.join(ROOT, 'node_modules', 'playwright', 'index.js');
  const pw = await import(pathToFileURL(pwPath).href);
  const chromium = pw.chromium ?? pw.default?.chromium; // CJS→ESM interop
  const outDir = path.join(ROOT, 'screenshots');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = args.out
    ? path.resolve(args.out)
    : path.join(outDir, `driver-${args.iso ? 'iso-' : ''}${Date.now()}.png`);

  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(`[console] ${m.text()}`));
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));

  console.log(`→ screenshotting ${url} (wait ${args.wait}s)`);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForSelector('canvas', { timeout: 15000 });
  await page.waitForTimeout(args.wait * 1000);
  await page.screenshot({ path: outFile });
  await browser.close();

  console.log(`✓ screenshot: ${outFile}`);
  if (errors.length) { console.log('--- browser errors ---'); errors.forEach((e) => console.log(e)); }

  if (args.keep) {
    console.log(`• --keep: server + client still running. Open ${url}`);
    process.exit(0);
  }
  teardown();
  // Give teardown a beat, then exit (Playwright/child handles can hang the loop).
  setTimeout(() => process.exit(0), 500);
})().catch((err) => {
  console.error('✗ driver failed:', err.message);
  teardown();
  process.exit(1);
});

// Safety: tear down children if the driver is interrupted.
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => { teardown(); process.exit(130); });
}
