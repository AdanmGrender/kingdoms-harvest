# Hub + Instancias (molde idle grimdark) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar la entrada "mundo 160×120 paseable" por un hub-and-spoke con mapa de nodos/instancias (molde Last Asylum: Plague, 100% original), con combate round-stepped server-authoritative y tap-skills.

**Architecture:** Backend nuevo (`campaignService` + `campaignSim` puro + migración 030 + `campaignRoutes`) que modela una cadena de nodos con gating y un combate por rondas resuelto 100% server-side. Cliente nuevo (slice `campaign` en gameStore + `OperationsMap` + `CombatInstancePanel` + `BastionHub`/`QuestRail`) que consume esos endpoints. Se reusan Marea Disforme, escuadras/`HERO_SKILLS`, `idleService`, `tokenService`, `dailyTaskService`. El mundo gigante se jubila detrás de bandera.

**Tech Stack:** Node/Express, sql.js query builder, Jest (DB in-memory), React 18 + Zustand, Phaser 3.90, EventBridge.

## Global Constraints

- **Regla IP (verbatim):** grimdark 40k-INSPIRADO pero 100% ORIGINAL. Cero marcas de Games Workshop; cero contenido/nombres de Last Asylum: Plague. Se copia el patrón mecánico, no el contenido.
- **DB:** todo acceso vía el query builder de `server/src/config/database.js`. NUNCA sql.js directo. SQLite: `MIN/MAX` escalares (no LEAST/GREATEST), resultado de UPDATE → `.count`.
- **Rutas:** toda ruta usa `telegramAuth` + `validate()`. Strings de usuario con `maxLength ≤ 100`. Errores vía `safeErrorMessage`. Nunca exponer stack ni IDs internos.
- **Dinero real:** el resultado de combate y las recompensas se calculan SIEMPRE server-side. Un `runId` premia UNA sola vez (claim atómico). Recompensa sale del catálogo `CAMPAIGN`, nunca del request. KH sólo vía `tokenService.awardTokens` (source `wave_defense`).
- **Migraciones:** archivo `030_campaign_progress.js`, `exports.up/down` async con `db.raw`. Índice en toda columna `player_id` (`CREATE INDEX IF NOT EXISTS`).
- **Tests:** Jest en `server/tests/`, DB in-memory (`NODE_ENV=test`, `tests/setup.js` corre migraciones). Mantener verde la suite existente + los nuevos.

---

## File Structure

**Backend (nuevo):**
- `server/src/services/campaignSim.js` — simulación de combate por rondas, PURA (sin DB). Testeable en aislamiento.
- `server/src/services/campaignService.js` — gating, seed, enter, step, clear (con DB).
- `server/src/routes/campaignRoutes.js` — endpoints `/api/campaign/{map,enter,step}`.
- `server/migrations/030_campaign_progress.js` — tablas `player_campaign_progress` + `campaign_runs`.

**Backend (modificado):**
- `shared/gameConfig.js` — agregar `CAMPAIGN` (nodos acto 1) al export.
- `server/src/index.js` — montar `/api/campaign`.

**Cliente (nuevo):**
- `client/src/components/campaign/OperationsMap.jsx` — selector de nodos.
- `client/src/components/campaign/CombatInstancePanel.jsx` — replay round-stepped + tap-skill.
- `client/src/components/hub/BastionHub.jsx` — pantalla-ancla (hub).
- `client/src/components/hub/QuestRail.jsx` — riel de marcadores.

**Cliente (modificado):**
- `client/src/store/gameStore.js` — slice `campaign`.
- `client/src/components/overlay/OverlayManager.jsx` — registrar `operations` + `combat_instance`.
- `client/src/App.jsx` — entrada por defecto = hub (mundo 160×120 tras bandera).
- `client/src/game/scenes/WorldScene.js` + `client/src/game/systems/CameraSystem.js` — modo hub (cámara fija, streaming off) tras `registry.hubMode`.

**Tests (nuevo):**
- `server/tests/campaignSim.test.js`
- `server/tests/campaignService.test.js`

---

## Task 1: Config de nodos `CAMPAIGN` (acto 1)

**Files:**
- Modify: `shared/gameConfig.js` (agregar `const CAMPAIGN` + incluir en `module.exports`)
- Test: `server/tests/campaignService.test.js` (bloque "config")

**Interfaces:**
- Produces: `CAMPAIGN` — array de nodos. Cada nodo:
  `{ id: string, act: number, type: 'manage'|'collect'|'combat'|'wave'|'boss', name: string, requires: string[], unlocks: string[], enemy?: {hp:number,dps:number}, maxRounds?: number, isBoss?: boolean, manage?: {type:'building_level',min:number,hint:string,panel:string}, rewards: {kh?:number, resources?:Record<string,number>} }`

- [ ] **Step 1: Write the failing test**

En `server/tests/campaignService.test.js`:

```js
const { CAMPAIGN } = require('../../shared/gameConfig');

describe('CAMPAIGN config', () => {
  test('ids únicos y unlocks referencian nodos válidos', () => {
    const ids = CAMPAIGN.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
    const idSet = new Set(ids);
    for (const n of CAMPAIGN) {
      for (const u of n.unlocks) expect(idSet.has(u)).toBe(true);
    }
  });
  test('el primer nodo no requiere nada y hay al menos un boss', () => {
    expect(CAMPAIGN[0].requires).toEqual([]);
    expect(CAMPAIGN.some((n) => n.type === 'boss')).toBe(true);
  });
  test('todo nodo de combate tiene enemy + maxRounds', () => {
    for (const n of CAMPAIGN.filter((x) => ['combat', 'wave', 'boss'].includes(x.type))) {
      expect(n.enemy.hp).toBeGreaterThan(0);
      expect(n.enemy.dps).toBeGreaterThan(0);
      expect(n.maxRounds).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest tests/campaignService.test.js -t "CAMPAIGN config"`
Expected: FAIL — `CAMPAIGN` is undefined.

- [ ] **Step 3: Write minimal implementation**

En `shared/gameConfig.js`, antes del `module.exports`, agregar:

```js
// ── CAMPAÑA (acto 1) — cadena de nodos que reemplaza el mundo paseable ──────
// Tipos alternan sobre un riel; boss cada ~5 nodos. Números placeholder,
// se afinan con playtest. Contenido 100% original (regla IP).
const CAMPAIGN = [
  { id: 'a1n1', act: 1, type: 'manage', name: 'Despertar del Bastión',
    requires: [], unlocks: ['a1n2'],
    manage: { type: 'building_level', min: 2, hint: 'Mejorá cualquier edificio a nivel 2', panel: 'building' },
    rewards: { kh: 2, resources: { gold: 100 } } },
  { id: 'a1n2', act: 1, type: 'collect', name: 'Cosecha en la Niebla',
    requires: ['a1n1'], unlocks: ['a1n3'], rewards: { kh: 2, resources: { gold: 80 } } },
  { id: 'a1n3', act: 1, type: 'combat', name: 'Merodeadores del Páramo',
    requires: ['a1n2'], unlocks: ['a1n4'], enemy: { hp: 400, dps: 22 }, maxRounds: 8,
    rewards: { kh: 3, resources: { gold: 150 } } },
  { id: 'a1n4', act: 1, type: 'wave', name: 'Marea Menor',
    requires: ['a1n3'], unlocks: ['a1n5'], enemy: { hp: 650, dps: 30 }, maxRounds: 10,
    rewards: { kh: 4, resources: { crystal: 1 } } },
  { id: 'a1n5', act: 1, type: 'boss', name: 'El Heraldo Putrefacto',
    requires: ['a1n4'], unlocks: ['a1n6'], enemy: { hp: 1200, dps: 45 }, maxRounds: 12, isBoss: true,
    rewards: { kh: 10, resources: { relic: 1 } } },
  { id: 'a1n6', act: 1, type: 'manage', name: 'Reforzar Murallas',
    requires: ['a1n5'], unlocks: ['a1n7'],
    manage: { type: 'building_level', min: 3, hint: 'Mejorá cualquier edificio a nivel 3', panel: 'building' },
    rewards: { kh: 3 } },
  { id: 'a1n7', act: 1, type: 'combat', name: 'Carroñeros',
    requires: ['a1n6'], unlocks: ['a1n8'], enemy: { hp: 900, dps: 40 }, maxRounds: 9,
    rewards: { kh: 5, resources: { gold: 300 } } },
  { id: 'a1n8', act: 1, type: 'wave', name: 'Marea Creciente',
    requires: ['a1n7'], unlocks: ['a1n9'], enemy: { hp: 1400, dps: 55 }, maxRounds: 11,
    rewards: { kh: 6, resources: { crystal: 2 } } },
  { id: 'a1n9', act: 1, type: 'boss', name: 'Devorador de Almas',
    requires: ['a1n8'], unlocks: [], enemy: { hp: 2400, dps: 70 }, maxRounds: 14, isBoss: true,
    rewards: { kh: 20, resources: { relic: 2, blueprint: 1 } } },
];
```

Y en el `module.exports = { ... }` agregar `CAMPAIGN,` junto a los demás (p.ej. al lado de `HERO_SKILLS,`).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest tests/campaignService.test.js -t "CAMPAIGN config"`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add shared/gameConfig.js server/tests/campaignService.test.js
git commit -m "feat(campaign): config de nodos del acto 1 (CAMPAIGN)"
```

---

## Task 2: Migración 030 (progreso + runs)

**Files:**
- Create: `server/migrations/030_campaign_progress.js`
- Test: `server/tests/campaignService.test.js` (bloque "migración")

**Interfaces:**
- Produces: tablas `player_campaign_progress (player_id, node_id, status, cleared_at; UNIQUE(player_id,node_id))` y `campaign_runs (id, player_id, node_id, status, state, created_at)`.

- [ ] **Step 1: Write the failing test**

Agregar a `server/tests/campaignService.test.js`:

```js
const db = require('../src/config/database');
const { initTestDb, seedTestData } = require('./setup');

beforeAll(async () => { await initTestDb(); await seedTestData(); });

describe('migración 030', () => {
  test('las tablas de campaña existen y aceptan inserts', async () => {
    await db('player_campaign_progress').insert({ player_id: 999, node_id: 'a1n1', status: 'available' });
    const row = await db('player_campaign_progress').where({ player_id: 999, node_id: 'a1n1' }).first();
    expect(row.status).toBe('available');

    const [{ id }] = await db('campaign_runs').insert({
      player_id: 999, node_id: 'a1n3', status: 'active', state: '{}', created_at: new Date().toISOString(),
    }).returning('id');
    expect(id).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest tests/campaignService.test.js -t "migración 030"`
Expected: FAIL — `no such table: player_campaign_progress`.

- [ ] **Step 3: Write minimal implementation**

Crear `server/migrations/030_campaign_progress.js`:

```js
// Rework hub+instancias: progreso de campaña por nodo + runs de combate stepped.
exports.up = async function (db) {
  await db.raw(`CREATE TABLE IF NOT EXISTS "player_campaign_progress" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "player_id" BIGINT NOT NULL,
    "node_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'locked',
    "cleared_at" TEXT,
    UNIQUE ("player_id", "node_id")
  )`);
  await db.raw('CREATE INDEX IF NOT EXISTS idx_campaign_progress_player ON "player_campaign_progress" ("player_id")');

  await db.raw(`CREATE TABLE IF NOT EXISTS "campaign_runs" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "player_id" BIGINT NOT NULL,
    "node_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "state" TEXT NOT NULL DEFAULT '{}',
    "created_at" TEXT NOT NULL
  )`);
  await db.raw('CREATE INDEX IF NOT EXISTS idx_campaign_runs_player ON "campaign_runs" ("player_id", "id")');
};

exports.down = async function (db) {
  await db.raw('DROP INDEX IF EXISTS idx_campaign_progress_player');
  await db.raw('DROP TABLE IF EXISTS "player_campaign_progress"');
  await db.raw('DROP INDEX IF EXISTS idx_campaign_runs_player');
  await db.raw('DROP TABLE IF EXISTS "campaign_runs"');
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest tests/campaignService.test.js -t "migración 030"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/migrations/030_campaign_progress.js server/tests/campaignService.test.js
git commit -m "feat(campaign): migración 030 (progreso de nodos + runs)"
```

---

## Task 3: Simulación de combate PURA (`campaignSim`)

**Files:**
- Create: `server/src/services/campaignSim.js`
- Test: `server/tests/campaignSim.test.js`

**Interfaces:**
- Produces:
  - `simulateRound(state, action) → { state, result }` con `result ∈ null|'victory'|'defeat'`.
  - `action = { type:'advance' } | { type:'skill', slot:number }`.
  - `state` shape: `{ round, maxRounds, isBoss, shield, heroes:[{slot,heroId,class,name,atk,hp,maxHp,energy,energyMax,skill:{id,type,mult},alive}], enemy:{hp,maxHp,dps}, log:[] }`.
  - Constantes `ENERGY_PER_ROUND=34`, `ENERGY_MAX=100`.

- [ ] **Step 1: Write the failing test**

Crear `server/tests/campaignSim.test.js`:

```js
const { simulateRound, ENERGY_MAX } = require('../src/services/campaignSim');

function baseState(over = {}) {
  return {
    round: 0, maxRounds: 8, isBoss: false, shield: 0,
    heroes: [{ slot: 1, heroId: 'h', class: 'warrior', name: 'H', atk: 50, hp: 100, maxHp: 100,
      energy: 0, energyMax: ENERGY_MAX, skill: { id: 'golpe', type: 'damage', mult: 2 }, alive: true }],
    enemy: { hp: 120, maxHp: 120, dps: 10 }, log: [],
    ...over,
  };
}

describe('campaignSim.simulateRound', () => {
  test('advance: héroes pegan, cargan energía, enemigo pega', () => {
    const { state, result } = simulateRound(baseState(), { type: 'advance' });
    expect(state.enemy.hp).toBe(70);          // 120 - 50
    expect(state.heroes[0].energy).toBe(34);  // +ENERGY_PER_ROUND
    expect(state.heroes[0].hp).toBe(90);      // 100 - 10 dps
    expect(state.round).toBe(1);
    expect(result).toBeNull();
  });

  test('victoria cuando el enemigo llega a 0', () => {
    const { result } = simulateRound(baseState({ enemy: { hp: 40, maxHp: 120, dps: 10 } }), { type: 'advance' });
    expect(result).toBe('victory');
  });

  test('skill de daño requiere energía llena y aplica multiplicador', () => {
    const st = baseState({ enemy: { hp: 500, maxHp: 500, dps: 10 } });
    st.heroes[0].energy = ENERGY_MAX;
    const { state } = simulateRound(st, { type: 'skill', slot: 1 });
    // skill 50*2=100, luego ataque normal 50 => 500-100-50 = 350
    expect(state.enemy.hp).toBe(350);
    expect(state.heroes[0].energy).toBe(34); // reseteó a 0 y cargó la ronda
  });

  test('skill sin energía lanza error', () => {
    expect(() => simulateRound(baseState(), { type: 'skill', slot: 1 })).toThrow(/energía/i);
  });

  test('escudo reduce el golpe enemigo de la ronda', () => {
    const st = baseState({ enemy: { hp: 500, maxHp: 500, dps: 100 } });
    st.heroes[0].energy = ENERGY_MAX;
    st.heroes[0].skill = { id: 'esc', type: 'shield', mult: 0.30 };
    const { state } = simulateRound(st, { type: 'skill', slot: 1 });
    expect(state.heroes[0].hp).toBe(30); // 100 - (100*0.7)
  });

  test('ejecución pega ×4 a boss, ×2 al resto', () => {
    const st = baseState({ isBoss: true, enemy: { hp: 1000, maxHp: 1000, dps: 1 } });
    st.heroes[0].energy = ENERGY_MAX;
    st.heroes[0].skill = { id: 'ej', type: 'execute', mult: 4 };
    const { state } = simulateRound(st, { type: 'skill', slot: 1 });
    // ejecución 50*4=200, + ataque 50 => 1000-200-50=750
    expect(state.enemy.hp).toBe(750);
  });

  test('derrota si mueren todos los héroes', () => {
    const st = baseState({ enemy: { hp: 999, maxHp: 999, dps: 1000 } });
    const { result } = simulateRound(st, { type: 'advance' });
    expect(result).toBe('defeat');
  });

  test('derrota por timeout al llegar a maxRounds sin matar', () => {
    const st = baseState({ round: 7, maxRounds: 8, enemy: { hp: 999, maxHp: 999, dps: 1 } });
    const { result } = simulateRound(st, { type: 'advance' });
    expect(result).toBe('defeat');
  });

  test('no muta el estado de entrada (determinista)', () => {
    const st = baseState();
    simulateRound(st, { type: 'advance' });
    expect(st.round).toBe(0);
    expect(st.enemy.hp).toBe(120);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest tests/campaignSim.test.js`
Expected: FAIL — cannot find module `campaignSim`.

- [ ] **Step 3: Write minimal implementation**

Crear `server/src/services/campaignSim.js`:

```js
// Simulación de combate por rondas, PURA (sin DB) para testeo determinista.
// El servidor es la autoridad: el cliente sólo manda intención (action).
const ENERGY_MAX = 100;
const ENERGY_PER_ROUND = 34; // ~3 rondas para cargar una ultimate

function applySkill(s, slot) {
  const hero = s.heroes.find((h) => h.slot === slot && h.alive);
  if (!hero) throw new Error('Héroe inválido para la habilidad');
  if (hero.energy < ENERGY_MAX) throw new Error('Energía insuficiente');
  const sk = hero.skill;
  if (sk.type === 'damage') {
    s.enemy.hp -= Math.round(hero.atk * sk.mult);
  } else if (sk.type === 'execute') {
    s.enemy.hp -= Math.round(hero.atk * (s.isBoss ? 4 : 2));
  } else if (sk.type === 'shield') {
    s.shield = sk.mult; // reduce el golpe enemigo de ESTA ronda
  }
  hero.energy = 0;
}

function finish(s, result) {
  s.log.push({ round: s.round, result });
  return { state: s, result };
}

// Resuelve UNA ronda. Devuelve { state, result }.
function simulateRound(state, action) {
  const s = JSON.parse(JSON.stringify(state)); // clon: no muta el input

  if (action && action.type === 'skill') {
    applySkill(s, action.slot);
    if (s.enemy.hp <= 0) return finish(s, 'victory');
  }

  // 1) héroes pegan + cargan energía
  for (const h of s.heroes) {
    if (!h.alive) continue;
    s.enemy.hp -= h.atk;
    h.energy = Math.min(ENERGY_MAX, h.energy + ENERGY_PER_ROUND);
  }
  if (s.enemy.hp <= 0) return finish(s, 'victory');

  // 2) enemigo pega (aplicando escudo si hubo)
  let dmg = Math.round(s.enemy.dps * (1 - (s.shield || 0)));
  s.shield = 0;
  for (const h of s.heroes) {
    if (dmg <= 0) break;
    if (!h.alive) continue;
    const applied = Math.min(dmg, h.hp);
    h.hp -= applied;
    dmg -= applied;
    if (h.hp <= 0) h.alive = false;
  }

  s.round += 1;
  s.log.push({
    round: s.round,
    enemyHp: Math.max(0, s.enemy.hp),
    heroes: s.heroes.map((h) => ({ slot: h.slot, hp: Math.max(0, h.hp), energy: h.energy, alive: h.alive })),
  });

  if (!s.heroes.some((h) => h.alive)) return finish(s, 'defeat');
  if (s.round >= s.maxRounds) return finish(s, 'defeat');
  return { state: s, result: null };
}

module.exports = { simulateRound, applySkill, ENERGY_MAX, ENERGY_PER_ROUND };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest tests/campaignSim.test.js`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add server/src/services/campaignSim.js server/tests/campaignSim.test.js
git commit -m "feat(campaign): motor de combate por rondas puro (campaignSim)"
```

---

## Task 4: `campaignService` — seed, mapa y gating

**Files:**
- Create: `server/src/services/campaignService.js`
- Test: `server/tests/campaignService.test.js` (bloque "mapa y gating")

**Interfaces:**
- Consumes: `CAMPAIGN` (Task 1), `db` (query builder).
- Produces:
  - `getMap(playerId) → [{ id, type, name, act, isBoss, status:'cleared'|'available'|'locked', rewards }]`
  - `_ensureSeeded(playerId)` — inserta el nodo 1 como `available` si no hay progreso.
  - `_clearNode(playerId, node) → { alreadyCleared:boolean, unlocked:string[] }` (atómico, idempotente).

- [ ] **Step 1: Write the failing test**

Agregar a `server/tests/campaignService.test.js`:

```js
const campaignService = require('../src/services/campaignService');

async function freshPlayer(id) {
  await db('players').where('telegram_id', id).delete();
  await db('player_campaign_progress').where('player_id', id).delete();
  await db('players').insert({ telegram_id: id, username: 'c', first_name: 'C', display_name: 'C',
    level: 5, xp: 0, created_at: new Date().toISOString() });
}

describe('campaignService mapa y gating', () => {
  test('jugador nuevo: nodo 1 available, resto locked', async () => {
    await freshPlayer(770001);
    const map = await campaignService.getMap(770001);
    expect(map[0].status).toBe('available');
    expect(map[1].status).toBe('locked');
  });

  test('_clearNode marca cleared y desbloquea el siguiente (idempotente)', async () => {
    await freshPlayer(770002);
    await campaignService.getMap(770002); // siembra
    const node = require('../../shared/gameConfig').CAMPAIGN[0];
    const r1 = await campaignService._clearNode(770002, node);
    expect(r1.alreadyCleared).toBe(false);
    expect(r1.unlocked).toContain('a1n2');
    const r2 = await campaignService._clearNode(770002, node); // segundo intento
    expect(r2.alreadyCleared).toBe(true); // no re-otorga
    const map = await campaignService.getMap(770002);
    expect(map[0].status).toBe('cleared');
    expect(map[1].status).toBe('available');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest tests/campaignService.test.js -t "mapa y gating"`
Expected: FAIL — cannot find module `campaignService`.

- [ ] **Step 3: Write minimal implementation**

Crear `server/src/services/campaignService.js` (parte 1 — el resto se agrega en Tasks 5-6):

```js
const db = require('../config/database');
const { CAMPAIGN, HERO_SKILLS } = require('../../../shared/gameConfig');
const { simulateRound } = require('./campaignSim');

// Lazy requires (evitan ciclos con token/hero/daily services)
let _token, _hero, _daily, _player;
const tokenService = () => (_token ||= require('./tokenService'));
const heroService  = () => (_hero  ||= require('./heroService'));
const dailyService = () => (_daily ||= require('./dailyTaskService'));
const playerService = () => (_player ||= require('./playerService'));

const nodeById = (id) => CAMPAIGN.find((n) => n.id === id);
const isCombat = (n) => ['combat', 'wave', 'boss'].includes(n.type);

const campaignService = {
  async _ensureSeeded(playerId) {
    const any = await db('player_campaign_progress').where('player_id', playerId).first();
    if (any) return;
    await db('player_campaign_progress').insert({
      player_id: playerId, node_id: CAMPAIGN[0].id, status: 'available',
    });
  },

  async getMap(playerId) {
    await this._ensureSeeded(playerId);
    const rows = await db('player_campaign_progress').where('player_id', playerId);
    const statusById = new Map((Array.isArray(rows) ? rows : []).map((r) => [r.node_id, r.status]));
    return CAMPAIGN.map((n) => ({
      id: n.id, type: n.type, name: n.name, act: n.act, isBoss: !!n.isBoss,
      status: statusById.get(n.id) || 'locked', rewards: n.rewards,
    }));
  },

  // Claim atómico + recompensa (una vez) + desbloqueo de siguientes.
  async _clearNode(playerId, node) {
    const claimed = await db('player_campaign_progress')
      .where({ player_id: playerId, node_id: node.id, status: 'available' })
      .update({ status: 'cleared', cleared_at: new Date().toISOString() });
    if (!claimed) return { alreadyCleared: true, unlocked: [] };

    if (node.rewards?.kh) {
      await tokenService().awardTokens(playerId, node.rewards.kh, 'wave_defense');
    }
    if (node.rewards?.resources) {
      for (const [rid, amt] of Object.entries(node.rewards.resources)) {
        await playerService().modifyResource(playerId, rid, amt);
      }
    }
    if (isCombat(node)) {
      try { await dailyService().trackProgress(playerId, 'battle_win', 1); } catch { /* no crítico */ }
    }

    const unlocked = [];
    for (const nextId of (node.unlocks || [])) {
      const exists = await db('player_campaign_progress').where({ player_id: playerId, node_id: nextId }).first();
      if (!exists) {
        await db('player_campaign_progress').insert({ player_id: playerId, node_id: nextId, status: 'available' });
        unlocked.push(nextId);
      }
    }
    return { alreadyCleared: false, unlocked };
  },
};

module.exports = campaignService;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest tests/campaignService.test.js -t "mapa y gating"`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add server/src/services/campaignService.js server/tests/campaignService.test.js
git commit -m "feat(campaign): campaignService seed/mapa/gating (_clearNode idempotente)"
```

---

## Task 5: `campaignService.enterNode` (entrada por tipo)

**Files:**
- Modify: `server/src/services/campaignService.js` (agregar `_checkManage`, `_buildCombatState`, `enterNode`)
- Test: `server/tests/campaignService.test.js` (bloque "enterNode")

**Interfaces:**
- Consumes: `heroService().getSquad`, `HERO_SKILLS`, `_clearNode`.
- Produces: `enterNode(playerId, nodeId) → union`:
  - `{ kind:'combat', runId:number, node:{id,name,type}, state }`
  - `{ kind:'cleared', node, unlocked:string[] }`
  - `{ kind:'blocked', node, hint:string, panel:string }`

- [ ] **Step 1: Write the failing test**

Agregar a `server/tests/campaignService.test.js`:

```js
describe('campaignService enterNode', () => {
  test('nodo bloqueado lanza', async () => {
    await freshPlayer(770010);
    await campaignService.getMap(770010);
    await expect(campaignService.enterNode(770010, 'a1n9')).rejects.toThrow(/bloqueado/i);
  });

  test('collect se limpia al entrar y desbloquea el siguiente', async () => {
    await freshPlayer(770011);
    await campaignService.getMap(770011);
    // limpiar n1 (manage) directo para llegar a n2 (collect)
    await campaignService._clearNode(770011, require('../../shared/gameConfig').CAMPAIGN[0]);
    const res = await campaignService.enterNode(770011, 'a1n2');
    expect(res.kind).toBe('cleared');
    const map = await campaignService.getMap(770011);
    expect(map.find((n) => n.id === 'a1n3').status).toBe('available');
  });

  test('manage sin condición cumplida devuelve blocked', async () => {
    await freshPlayer(770012);
    await campaignService.getMap(770012); // n1 available, sin edificios
    const res = await campaignService.enterNode(770012, 'a1n1');
    expect(res.kind).toBe('blocked');
    expect(res.panel).toBe('building');
  });

  test('combat crea un run con snapshot de escuadra (o guarnición default)', async () => {
    await freshPlayer(770013);
    await campaignService.getMap(770013);
    await campaignService._clearNode(770013, require('../../shared/gameConfig').CAMPAIGN[0]); // n1
    await campaignService.enterNode(770013, 'a1n2'); // collect -> desbloquea n3
    const res = await campaignService.enterNode(770013, 'a1n3');
    expect(res.kind).toBe('combat');
    expect(res.runId).toBeGreaterThan(0);
    expect(res.state.heroes.length).toBeGreaterThanOrEqual(1);
    expect(res.state.enemy.hp).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest tests/campaignService.test.js -t "enterNode"`
Expected: FAIL — `enterNode is not a function`.

- [ ] **Step 3: Write minimal implementation**

En `server/src/services/campaignService.js`, agregar estos métodos dentro del objeto `campaignService` (antes del cierre `};`):

```js
  async _checkManage(playerId, node) {
    const c = node.manage;
    if (c && c.type === 'building_level') {
      const row = await db('player_buildings')
        .where('player_id', playerId).where('level', '>=', c.min).first();
      return !!row;
    }
    return true;
  },

  async _buildCombatState(playerId, node) {
    let squad = [];
    try { squad = await heroService().getSquad(playerId); } catch { squad = []; }
    let heroes = (Array.isArray(squad) ? squad : [])
      .filter((h) => !h.recovering)
      .map((h) => ({
        slot: h.slot, heroId: h.heroId, class: h.class, name: h.name,
        atk: h.stats.atk, hp: h.stats.hp, maxHp: h.stats.hp,
        energy: 0, energyMax: 100,
        skill: HERO_SKILLS[h.class] || HERO_SKILLS.warrior, alive: true,
      }));
    if (heroes.length === 0) {
      heroes = [{ slot: 1, heroId: null, class: 'warrior', name: 'Guarnición',
        atk: 30, hp: 200, maxHp: 200, energy: 0, energyMax: 100,
        skill: HERO_SKILLS.warrior, alive: true }];
    }
    return {
      round: 0, maxRounds: node.maxRounds, isBoss: !!node.isBoss, shield: 0,
      heroes, enemy: { hp: node.enemy.hp, maxHp: node.enemy.hp, dps: node.enemy.dps }, log: [],
    };
  },

  async enterNode(playerId, nodeId) {
    await this._ensureSeeded(playerId);
    const node = nodeById(nodeId);
    if (!node) throw new Error('Nodo inexistente');
    const prog = await db('player_campaign_progress')
      .where({ player_id: playerId, node_id: nodeId }).first();
    if (!prog || prog.status === 'locked') throw new Error('Nodo bloqueado');

    if (node.type === 'collect') {
      const r = await this._clearNode(playerId, node);
      return { kind: 'cleared', node: { id: node.id, name: node.name, type: node.type }, unlocked: r.unlocked };
    }
    if (node.type === 'manage') {
      const ok = await this._checkManage(playerId, node);
      if (!ok) return { kind: 'blocked', node: { id: node.id, name: node.name, type: node.type },
        hint: node.manage.hint, panel: node.manage.panel };
      const r = await this._clearNode(playerId, node);
      return { kind: 'cleared', node: { id: node.id, name: node.name, type: node.type }, unlocked: r.unlocked };
    }

    // combat / wave / boss
    const state = await this._buildCombatState(playerId, node);
    const [{ id: runId }] = await db('campaign_runs').insert({
      player_id: playerId, node_id: nodeId, status: 'active',
      state: JSON.stringify(state), created_at: new Date().toISOString(),
    }).returning('id');
    return { kind: 'combat', runId, node: { id: node.id, name: node.name, type: node.type }, state };
  },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest tests/campaignService.test.js -t "enterNode"`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add server/src/services/campaignService.js server/tests/campaignService.test.js
git commit -m "feat(campaign): enterNode por tipo (collect/manage/combat)"
```

---

## Task 6: `campaignService.resolveStep` (rondas + award idempotente)

**Files:**
- Modify: `server/src/services/campaignService.js` (agregar `resolveStep`)
- Test: `server/tests/campaignService.test.js` (bloque "resolveStep")

**Interfaces:**
- Consumes: `simulateRound` (Task 3), `_clearNode` (Task 4).
- Produces: `resolveStep(playerId, runId, action) → { state, roundLog, result:null|'victory'|'defeat', unlocked:string[] }`.

- [ ] **Step 1: Write the failing test**

Agregar a `server/tests/campaignService.test.js`:

```js
describe('campaignService resolveStep', () => {
  async function reachCombat(id) {
    await freshPlayer(id);
    await campaignService.getMap(id);
    await campaignService._clearNode(id, require('../../shared/gameConfig').CAMPAIGN[0]);
    await campaignService.enterNode(id, 'a1n2');
    return campaignService.enterNode(id, 'a1n3'); // combat run
  }

  test('avanzar rondas hasta victoria otorga y desbloquea UNA vez', async () => {
    const run = await reachCombat(770020);
    let result = null, guard = 0;
    while (!result && guard++ < 100) {
      const r = await campaignService.resolveStep(770020, run.runId, { type: 'advance' });
      result = r.result;
    }
    expect(result).toBe('victory');
    const map = await campaignService.getMap(770020);
    expect(map.find((n) => n.id === 'a1n3').status).toBe('cleared');
    expect(map.find((n) => n.id === 'a1n4').status).toBe('available');
    // otro step sobre el run terminado falla (no re-otorga)
    await expect(campaignService.resolveStep(770020, run.runId, { type: 'advance' }))
      .rejects.toThrow(/terminó/i);
  });

  test('skill sin energía se rechaza como error de negocio', async () => {
    const run = await reachCombat(770021);
    await expect(campaignService.resolveStep(770021, run.runId, { type: 'skill', slot: 1 }))
      .rejects.toThrow(/energía/i);
  });

  test('run ajeno no se puede tocar', async () => {
    const run = await reachCombat(770022);
    await freshPlayer(770023);
    await expect(campaignService.resolveStep(770023, run.runId, { type: 'advance' }))
      .rejects.toThrow(/inexistente/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest tests/campaignService.test.js -t "resolveStep"`
Expected: FAIL — `resolveStep is not a function`.

- [ ] **Step 3: Write minimal implementation**

En `server/src/services/campaignService.js`, agregar dentro del objeto:

```js
  async resolveStep(playerId, runId, action) {
    const run = await db('campaign_runs').where({ id: runId, player_id: playerId }).first();
    if (!run) throw new Error('Run inexistente');
    if (run.status !== 'active') throw new Error('Este combate ya terminó');

    const state = JSON.parse(run.state);
    const node = nodeById(run.node_id);
    const out = simulateRound(state, action); // puede lanzar (energía insuficiente)

    await db('campaign_runs').where('id', runId).update({ state: JSON.stringify(out.state) });

    let unlocked = [];
    if (out.result) {
      // claim atómico: sólo el primero que cierra el run otorga
      const claimed = await db('campaign_runs')
        .where({ id: runId, status: 'active' }).update({ status: out.result });
      if (claimed && out.result === 'victory') {
        const r = await this._clearNode(playerId, node);
        unlocked = r.unlocked;
      }
    }
    const roundLog = out.state.log[out.state.log.length - 1] || null;
    return { state: out.state, roundLog, result: out.result, unlocked };
  },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest tests/campaignService.test.js`
Expected: PASS (todos los bloques del archivo).

- [ ] **Step 5: Commit**

```bash
git add server/src/services/campaignService.js server/tests/campaignService.test.js
git commit -m "feat(campaign): resolveStep con award idempotente por run"
```

---

## Task 7: Rutas `/api/campaign` + montaje

**Files:**
- Create: `server/src/routes/campaignRoutes.js`
- Modify: `server/src/index.js` (require + mount)
- Test: (verificación por driver en Task 12; wiring sin lógica nueva)

**Interfaces:**
- Consumes: `campaignService` (Tasks 4-6).
- Produces: `GET /api/campaign/map`, `POST /api/campaign/enter`, `POST /api/campaign/step`.

- [ ] **Step 1: Write the route file**

Crear `server/src/routes/campaignRoutes.js`:

```js
const express = require('express');
const router = express.Router();
const { telegramAuth } = require('../middleware/telegramAuth');
const { validate } = require('../middleware/validate');
const { safeErrorMessage } = require('../middleware/errorHandler');
const campaignService = require('../services/campaignService');

router.get('/map', telegramAuth, async (req, res) => {
  try {
    res.json({ nodes: await campaignService.getMap(req.playerId) });
  } catch (error) { res.status(400).json({ error: safeErrorMessage(error) }); }
});

router.post('/enter', telegramAuth, validate({
  nodeId: { type: 'string', required: true, maxLength: 40 },
}), async (req, res) => {
  try {
    res.json(await campaignService.enterNode(req.playerId, req.body.nodeId));
  } catch (error) { res.status(400).json({ error: safeErrorMessage(error) }); }
});

router.post('/step', telegramAuth, validate({
  runId: { type: 'number', required: true },
  actionType: { type: 'string', required: true, maxLength: 10 },
  slot: { type: 'number', required: false, min: 1, max: 5 },
}), async (req, res) => {
  try {
    const action = req.body.actionType === 'skill'
      ? { type: 'skill', slot: req.body.slot }
      : { type: 'advance' };
    res.json(await campaignService.resolveStep(req.playerId, req.body.runId, action));
  } catch (error) { res.status(400).json({ error: safeErrorMessage(error) }); }
});

module.exports = router;
```

- [ ] **Step 2: Mount in index.js**

En `server/src/index.js`, junto a los otros `const ... = require('./routes/...')` agregar:

```js
const campaignRoutes = require('./routes/campaignRoutes');
```

Y junto a los otros `app.use('/api/...')` agregar:

```js
app.use('/api/campaign', campaignRoutes);
```

- [ ] **Step 3: Smoke-test manual con el driver del server**

Run (una terminal):
```bash
cd server && SKIP_AUTH=true BOT_POLLING=false node src/index.js
```
Run (otra terminal):
```bash
curl -s -X POST http://localhost:3001/api/campaign/enter -H "Content-Type: application/json" -H "x-skip-auth: true" -d '{"nodeId":"a1n1"}'
```
Expected: JSON con `{"kind":"blocked",...}` o `{"kind":"cleared",...}` (no 404, no stack trace).

- [ ] **Step 4: Verify the full suite still passes**

Run: `cd server && npm test`
Expected: PASS (suite existente + campaignSim + campaignService).

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/campaignRoutes.js server/src/index.js
git commit -m "feat(campaign): rutas /api/campaign (map/enter/step) montadas"
```

---

## Task 8: Slice `campaign` en gameStore

**Files:**
- Modify: `client/src/store/gameStore.js` (agregar slice + acciones)
- Test: (manual vía UI en Tasks 9-11; el store sigue el patrón de slices existentes)

**Interfaces:**
- Consumes: `api` (axios), endpoints Task 7.
- Produces (en el store): `campaignNodes`, `activeRun`, `loadCampaignMap()`, `enterNode(nodeId)`, `stepInstance(action)`.

- [ ] **Step 1: Add the slice**

En `client/src/store/gameStore.js`, dentro del objeto del store (junto a otros slices, p.ej. cerca de `loadWaveStatus`), agregar estado y acciones:

```js
  // ── Campaña (hub + instancias) ──────────────────────────────────────────
  campaignNodes: [],
  activeRun: null, // { runId, node, state } durante un combate

  loadCampaignMap: async () => {
    try {
      const { data } = await api.get('/campaign/map');
      set({ campaignNodes: data.nodes });
      return data.nodes;
    } catch (e) { console.error('loadCampaignMap', e); return []; }
  },

  enterNode: async (nodeId) => {
    const { data } = await api.post('/campaign/enter', { nodeId });
    if (data.kind === 'combat') {
      set({ activeRun: { runId: data.runId, node: data.node, state: data.state } });
    } else if (data.kind === 'cleared') {
      await get().loadCampaignMap();
    }
    return data; // el panel decide qué mostrar (combat / cleared / blocked)
  },

  stepInstance: async (action) => {
    const run = get().activeRun;
    if (!run) return null;
    const { data } = await api.post('/campaign/step', {
      runId: run.runId,
      actionType: action.type,
      slot: action.slot,
    });
    set({ activeRun: { ...run, state: data.state } });
    if (data.result) await get().loadCampaignMap(); // refrescar candados al terminar
    return data; // { state, roundLog, result, unlocked }
  },

  clearActiveRun: () => set({ activeRun: null }),
```

- [ ] **Step 2: Verify the store still imports/builds**

Run: `cd client && npm run build`
Expected: build OK (sin errores de sintaxis).

- [ ] **Step 3: Commit**

```bash
git add client/src/store/gameStore.js
git commit -m "feat(campaign): slice campaign en gameStore (map/enter/step)"
```

---

## Task 9: `OperationsMap` (selector de nodos)

**Files:**
- Create: `client/src/components/campaign/OperationsMap.jsx`
- Modify: `client/src/components/overlay/OverlayManager.jsx` (registrar `case 'operations'`)
- Test: (visual vía driver Task 12)

**Interfaces:**
- Consumes: `useGameStore` (`campaignNodes`, `loadCampaignMap`, `enterNode`, `setOverlay`).
- Produces: overlay `operations`.

- [ ] **Step 1: Create the component**

Crear `client/src/components/campaign/OperationsMap.jsx`:

```jsx
import { useEffect } from 'react';
import useGameStore from '../../store/gameStore';

const TYPE_ICON = { manage: '🔧', collect: '🌾', combat: '⚔️', wave: '🌊', boss: '💀' };

export default function OperationsMap({ onClose }) {
  const nodes = useGameStore((s) => s.campaignNodes);
  const loadCampaignMap = useGameStore((s) => s.loadCampaignMap);
  const enterNode = useGameStore((s) => s.enterNode);
  const setOverlay = useGameStore((s) => s.setOverlay);
  const addNotification = useGameStore((s) => s.addNotification);

  useEffect(() => { loadCampaignMap(); }, [loadCampaignMap]);

  const handleTap = async (node) => {
    if (node.status === 'locked') return;
    try {
      const res = await enterNode(node.id);
      if (res.kind === 'combat') {
        setOverlay('combat_instance', {});
      } else if (res.kind === 'blocked') {
        addNotification(res.hint, 'info');
        setOverlay(res.panel, {});
      } else if (res.kind === 'cleared') {
        addNotification(`✅ ${node.name} completado`, 'success');
      }
    } catch (e) {
      addNotification(e.response?.data?.error || 'No se pudo entrar', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex flex-col" style={{ background: 'rgba(10,10,20,0.96)' }}>
      <div className="flex justify-between items-center p-4">
        <h2 className="text-yellow-400 text-lg font-bold" style={{ fontFamily: 'MedievalSharp, serif' }}>
          🗺️ Operaciones
        </h2>
        <button onClick={onClose} className="text-gray-400 text-2xl px-2">✕</button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-8">
        <div className="flex flex-col items-center gap-2">
          {nodes.map((node, i) => {
            const locked = node.status === 'locked';
            const cleared = node.status === 'cleared';
            return (
              <div key={node.id} className="flex flex-col items-center w-full">
                <button
                  onClick={() => handleTap(node)}
                  disabled={locked}
                  className="w-full max-w-xs p-3 rounded-lg flex items-center gap-3"
                  style={{
                    background: cleared ? 'rgba(74,222,128,0.12)' : locked ? 'rgba(60,60,70,0.4)' : 'rgba(233,69,96,0.15)',
                    border: `1px solid ${cleared ? '#4ade80' : locked ? '#444' : '#e94560'}`,
                    opacity: locked ? 0.5 : 1,
                  }}
                >
                  <span className="text-2xl">{node.isBoss ? '💀' : TYPE_ICON[node.type]}</span>
                  <div className="flex-1 text-left">
                    <p className="text-white text-sm font-semibold">{node.name}</p>
                    <p className="text-gray-400 text-[10px] uppercase">{node.type}</p>
                  </div>
                  <span className="text-lg">{cleared ? '✓' : locked ? '🔒' : '▶'}</span>
                </button>
                {i < nodes.length - 1 && <div className="w-0.5 h-3" style={{ background: '#555' }} />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Register the overlay**

En `client/src/components/overlay/OverlayManager.jsx`: importar arriba
```jsx
import OperationsMap from '../campaign/OperationsMap';
```
y en el `switch (overlayState.type)` agregar (junto a los otros `case`):
```jsx
    case 'operations':
      return <OperationsMap onClose={closeOverlay} />;
```
(Usar el mismo `closeOverlay`/prop de cierre que usan los `case` vecinos en ese archivo.)

- [ ] **Step 3: Build check**

Run: `cd client && npm run build`
Expected: build OK.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/campaign/OperationsMap.jsx client/src/components/overlay/OverlayManager.jsx
git commit -m "feat(campaign): OperationsMap (selector de nodos con candados)"
```

---

## Task 10: `CombatInstancePanel` (replay round-stepped + tap-skill)

**Files:**
- Create: `client/src/components/campaign/CombatInstancePanel.jsx`
- Modify: `client/src/components/overlay/OverlayManager.jsx` (registrar `case 'combat_instance'`)
- Test: (visual vía driver Task 12)

**Interfaces:**
- Consumes: `useGameStore` (`activeRun`, `stepInstance`, `clearActiveRun`).
- Produces: overlay `combat_instance`.

- [ ] **Step 1: Create the component**

Crear `client/src/components/campaign/CombatInstancePanel.jsx`:

```jsx
import { useState } from 'react';
import useGameStore from '../../store/gameStore';

export default function CombatInstancePanel({ onClose }) {
  const activeRun = useGameStore((s) => s.activeRun);
  const stepInstance = useGameStore((s) => s.stepInstance);
  const clearActiveRun = useGameStore((s) => s.clearActiveRun);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  if (!activeRun) { onClose(); return null; }
  const { node, state } = activeRun;

  const doStep = async (action) => {
    if (busy || result) return;
    setBusy(true);
    try {
      const r = await stepInstance(action);
      if (r?.result) setResult(r.result);
    } finally { setBusy(false); }
  };

  const close = () => { clearActiveRun(); onClose(); };
  const enemyPct = Math.max(0, Math.round((state.enemy.hp / state.enemy.maxHp) * 100));

  return (
    <div className="fixed inset-0 z-50 flex flex-col p-4" style={{ background: 'rgba(8,8,16,0.97)' }}>
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-red-400 font-bold" style={{ fontFamily: 'MedievalSharp, serif' }}>
          {node.type === 'boss' ? '💀' : '⚔️'} {node.name} · ronda {state.round}/{state.maxRounds}
        </h2>
        <button onClick={close} className="text-gray-400 text-xl px-2">✕</button>
      </div>

      {/* Enemigo */}
      <div className="mb-4">
        <div className="text-gray-300 text-xs mb-1">Enemigo</div>
        <div className="h-4 rounded" style={{ background: '#333' }}>
          <div className="h-4 rounded" style={{ width: `${enemyPct}%`, background: '#e94560', transition: 'width .3s' }} />
        </div>
      </div>

      {/* Héroes + tap-skill */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {state.heroes.map((h) => {
          const ready = h.alive && h.energy >= h.energyMax;
          return (
            <button
              key={h.slot}
              onClick={() => doStep({ type: 'skill', slot: h.slot })}
              disabled={!ready || busy || !!result}
              className="w-full p-2 rounded flex items-center gap-2"
              style={{
                background: ready ? 'rgba(255,215,0,0.18)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${ready ? '#ffd700' : '#333'}`,
                opacity: h.alive ? 1 : 0.4,
              }}
            >
              <span className="text-lg">{h.skill.icon || '✦'}</span>
              <div className="flex-1 text-left">
                <p className="text-white text-xs">{h.name} {h.alive ? '' : '☠️'}</p>
                <div className="h-1.5 rounded mt-1" style={{ background: '#222' }}>
                  <div className="h-1.5 rounded" style={{ width: `${Math.min(100, h.energy)}%`, background: ready ? '#ffd700' : '#4ade80' }} />
                </div>
              </div>
              {ready && <span className="text-yellow-300 text-[10px] font-bold">¡TAP!</span>}
            </button>
          );
        })}
      </div>

      {/* Avanzar / resultado */}
      {result ? (
        <div className="mt-3 text-center">
          <p className={`text-lg font-bold ${result === 'victory' ? 'text-green-400' : 'text-red-400'}`}>
            {result === 'victory' ? '🏆 ¡Victoria!' : '💀 Derrota'}
          </p>
          <button onClick={close} className="btn-gold mt-2 px-6 py-2 rounded">Volver</button>
        </div>
      ) : (
        <button
          onClick={() => doStep({ type: 'advance' })}
          disabled={busy}
          className="btn-primary mt-3 py-3 rounded font-bold disabled:opacity-50"
        >
          {busy ? '...' : '⚔️ Avanzar ronda'}
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Register the overlay**

En `OverlayManager.jsx`: importar
```jsx
import CombatInstancePanel from '../campaign/CombatInstancePanel';
```
y en el switch:
```jsx
    case 'combat_instance':
      return <CombatInstancePanel onClose={closeOverlay} />;
```

- [ ] **Step 3: Build check**

Run: `cd client && npm run build`
Expected: build OK.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/campaign/CombatInstancePanel.jsx client/src/components/overlay/OverlayManager.jsx
git commit -m "feat(campaign): CombatInstancePanel (rondas + tap-skill)"
```

---

## Task 11: Hub por defecto + `QuestRail` + modo cámara-fija

**Files:**
- Create: `client/src/components/hub/BastionHub.jsx`, `client/src/components/hub/QuestRail.jsx`
- Modify: `client/src/App.jsx` (entrada por defecto = hub; mundo 160×120 tras bandera), `client/src/game/scenes/WorldScene.js` + `client/src/game/systems/CameraSystem.js` (modo hub)
- Test: (visual vía driver Task 12)

**Interfaces:**
- Consumes: `useGameStore` (`campaignNodes`, `loadCampaignMap`, `enterNode`, `setOverlay`), `PhaserGame`.
- Produces: pantalla-ancla que se muestra tras el menú en lugar del mundo paseable.

- [ ] **Step 1: QuestRail component**

Crear `client/src/components/hub/QuestRail.jsx`:

```jsx
import { useEffect } from 'react';
import useGameStore from '../../store/gameStore';

// Riel de marcadores: muestra el próximo nodo 'available' como objetivo tappable.
export default function QuestRail() {
  const nodes = useGameStore((s) => s.campaignNodes);
  const loadCampaignMap = useGameStore((s) => s.loadCampaignMap);
  const setOverlay = useGameStore((s) => s.setOverlay);

  useEffect(() => { loadCampaignMap(); }, [loadCampaignMap]);
  const next = nodes.find((n) => n.status === 'available');

  return (
    <div className="w-full px-3 py-2 flex items-center gap-2 overflow-x-auto"
      style={{ background: 'rgba(22,33,62,0.9)', borderBottom: '1px solid rgba(255,215,0,0.25)' }}>
      <span className="text-yellow-400 text-xs font-bold whitespace-nowrap">▸ Objetivo:</span>
      <button
        onClick={() => setOverlay('operations', {})}
        className="text-white text-xs px-3 py-1 rounded whitespace-nowrap"
        style={{ background: 'rgba(233,69,96,0.25)', border: '1px solid #e94560' }}
      >
        {next ? next.name : 'Acto completado ✓'}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: BastionHub component**

Crear `client/src/components/hub/BastionHub.jsx`:

```jsx
import QuestRail from './QuestRail';
import PhaserGame from '../../game/PhaserGame';
import useGameStore from '../../store/gameStore';

// Pantalla-ancla: riel arriba, base compacta (Phaser en modo hub) al medio,
// botón Operaciones abajo. Reemplaza al mundo paseable como entrada por defecto.
export default function BastionHub() {
  const setOverlay = useGameStore((s) => s.setOverlay);
  return (
    <div className="fixed inset-0 flex flex-col">
      <QuestRail />
      <div className="flex-1 relative">
        <PhaserGame hubMode />
      </div>
      <div className="p-3">
        <button
          onClick={() => setOverlay('operations', {})}
          className="w-full btn-primary py-3 rounded font-bold"
          style={{ fontFamily: 'MedievalSharp, serif' }}
        >
          🗺️ Operaciones
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: PhaserGame acepta `hubMode` y lo pasa al registry**

En `client/src/game/PhaserGame.jsx`, donde se crea el juego / se setea el registry (mirar cómo hoy stampa `registry.isoMode`), agregar el flag:

```jsx
// dentro del componente, tras crear game (junto a isoMode):
game.registry.set('hubMode', !!hubMode);
```
y aceptar la prop: `export default function PhaserGame({ hubMode = false }) {`.

- [ ] **Step 4: WorldScene respeta `hubMode` (cámara fija, streaming off)**

En `client/src/game/scenes/WorldScene.js`, en `create()` (tras inicializar cámara y antes de arrancar `ZoneStreamer`), agregar:

```js
    const hubMode = this.registry.get('hubMode');
    if (hubMode) {
      // Modo hub: base compacta fija. No streamear el mundo gigante ni permitir paneo.
      this.hubMode = true;
      const cam = this.cameras.main;
      cam.setZoom(1.4);
      cam.centerOn(this.baseCenterX ?? (this.scale.width / 2), this.baseCenterY ?? (this.scale.height / 2));
    }
```

Y donde hoy se crea/arranca el `ZoneStreamer` y el drag-pan de la cámara, envolver en guarda:

```js
    if (!this.registry.get('hubMode')) {
      // ...creación de ZoneStreamer y del pan por drag (código existente)...
    }
```

(Si `CameraSystem` maneja el drag-pan, en `CameraSystem.js` agregar al inicio del enganche de input: `if (this.scene.registry.get('hubMode')) return;`.)

- [ ] **Step 5: App.jsx muestra el hub por defecto**

En `client/src/App.jsx`, localizar el render que hoy muestra el juego cuando `!isLoading && menuDismissed`. Importar arriba:

```jsx
import BastionHub from './components/hub/BastionHub';
```

Y en ese render, elegir hub vs mundo paseable según la bandera de preview existente (`ISO_PREVIEW` ya distingue `?preview=world`/`?iso=1`):

```jsx
{/* Entrada por defecto = hub; el mundo 160×120 queda tras ?preview=world */}
{ISO_PREVIEW ? <PhaserGame /> : <BastionHub />}
```

(Ajustar al JSX real del archivo: si hoy renderiza `<PhaserGame/>` directo, reemplazar por este ternario en el mismo lugar, dejando `GameHUD`/overlays como están.)

- [ ] **Step 6: Build + arranque visual**

Run: `cd client && npm run build`
Expected: build OK.

- [ ] **Step 7: Commit**

```bash
git add client/src/components/hub/ client/src/App.jsx client/src/game/PhaserGame.jsx client/src/game/scenes/WorldScene.js client/src/game/systems/CameraSystem.js
git commit -m "feat(campaign): hub Bastión por defecto + QuestRail + modo cámara-fija (mundo 160x120 tras bandera)"
```

---

## Task 12: Verificación E2E (driver + screenshots)

**Files:**
- (Sin código nuevo; usa `.claude/skills/run-kingdoms-harvest/driver.mjs` y un script de tour)

**Interfaces:**
- Consumes: server (`:3001`, `SKIP_AUTH=true`) + client (`:5173`).

- [ ] **Step 1: Server + suite verdes**

Run: `cd server && npm test`
Expected: PASS (suite completa, incluidos campaignSim + campaignService).

- [ ] **Step 2: Boot con el driver (deja los fuegos prendidos)**

Run: `node .claude/skills/run-kingdoms-harvest/driver.mjs --no-screenshot --keep`
Expected: `✓ server healthy` + `✓ client serving`.
(Nota: iniciar el server como proceso propio en background si `--keep` lo mata; ver §Gotchas del skill.)

- [ ] **Step 3: Screenshot del flujo**

Con Playwright (chromium propio de `node_modules`), navegar a `http://localhost:5173/`, entrar al hub (`window.__gameStore.getState().enterGame()`), y capturar: (a) hub + QuestRail, (b) `setOverlay('operations')` → mapa de nodos, (c) `enterNode('a1n3')` + `setOverlay('combat_instance')` → panel de combate. Guardar PNGs en el scratchpad.

Expected: hub sin mundo gigante paseable; mapa de nodos con candados; panel de combate con barra de enemigo y héroes con energía.

- [ ] **Step 4: Verificar el flujo de dinero intacto**

Run: `cd server && npm test -t "qaRegressions"`
Expected: PASS (los fixes de seguridad siguen intactos; la campaña usa `awardTokens`/`_clearNode` atómico).

- [ ] **Step 5: Commit (docs de estado)**

Actualizar CLAUDE.md §14 (nueva fila "Rework hub+instancias v1 ✅") y commit:

```bash
git add CLAUDE.md
git commit -m "docs(campaign): estado de implementación del rework hub+instancias v1"
```

---

## Self-Review

**1. Spec coverage:**
- §2 navegación → Tasks 9 (mapa), 11 (hub + riel). ✓
- §3 tipos de instancia + rotación → Task 1 (CAMPAIGN), Task 5 (enter por tipo). ✓
- §4 combate round-stepped server-authoritative → Tasks 3 (sim), 6 (step + award idempotente), 7 (rutas). ✓
- §5 base idle compacta → Task 11 (modo cámara-fija). ✓ (producción offline reusa `gameTick`/`idleService` sin cambios).
- §6 datos/backend → Tasks 1, 2, 4-7. ✓
- §7 jubilar mundo tras bandera → Task 11 Step 5. ✓
- §9 criterios de aceptación → Task 12. ✓

**2. Placeholder scan:** todo step de código tiene código real. Los números de `CAMPAIGN` son valores concretos (etiquetados como afinables, no placeholders de lógica). Sin TODO/TBD.

**3. Type consistency:** `state`/`action`/`result` idénticos entre `campaignSim` (Task 3), `campaignService.resolveStep` (Task 6), slice `stepInstance` (Task 8) y `CombatInstancePanel` (Task 10). `enterNode` union (`kind:'combat'|'cleared'|'blocked'`) consistente entre Task 5, slice (Task 8) y `OperationsMap` (Task 9). Source de KH = `'wave_defense'` en todo `_clearNode`. `getSquad` devuelve `stats.atk`/`stats.hp` (verificado en heroService).

**Notas de ejecución:**
- El fallback de combate (§4 spec) NO se implementa: se elige round-stepped puro (Task 3/6). Decisión cerrada.
- `pvpCombatService.js` (código muerto) no se toca.
- Tasks 9-11 (cliente) se verifican visualmente (driver), no por unit test — el proyecto no testea componentes Phaser.
