# Kingdoms Harvest - Test Results & Improvement Notes

## Test Summary
- **104 tests** across 6 test suites
- **All passing** in ~2.3 seconds
- Covers: QueryBuilder, Auth, Validation, Services, Combat Balance, Performance

---

## BUG FOUND: `changes()` and `last_insert_rowid()` broken by `saveToDisk()`

**Severity: CRITICAL**
**Status: FIXED during testing**

`sql.js`'s `Database.export()` resets SQLite's `changes()` and `last_insert_rowid()` counters. Since `saveToDisk()` calls `export()` after every `dbRun()`, all methods that relied on `SELECT changes()` or `SELECT last_insert_rowid()` after `dbRun` returned **0 instead of the real value**.

**Impact:**
- `decrementIfEnough()` always returned 0 — the race condition protection was completely broken. Every atomic deduction appeared to "fail" even when it succeeded. This means `modifyResource()` subtractions would always throw errors in production.
- `insert()` returned ID 0 instead of the actual row ID — any code using the returned ID (building construction, mission creation, caravan generation) was referencing non-existent rows.
- `update()`, `delete()`, `increment()`, `decrement()` return values were all incorrect.

**Fix:** Moved `changes()` and `last_insert_rowid()` capture to inside `dbRun()`, before `saveToDisk()`.

---

## BALANCE ISSUE: Defender Advantage in Combat

**Severity: HIGH (gameplay)**

The combat engine gives defenders a structural advantage:
- **Attacker power** = `troop.atk * qty`
- **Defender power** = `(troop.def + troop.atk * 0.5) * qty`

For equal militia armies (20v20):
- Attacker: `10 * 20 = 200`
- Defender: `(8 + 5) * 20 = 260`

**Test results:**
| Scenario | Attacker Win Rate |
|---|---|
| Equal militia (20v20) | **0%** |
| Cavalry vs Militia (10v10) | **100%** |
| Spearman vs Cavalry (15v10) | **65%** |
| Mixed vs Militia (13v20) | **12%** |
| 20 militia vs 10 militia + heavy defense | **0%** |

**Recommendation:** The attacker needs ~30% more troops just to break even. Options:
1. Reduce defender formula to `(troop.def + troop.atk * 0.3)` for closer to 50/50
2. Give attackers an initiative bonus (first strike)
3. Add a morale system where overwhelming numbers give attack bonus

---

## PERFORMANCE FINDINGS

| Operation | Result |
|---|---|
| Create 100 players | 272ms |
| 1000 resource modifications | 798ms |
| 500 SELECT queries | 17ms (29,411 ops/sec) |
| 200 complex queries (whereIn + orderBy + limit) | 15ms |
| 500 battle inserts | 406ms |
| Query 50 from 500 battles | <1ms |
| 100 updates (with saveToDisk) | 83ms (~0.8ms each) |
| 100 atomic decrementIfEnough | 72ms, exactly 20/100 succeeded |

### Performance Bottleneck: `saveToDisk()` on Every Write

**Severity: MEDIUM**

`saveToDisk()` is called on **every single** `dbRun()` — that means every INSERT, UPDATE, DELETE triggers a full `sqlDb.export()` + `fs.writeFileSync()`. This is:
1. **Synchronous I/O** — blocks the event loop during disk write
2. **Full DB export** — serializes the entire database, not just the changed page
3. **Redundant** — a single game action (e.g. complete mission) may trigger 5-10 writes

**Recommendations:**
1. **Debounce saves** — batch writes and save every 5-10 seconds instead of per-operation
2. **Use `fs.writeFile` (async)** — don't block the event loop
3. **Consider WAL mode or a real SQLite driver** (like `better-sqlite3`) for production, which handles disk persistence properly

---

## OTHER IMPROVEMENTS

### 1. `Math.random()` for Combat and Game Mechanics (MEDIUM)

`Math.random()` is used for:
- Combat randomness factor (±10%)
- Crop quality rolls
- NPC army generation
- Loot drops
- Mission generation

`Math.random()` is not cryptographically secure. For a game, this matters less than for security, but determined players could predict outcomes. Use `crypto.randomInt()` for fairness.

### 2. No Error Handling in `gameTick` (MEDIUM)

`processTick()` has a single try-catch around the entire tick. If one player's building completion fails, ALL subsequent operations in that tick are skipped. Each subsystem should have its own try-catch.

### 3. `JSON.parse()` Without try-catch in Services (LOW)

Several services parse JSON from DB columns (`requirements`, `rewards`, `buy_offers`, `sell_offers`) without wrapping in try-catch. If data is corrupted, the entire request crashes.

**Affected files:**
- `commerceService.js:31` — `JSON.parse(caravan.buy_offers)`
- `missionService.js:159` — `JSON.parse(mission.requirements)`
- `combatService.js:235-240` — `JSON.stringify` for battle inserts (less risky)

### 4. `buildingService.payResources()` Has Check-Then-Act Race Condition (LOW)

`payResources()` first checks all resources in a loop, then deducts in a second loop. Between the check and deduction, another request could spend the same resources. Should use `modifyResource()` with rollback pattern (like `feedAnimal` does).

### 5. Missing Index on Frequently Queried Columns (LOW)

No explicit indexes on:
- `player_resources.player_id` + `resource_id` (queried on every action)
- `player_buildings.player_id`
- `farm_plots.player_id`
- `missions.player_id` + `status`
- `battles.attacker_id`

At small scale this doesn't matter, but will become a bottleneck with 1000+ players.

### 6. Troop Losses Can Go Negative (LOW)

In `attackPVP`, defender troops are decremented by `losses`, but there's no guard against negative quantities. If combat calculates more losses than troops exist, the DB value goes negative.

---

## SUMMARY OF ACTIONS TAKEN

1. **FIXED** `dbRun()` to capture `changes()` and `last_insert_rowid()` before `saveToDisk()`
2. **DOCUMENTED** defender bias in combat engine
3. **IDENTIFIED** `saveToDisk()` as main performance bottleneck
4. **CREATED** 104 tests covering all major systems
