---
name: run-kingdoms-harvest
description: Run, start, launch, build, test, or screenshot the Kingdoms Harvest game — a Telegram Mini App (Vite/React/Phaser client + Express server). Use when asked to boot the game, see it running, screenshot a scene, or verify a change renders.
---

# Run Kingdoms Harvest

Telegram Mini App farming/RTS game: **Express server** (`:3001`, sql.js in
WASM) + **Vite/React/Phaser client** (`:5173`). Both must run together, and the
API is gated by Telegram HMAC auth — so seeing the game needs a two-sided auth
bypass (`SKIP_AUTH=true` on the server + `?preview=world` on the client).

**The agent path is the driver:**
[.claude/skills/run-kingdoms-harvest/driver.mjs](.claude/skills/run-kingdoms-harvest/driver.mjs)
spawns both processes, health-checks the API through the bypass, screenshots the
running game with Playwright, and tears everything down. One command.

All paths below are relative to the repo root.

## Prerequisites

```bash
# Node 20+ (verified on v24). Install deps at all three levels:
npm install
cd server && npm install && cd ..
cd client && npm install && cd ..

# Playwright browser for the driver's screenshots:
npx playwright install chromium

# Server refuses to boot without BOT_TOKEN (presence check only — any value works):
cp server/.env.example server/.env    # then ensure BOT_TOKEN=<anything> is set
```

After a fresh clone the game art is gitignored — regenerate placeholders or the
scenes load missing textures:

```bash
node scripts/gen_placeholders.js
```

## Run (agent path — the driver)

```bash
# Boot server + client, health-check, screenshot WorldScene, tear down:
node .claude/skills/run-kingdoms-harvest/driver.mjs --out /tmp/kh.png --wait 12
```

Prints `✓ server healthy …`, `✓ client serving …`, and the screenshot path.
Then **open the PNG** — it should show the rendered grimdark map with NPCs and
crop plots, not a blank/dark canvas.

Flags:
- `--iso` — screenshot the legacy IsoScene diamond world via `?iso=1` instead of
  WorldScene. (The newer `IsoWorldScene` is gated by a hardcoded `ISO_MODE` const
  in `client/src/game/config.js`, not reachable via URL.)
- `--out <path>` — screenshot destination (default `screenshots/driver-<ts>.png`).
- `--wait <sec>` — delay after the canvas appears (default 10; Phaser needs a few
  seconds to paint — raise this if the shot is blank).
- `--keep` — leave server + client running for manual poking; prints the URL.
- `--no-screenshot` — health-check only, skip Playwright.

The driver is idempotent: if `:3001` or `:5173` is already serving, it reuses
that process instead of spawning a duplicate (and won't tear down what it didn't
start).

## Direct invocation (server-only / internal code)

Boot just the server with auth bypassed and hit the API with `curl`:

```bash
cd server && SKIP_AUTH=true BOT_POLLING=false node src/index.js
# in another shell:
curl -s -X POST http://localhost:3001/api/player/init \
  -H "Content-Type: application/json" -H "x-skip-auth: true" -d '{}'
# → {"telegram_id":123456,"username":"devuser",...}
```

For PRs that touch an internal function, skip the app entirely — the test runner
uses a fresh in-memory DB (never touches `server/data/kingdoms.db`):

```bash
cd server && npx jest tests/heroService.test.js   # NODE_ENV=test is set in tests/setup.js
```

## Run (human path)

```bash
npm run dev    # concurrently boots server + client
# then open http://localhost:5173/?preview=world
```

Useless headless (needs a browser window). Use the driver instead when there's
no display.

## Test

```bash
cd server && npm test    # Jest, 228/228, in-memory DB
```

## Gotchas

- **`npm start` alone is a trap.** It runs *only* the server. Every API call then
  needs a valid Telegram HMAC signature, so the game 401s. You need the client
  too, and the bypass.
- **Auth bypass is two-sided.** `SKIP_AUTH=true` (server) **and** `?preview=world`
  or `?iso=1` (client). One without the other doesn't work.
- **Server hard-exits without `BOT_TOKEN`** ([server/src/index.js:283](server/src/index.js#L283)).
  It's a presence check, not validation — a dummy value boots fine locally.
- **`BOT_POLLING=false`** stops the Telegram poller. Without it, if a VPS instance
  polls the same token you get a 409 conflict. The driver always sets it.
- **`?iso=1` ≠ IsoWorldScene.** `?iso=1` loads the *legacy* IsoScene POC;
  `?preview=world` loads the main WorldScene. The newer IsoWorldScene experiment
  is behind the hardcoded `ISO_MODE` const in `client/src/game/config.js`.
- **`scripts/screenshot-game.js` has a dead default URL** (an old cloudflare
  tunnel). The driver here supersedes it — localhost-first and self-contained.

## Troubleshooting

- `Cannot read properties of undefined (reading 'launch')` / Playwright import
  fails → `npx playwright install chromium` (the browser binary is missing).
- Screenshot is blank or all-dark → raise `--wait` (Phaser canvas paints a few
  seconds after load).
- `EADDRINUSE` / port already serving → a stale `node src/index.js` or vite is
  running; the driver reuses a healthy one, but a *broken* leftover must be
  killed first (`taskkill` the PID on `:3001`/`:5173`, or `pkill -f "src/index.js"`
  / `pkill -f vite` on POSIX).
