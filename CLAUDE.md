# Kingdoms Harvest — Developer & AI Guide

> Full-stack Telegram Mini App game. Read this before touching any code.

---

## What Is This?

A medieval farming + RTS game playable inside Telegram. Players build a kingdom, farm resources, trade with caravans, train troops, and earn **KH Tokens** redeemable for TON cryptocurrency.

**Stack at a glance:**

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite 6, Phaser 3.90 (game world), TailwindCSS 3.4 |
| State | Zustand 4.4 (client), Socket.io (real-time sync) |
| Backend | Node.js + Express 4.18 |
| Database | SQLite via `sql.js` (WASM in-memory + disk persistence) |
| Auth | Telegram initData HMAC-SHA256 validation |
| Blockchain | TON via `tonweb` library; `@tonconnect/ui-react` for wallet linking |
| Bot | `node-telegram-bot-api` Telegram bot for notifications |

---

## Repository Layout

```
kingdoms-harvest/
├── client/                  # React + Phaser frontend (Telegram Mini App)
│   ├── src/
│   │   ├── components/      # React UI
│   │   │   ├── overlay/     # In-game overlays (GameHUD, OverlayManager, panels)
│   │   │   ├── token/       # Token economy UI (TokenView, DailyTaskList, etc.)
│   │   │   ├── ui/          # Shared components (SpriteIcon, LoadingScreen)
│   │   │   └── combat/castle/commerce/  # Mode-specific panels
│   │   ├── game/            # Phaser integration
│   │   │   ├── scenes/      # WorldScene.js (main), BootScene.js
│   │   │   ├── systems/     # CameraSystem, ParticleSystem, SelectionSystem, etc.
│   │   │   ├── entities/    # Building, CropPlot, NPC, Animal, Villager
│   │   │   ├── maps/        # MapGenerator.js (160×120 procedural world)
│   │   │   └── EventBridge.js  # Phaser ↔ React EventEmitter3 singleton
│   │   ├── store/           # gameStore.js (Zustand)
│   │   ├── services/        # API client (axios wrappers)
│   │   └── styles/          # index.css + Tailwind config
│   └── public/assets/       # Sprites, tilesets, fonts
│       ├── sprites/         # UI sprite sheets (Buttons_*.png, Items_*.png, Character_*.png)
│       └── game/            # tilesets/, characters/, animals/, effects/
├── server/
│   ├── src/
│   │   ├── index.js         # Express app, Socket.io, startup
│   │   ├── config/
│   │   │   └── database.js  # sql.js custom query builder (knex-compatible API)
│   │   ├── routes/          # 11 Express routers (one per domain)
│   │   ├── services/        # 14+ business logic files
│   │   ├── middleware/      # telegramAuth, validate, errorHandler
│   │   ├── game/            # gameTick.js (cron), seedData.js
│   │   └── bot/             # telegramBot.js
│   ├── migrations/          # DB schema migrations (003 files + run in order)
│   └── tests/               # Jest test suites (104 tests, all passing)
├── shared/
│   ├── gameConfig.js        # CROPS, TROOPS, BUILDINGS, RESOURCES constants
│   └── tokenConfig.js       # Token economy config (daily cap, tasks, rates)
└── docs/
    ├── GDD.md               # Game Design Document
    └── AI_ART_GUIDE.md      # Sprite generation prompts for AI art tools
```

---

## Dev Commands

```bash
# Server (Node.js)
cd server
npm install
cp .env.example .env          # Fill in BOT_TOKEN at minimum
npm run dev                   # nodemon hot-reload on port 3001
npm test                      # Jest (104 tests)

# Client (React + Vite)
cd client
npm install
npm run dev                   # Vite dev server on port 5173
npm run build                 # Production build to client/dist/

# Root workspace
npm install                   # Installs both workspaces
```

Required env vars (`server/.env`):
- `BOT_TOKEN` — Telegram bot token (required)
- `WEBAPP_URL` — Your Mini App URL for CORS
- `TON_HOT_WALLET_MNEMONIC` — 24-word mnemonic for withdrawal hot wallet
- `TON_API_KEY` — TonCenter API key (optional but prevents rate limits)
- `TON_NETWORK` — `testnet` or `mainnet` (default: testnet)

---

## Architecture Patterns

### 1. Adding a new API endpoint

```js
// server/src/routes/thingRoutes.js
const router = express.Router();
const { telegramAuth } = require('../middleware/telegramAuth');
const { validate } = require('../middleware/validate');
const thingService = require('../services/thingService');
const { safeErrorMessage } = require('../middleware/errorHandler');

router.post('/do-thing', telegramAuth, validate({
  amount: { type: 'number', required: true, min: 1, max: 1000 },
}), async (req, res) => {
  try {
    const result = await thingService.doThing(req.playerId, req.body.amount);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error) });
  }
});

module.exports = router;
```

Then mount it in `server/src/index.js`:
```js
const thingRoutes = require('./routes/thingRoutes');
app.use('/api/things', thingRoutes);
```

**`req.playerId`** is the Telegram user ID (integer), set by `telegramAuth` middleware after validating initData HMAC.

### 2. Database queries

The custom query builder in `database.js` mimics knex but runs on top of `sql.js`:

```js
const db = require('../config/database');

// SELECT
const player = await db('players').where('telegram_id', userId).first();
const missions = await db('missions').where({ player_id: userId, status: 'active' });

// INSERT — returns [lastInsertRowId]
const [id] = await db('player_tokens').insert({ player_id: userId, balance: 0 });

// UPDATE
await db('players').where('id', player.id).update({ level: 5 });

// INCREMENT / DECREMENT
await db('player_tokens').where('player_id', userId).increment('balance', 10);

// ATOMIC DECREMENT (only if value >= amount) — use for resource spending
const affected = await db('player_resources')
  .where({ player_id: userId, resource_id: 'gold' })
  .decrementIfEnough('amount', cost);
if (!affected) throw new Error('Not enough gold');
```

**⚠️ CRITICAL sql.js quirk:** `changes()` and `last_insert_rowid()` are captured *inside* `dbRun()` **before** `saveToDisk()` is called, because `sqlDb.export()` resets those counters. Never move `saveToDisk()` before the capture.

### 3. Adding a service

```js
// server/src/services/myService.js
const db = require('../config/database');
const playerService = require('./playerService');

const myService = {
  async doThing(playerId, amount) {
    const player = await db('players').where('telegram_id', playerId).first();
    if (!player) throw new Error('Jugador no encontrado');
    // ... logic ...
    return { success: true, message: 'Done!' };
  },
};

module.exports = myService;
```

Throw plain `Error` objects for user-facing messages. The `safeErrorMessage()` helper sanitizes them before sending to clients.

### 4. Token awards

Always go through `tokenService.awardTokens()` — it handles daily caps, streak multipliers, and referral commissions:

```js
const tokenService = require('./tokenService');
const result = await tokenService.awardTokens(playerId, 5, 'harvest');
// result: { awarded, balance, dailyRemaining, capped }
```

### 5. Task progress tracking

Call `dailyTaskService.trackProgress()` after any player action that maps to a task:

```js
const dailyTaskService = require('./dailyTaskService');
await dailyTaskService.trackProgress(playerId, 'harvest', 1);
// action strings: 'harvest', 'sell', 'battle_win', 'mission_complete', 'login', 'captcha'
```

### 6. Phaser ↔ React communication

Use `EventBridge` (EventEmitter3 singleton at `client/src/game/EventBridge.js`):

```js
// From React → Phaser
EventBridge.emit('building:addToScene', { buildingId: 'barn', posX: 10, posY: 10 });

// From Phaser → React
EventBridge.emit('overlay:open', { type: 'building', data: buildingData });

// React listening
useEffect(() => {
  const handler = (data) => setFoo(data);
  EventBridge.on('some:event', handler);
  return () => EventBridge.off('some:event', handler);
}, []);
```

**Registered events:**
- `overlay:open` / `overlay:close` — panel management
- `entity:selected` / `entity:deselected` — tap-to-select in world
- `building:placed` / `building:addToScene` — placement flow
- `time:updated` `{ icon, period, dayCount }` — day/night cycle (every 10 real min)
- `token:earned` `{ amount, x, y }` — triggers floating "+X KH" text in game world
- `game:notification` `{ text, type }` — toast notification
- `game:input` `{ enabled }` — lock/unlock game input during overlays

---

## Visual Style Guide

**Reference:** Medieval isometric, warm earthy tones, pixel-art chibi — like the Kingdoms Harvest screenshot with isometric buildings, number badges, and action buttons.

### Colors (from `tailwind.config.js`)
```
kingdom-bg:     #1a1a2e  (dark blue-black background)
kingdom-card:   #16213e  (panel/card background)
kingdom-accent: #e94560  (red/pink — buttons, highlights)
kingdom-gold:   #ffd700  (gold — important text, XP, level)
kingdom-green:  #4ade80  (success, crops, nature)
kingdom-blue:   #0f3460  (secondary panels)
```

### Typography
- **MedievalSharp** serif — game titles, level numbers, resource labels
- System sans-serif — body text, descriptions

### Sprite system
Sprites come from two sources:
1. **UI sprite sheets** (`/public/assets/sprites/`) — `SpriteIcon` component, CSS background-position clipping. Named icons: `medal`, `scroll`, `castle_flag`, `reward_bag`, `backpack`, `farmer`, etc.
2. **Game tilesets** (`/public/assets/game/tilesets/`) — loaded by Phaser. Buildings are 64×64px cells in a 4×4 grid (`buildings.png`). Terrain tiles are 32×32px.

### CSS patterns
```css
.game-card   /* dark card with gold border */
.btn-primary /* accent red button */
.btn-gold    /* yellow-to-gold gradient button */
.sprite-icon /* pixelated image rendering */
.progress-bar / .progress-fill  /* resource/XP bars */
```

Custom animations: `fadeIn`, `pulse-gold`, `shake`, `grow` (defined in `index.css`).

---

## Token Economy Overview

**KH Token** is earned through gameplay and withdrawable as TON cryptocurrency.

| Source | Tokens |
|--------|--------|
| Harvest a crop | +2 |
| Complete a mission | +5 |
| Win a PvE battle | +3 |
| Win a PvP battle | +8 |
| Make a sale | +1 |
| Complete daily task | +3–12 (varies) |
| Complete captcha challenge | +5 |

**Daily cap:** `50 + (player.level × 10)` tokens per UTC day  
**Streak multiplier:** Day 7 → 2×, Day 14 → 2.5×, Day 21 → 3×, Day 30 → 5×

**Withdrawal rules:**
- Min 500 KH, level 5+, account 7+ days old
- 24h cooldown between withdrawals, 5% fee
- Rate: 1 KH = 0.0001 TON
- Processed every 5 minutes from hot wallet (server-side)

**Resource burning:** Gold (500→5 KH), Crystal (1→10), Relic (1→15), Blueprint (1→12)

---

## Task System

### Daily tasks (resets UTC midnight)
Defined in `shared/tokenConfig.js → DAILY_TASKS`. Each has an `action` string that maps to `dailyTaskService.trackProgress(playerId, action)` call sites:

| Task ID | Action | Trigger location |
|---------|--------|-----------------|
| `harvest_5` | `harvest` | `farmService.harvest()` |
| `sell_3` | `sell` | `commerceService.sellToCaravan()` |
| `battle_win_1` | `battle_win` | `combatService.attackPVE/PVP()` |
| `mission_1` | `mission_complete` | `missionService.completeMission()` |
| `login` | `login` | `playerService.initPlayer()` |
| `captcha_daily` | `captcha` | `captchaService.solveChallenge()` |

### Social tasks (one-time)
- Join Telegram channel, invite 1/5/10 friends
- Verified server-side via `bot.getChatMember()` or referral count

### Streaks
`dailyTaskService.updateLoginStreak(playerId)` — called on every login. Tracks consecutive login days.

---

## Known Bugs & Status

| Issue | Severity | Status | File |
|-------|----------|--------|------|
| `changes()`/`last_insert_rowid()` reset by `saveToDisk()` | CRITICAL | ✅ FIXED | `database.js:284` |
| Defender wins 100% in equal battles (0.5 formula) | HIGH | ✅ FIXED | `combatService.js:133` |
| `saveToDisk()` blocks event loop on every write | HIGH | ✅ FIXED | `database.js:303` (debounced async) |
| gameTick single try-catch skips subsequent ops | MEDIUM | ✅ FIXED | `gameTick.js` (per-subsystem) |
| JSON.parse without try-catch in missionService | LOW | ✅ FIXED | `missionService.js:167` |
| Leaderboard N+1 query | LOW | ✅ FIXED | `tokenService.js:406` |
| Math.random() in villagerService | LOW | ✅ FIXED | `villagerService.js` |
| Missing DB indexes on player_id columns | LOW | ✅ FIXED | migration `004_add_indexes.js` |
| Referral commission errors silently swallowed | LOW | ✅ FIXED | `tokenService.js:89` |
| PvP combat not fully implemented | MEDIUM | ⏳ Phase 2 | `combatService.js` |
| Faction system incomplete | MEDIUM | ⏳ Phase 2 | `siegeService.js` |
| Territory map not implemented | MEDIUM | ⏳ Phase 2 | — |
| Tech tree (Library) not functional | LOW | ⏳ Phase 2 | — |
| TON tx hash is pseudo (not real hash) | LOW | ⚠️ Known | `tokenService.sendTON()` |

---

## Feature Status Matrix

### Phase 1 (MVP) ✅
- Farm system (7 crops + 3 animals, growth timers, quality rolls)
- Building construction & upgrades (14 building types, 4 zones)
- Mission trading (NPC quests, urgent missions, caravan commerce)
- Troop training + PvE combat engine
- Telegram bot integration + Mini App auth
- KH Token economy (daily cap, streak multiplier, referral, withdrawal)
- Daily/social tasks + login streaks
- Mobile-first React + Phaser UI
- 104 passing tests

### Phase 2 (In Progress)
- [ ] PvP combat fully functional
- [ ] Faction system (join, contribute, faction wars)
- [ ] Territory map with conquest
- [ ] Tech tree (Library building research)
- [ ] Push notifications via bot for crop/troop ready events

### Phase 3–4 (Future)
- Rankings/tournaments, seasonal events, achievements
- Player-to-player trading
- Alliance/cooperative system
- Improved isometric graphics

---

## Performance Notes

- **DB saves are debounced** (2s batch). Data is flushed synchronously on `SIGINT`/`SIGTERM`.
- At 1000+ players, add Redis caching for frequently-read player state.
- `sql.js` is in-memory SQLite — entire DB lives in RAM. For production scale, migrate to `better-sqlite3` or PostgreSQL.
- No explicit DB connection pooling — `sql.js` is single-threaded in-process.

---

## Security

- All API routes require `telegramAuth` middleware (HMAC-SHA256 validation + 5-min window)
- WebSocket auth: same HMAC validation on `join_game` event, 30 events/min rate limit
- Identifier injection prevented: all column/table names go through `sanitizeIdentifier()` whitelist
- SQL injection prevented: all values use parameterized queries (`?` placeholders)
- Operator injection prevented: `sanitizeOperator()` whitelist for `where()` calls
- Rate limiting: 100 req/min per IP (HTTP), 30 events/min per socket (WS)
- Input size limited: JSON body max 16kb, string fields validated by `validate()` middleware

---

## Deployment

Production uses PM2 (`ecosystem.config.js`) behind Nginx (config in `deploy/nginx.conf`).

```bash
# Build frontend
cd client && npm run build

# Start server
cd server && npm install --production
pm2 start ../../ecosystem.config.js

# Or directly
NODE_ENV=production node src/index.js
```

The Express server serves the Vite-built `client/dist/` as static files in production, with SPA fallback for React Router routes.

---

## Adding New Features — Checklist

1. **Shared config** — if adding game constants (new crops, buildings, tasks), add to `shared/gameConfig.js` or `shared/tokenConfig.js`
2. **Migration** — if adding DB tables/columns, create `server/migrations/00N_description.js`
3. **Service** — add business logic in `server/src/services/`
4. **Route** — add Express router in `server/src/routes/`, mount in `index.js`
5. **Client service** — add axios API calls in `client/src/services/`
6. **Store** — add state + actions in `client/src/store/gameStore.js`
7. **Component** — add UI in `client/src/components/`
8. **Tests** — add Jest tests in `server/tests/`
