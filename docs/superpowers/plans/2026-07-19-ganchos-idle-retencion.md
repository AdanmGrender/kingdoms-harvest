# Ganchos de retención idle — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development.
> Spec: `docs/superpowers/specs/2026-07-19-ganchos-idle-retencion-design.md` (leerla es parte de cada brief).

**Goal:** 6 ganchos de retención (sweep, calendario, boost, pase, acto 2, códice) sobre el motor existente, sin tocar el camino Stars/bot.

**Architecture:** Cada feature = migración (si aplica) + catálogo en `shared/` + servicio con claims atómicos + ruta `telegramAuth+validate` + slice/panel React. Patrones de referencia YA en el repo: `_clearNode` (claim transaccional), `stormService.getModifier` (caché 60s), `dailyTaskService.claimTaskReward` (claim condicional), slice `campaign` en gameStore, overlays en OverlayManager.

**Tech Stack:** el del repo (query builder sql.js, Jest DB in-memory, React+Zustand, sin deps nuevas).

## Global Constraints

- KH SOLO vía `tokenService.awardTokens(playerId, n, 'wave_defense')` — el cap diario es el freno.
- Gemas promocionales SOLO vía el nuevo `gemService.grantPromo` (ledger `gem_promo_grants`); gemas se GASTAN con `decrementIfEnough`. Cero rutas gemas→KH.
- Claims atómicos e idempotentes SIEMPRE (UPDATE/INSERT condicional gated antes del premio).
- Boost ×2 jamás toca `awardTokens` ni multiplicadores de KH.
- Catálogos/costos server-side desde `shared/`; nunca del request. Strings user-supplied maxLength ≤ 40.
- Migraciones 031-034 (`exports.up/down` async, `db.raw`, índice en player_id, estilo 030).
- Tests Jest en `server/tests/` — mantener la suite completa verde (base: 351).
- Cliente: build `cd client && npm run build` es el gate; overlays registrados en OverlayManager (`renderPanel(overlayState, onClose)`).

---

## Task 1: F1 Sweep de nodos ("Asalto rápido")

**Files:** Create `server/migrations/031_campaign_sweeps.js`. Modify `shared/gameConfig.js` (+`SWEEP`, export), `server/src/services/campaignService.js` (+`sweepNode`), `server/src/routes/campaignRoutes.js` (+`POST /sweep`), `client/src/store/gameStore.js` (+`sweepNode`, `sweepsLeft`), `client/src/components/campaign/OperationsMap.jsx` (botón ⚡ en cleared + contador). Test: append `server/tests/campaignService.test.js`.

**Contract:** `sweepNode(playerId, nodeId)`:
- PRE: nodo existe, es combat/wave/boss, progreso del jugador = 'cleared'.
- Claim atómico del cupo diario (UTC): fila UNIQUE por player en `campaign_sweeps`; el UPDATE condicional resetea si `sweep_date != hoy` o incrementa si `sweeps_today < SWEEP.perDay`. Patrón: un solo UPDATE con CASE o dos pasos (reset-si-viejo + `UPDATE ... SET sweeps_today = sweeps_today + 1 WHERE player_id=? AND sweep_date=? AND sweeps_today < ?` → `.count` decide). Si no afecta filas → error 'Sin asaltos por hoy'.
- POST claim: por cada recurso del nodo `modifyResource(playerId, rid, Math.max(1, Math.floor(amt * SWEEP.resourcePct)))`; `awardTokens(playerId, SWEEP.kh, 'wave_defense')`. Devuelve `{ rewards, sweepsLeft }`.
- Ruta: `POST /api/campaign/sweep { nodeId }` (maxLength 40).
- `GET /api/campaign/map` agrega `sweepsLeft` al payload (leer fila, calcular contra hoy).

**Tests (mínimo):** (a) sweep sobre cleared paga 60% recursos y decrementa cupo; (b) nodo no-cleared o manage/collect → rechaza; (c) 5 sweeps ok y el 6º rechaza; (d) carrera: 3 sweeps concurrentes con cupo 1 → sólo 1 gana (Promise.allSettled).

**Steps:** test RED → implementar → GREEN → suite completa → build cliente → commit `feat(retention): sweep de nodos limpiados (5/día, 60% recursos, claim atómico)`.

---

## Task 2: F2 Calendario de login 7 días + gemas promo

**Files:** Create `server/migrations/032_login_calendar.js` (tablas `login_calendar` + `gem_promo_grants`), `server/src/services/calendarService.js`, `server/src/routes/calendarRoutes.js` (mount en index.js `/api/calendar`), `client/src/components/overlay/CalendarPanel.jsx` (overlay `calendar` en OverlayManager + slice en gameStore + botón de acceso en BastionHub junto a Operaciones). Modify `shared/gameConfig.js` (+`LOGIN_CALENDAR` 7 días: d1 gold 200, d2 wood 150, d3 kh 3, d4 crystal 2, d5 gold 500, d6 relic 1, d7 gems 20), `server/src/services/gemService.js` (+`grantPromo(playerId, amount, reason)`: transacción → insert ledger + increment `player_gems.balance`; crea fila de player_gems si falta).

**Contract:** `calendarService.getState(playerId)` → `{ cycleDay, claimedToday, rewards }` (seed fila si falta). `claim(playerId)`:
- Claim atómico: `UPDATE login_calendar SET cycle_day = (cycle_day % 7) + 1, last_claim_date = hoy WHERE player_id=? AND last_claim_date != hoy` → `.count` gate (fila seed con last_claim_date='').
- Premio del día RECLAMADO (el cycle_day previo al update — leer antes, premiar después del claim, dentro de `db.transaction`).
- KH del d3 vía awardTokens; gemas del d7 vía grantPromo; recursos vía modifyResource.

**Tests:** (a) claim otorga el premio del día y avanza ciclo; (b) segundo claim mismo día UTC rechaza; (c) día 7 → gemas: balance de player_gems sube Y existe fila en gem_promo_grants; (d) ciclo envuelve 7→1.

**Steps:** RED → impl → GREEN → suite → build → commit `feat(retention): calendario de login 7 días + gemas promocionales con ledger`.

---

## Task 3: F3 Boost ×2 producción (sink de gemas)

**Files:** Create `server/migrations/033_player_boosts.js`, `server/src/services/boostService.js`. Modify `shared/shopConfig.js` (`GEM_SINKS.production_boost` { costGems: 80, hours: 4, mult: 2 }), `server/src/routes/shopRoutes.js` (+`POST /boost`), `server/src/services/farmService.js` + `commerceService.js` (multiplicar la GANANCIA DE RECURSOS por `boostService.getMultiplier('production')` junto a los multiplicadores de event/storm existentes — NUNCA el KH), `client` (card en ShopPanel con estado activo + slice).

**Contract:** `boostService.buy(playerId)`: costo desde el catálogo; `decrementIfEnough` de gemas → si falta saldo error; upsert `player_boosts`: si activo, `expires_at += 4h`; si no, `now + 4h`. `getMultiplier(key)`: caché 60s por player NO — es por jugador, así que caché simple Map player→(mult, ts) TTL 30s; devuelve 2 si activo, 1 si no.
**CRÍTICO:** en farmService el multiplicador aplica al yield de recursos ANTES de awardTokens y el monto de KH se calcula SIN el boost (test lo clava).

**Tests:** (a) compra descuenta 80 gemas y activa 4h; (b) recompra extiende; (c) sin gemas rechaza; (d) harvest con boost duplica recursos pero el KH otorgado es IDÉNTICO al de sin boost; (e) vencido → mult 1.

**Steps:** RED → impl → GREEN → suite → build → commit `feat(retention): boost ×2 producción 4h (sink de gemas, KH intacto)`.

---

## Task 4: F4 Pase de temporada (20 tiers, premium con gemas)

**Files:** Create `server/migrations/034_season_pass.js`, `server/src/services/passService.js`, `server/src/routes/passRoutes.js` (mount `/api/pass`), `client/src/components/overlay/PassPanel.jsx` (overlay `pass` + slice + acceso desde BastionHub/QuickActions). Modify `shared/gameConfig.js` (+`SEASON_PASS` según spec; rewards: free = recursos y kh 1-3 por tier; premium = gemas promo 5-15, speedups; tier 20 premium = 60 gemas), hooks de puntos: `campaignService._clearNode` (+`passService.addPoints(playerId,'node_clear')` en try/catch), `dailyTaskService` (al completar tarea), `waveDefenseService` (victoria) — todos try/catch no críticos.

**Contract:** `getState(playerId)` → seed de season activa (si no hay season: crear `season_key='s1'`, started_at now, ends_at +30d) + fila player_pass; devuelve `{ seasonKey, endsAt, points, tier, premium, claims }`. `addPoints(playerId, action)`: puntos del catálogo; ignora si season vencida. `unlockPremium(playerId)`: `decrementIfEnough` 1440 gemas → `UPDATE player_pass SET premium=1 WHERE premium=0` (gate). `claimTier(playerId, tier, track)`: valida tier alcanzado (points >= tier*ptsPerTier), track premium exige premium=1; INSERT en pass_claims (UNIQUE) dentro de transacción con el premio — el UNIQUE es el claim.

**Tests:** (a) puntos por las 3 acciones suben tier; (b) claim free ok, re-claim rechaza (UNIQUE); (c) claim premium sin premium rechaza; (d) unlockPremium descuenta 1440 y es idempotente (segundo intento no re-descuenta); (e) tier no alcanzado rechaza.

**Steps:** RED → impl → GREEN → suite → build → commit `feat(retention): pase de temporada 20 tiers (premium con gemas, claims idempotentes)`.

---

## Task 5: F5 Acto 2 de campaña

**Files:** Modify `shared/gameConfig.js` (CAMPAIGN += a2n1..a2n10; `a1n9.unlocks = ['a2n1']`), `client/src/components/campaign/OperationsMap.jsx` (separador visual "— ACTO N —" cuando cambia `node.act`). Test: los tests de integridad de CAMPAIGN existentes cubren la cadena; añadir asserts: a1n9 desbloquea a2n1, acto 2 tiene 2 bosses, stats crecientes.

**Diseño de nodos (usar tal cual):** a2n1 manage (building_level 4) → a2n2 combat (hp 3000/dps 80/r10) → a2n3 collect → a2n4 wave (hp 4200/dps 110/r11) → a2n5 boss «Coloso de Ceniza» (hp 6000/dps 140/r12) → a2n6 manage (building_level 5) → a2n7 combat (hp 5200/dps 130/r10) → a2n8 wave (hp 7000/dps 160/r12) → a2n9 combat (hp 8000/dps 180/r11) → a2n10 boss «La Voz del Velo» (hp 9500/dps 200/r14, unlocks []). Rewards escalando kh 6→30, recursos crystal/relic/blueprint. Nombres 100% originales grimdark (regla IP).

**Steps:** test RED (asserts nuevos) → config → GREEN → suite → build → commit `feat(retention): acto 2 de campaña (10 nodos, 2 bosses)`.

---

## Task 6: F6 Códice de colección

**Files:** Create `server/src/services/codexService.js`, `client/src/components/overlay/CodexPanel.jsx` (overlay `codex` + slice + acceso en HeroPanel o QuickActions). Modify `shared/gameConfig.js` (+`CODEX`), `server/src/services/campaignService.js` `_buildCombatState` (aplicar `1 + codexService.getAtkBonusSync?` — mejor: `const codexMult = await codexService.getAtkMult(playerId)` y multiplicar `atk` de héroes Y guarnición), ruta simple `GET /api/heroes/codex` (o en heroRoutes existente).

**Contract:** `getAtkMult(playerId)` → `1 + Math.min(maxSteps, floor(uniqueHeroes / heroesPerStep)) * atkPerStep` (héroes únicos = COUNT(DISTINCT hero_id) en player_heroes). Caché 30s por player.

**Tests:** (a) 0 héroes → mult 1; (b) 6 únicos → 1.02; (c) 30 únicos → cap 1.06; (d) `_buildCombatState` refleja el atk multiplicado (héroe atk 100 → 102 con 6 únicos).

**Steps:** RED → impl → GREEN → suite → build → commit `feat(retention): códice de colección (+1% ATK por cada 3 héroes únicos, cap 6%)`.

---

## Verificación final (controller)

1. Suite completa + build.
2. E2E driver: screenshots de sweep en OperationsMap, CalendarPanel, boost en tienda, PassPanel, acto 2 en el mapa.
3. CLAUDE.md §14: fila nueva del paquete.
4. Review final de rama (whole-branch) → fixes → merge a master si el owner ya lo autorizó para este paquete (preguntar al cierre).

## Self-Review

- Cobertura spec: F1-F6 ↔ Tasks 1-6 ✓; cortes documentados en el spec ✓.
- Sin placeholders: cada task trae contrato, archivos, tests y commit message ✓.
- Consistencia: claims atómicos en F1/F2/F4 usan los patrones existentes nombrados; grantPromo definido una vez (Task 2) y consumido en Task 4 ✓ (Task 4 depende de Task 2 — orden secuencial obligatorio).
