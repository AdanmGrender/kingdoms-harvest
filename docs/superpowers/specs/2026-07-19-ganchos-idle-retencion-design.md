# Ganchos de retención idle (paquete post-rework) — Spec

> **Fecha:** 2026-07-19 · **Rama:** `feat/ganchos-idle-retencion` · **Base:** master `a0fb102`
> Origen: análisis competitivo (idle Android 2026 + Whiteout Survival + juegos TON).
> El motor (hub+campaña+héroes+oleadas+economía doble) ya existe; esto agrega los
> ganchos de regreso diario y rieles de temporada que los referentes ya tienen.

## Alcance (6 features) y CORTES

| # | Feature | Decisión de diseño |
|---|---------|--------------------|
| F1 | **Sweep de nodos** ("Asalto rápido") | Re-farmear nodos combat/wave/boss YA limpiados con un tap. **5 sweeps/día** (global, reset UTC). Recompensa: **60% de los recursos** del nodo (redondeo floor, mínimo 1) + **1 KH** vía `awardTokens` (cap diario aplica). Sin unlock, sin XP de héroes. |
| F2 | **Calendario de login 7 días** | Ciclo de 7 días reclamables (uno por día UTC; si se saltea un día NO se rompe — el ciclo avanza al reclamar). Premios crecientes: recursos → día 7 = **20 gemas promo**. Coexiste con las rachas (streaks siguen intactas). |
| F3 | **Boost ×2 producción (4h)** | Sink de gemas (**80 gemas**): multiplicador ×2 por 4h **SOLO producción de recursos** (farm yield + venta de oro en commerce). **JAMÁS multiplica KH** (no infla la economía retirable). No apilable: comprar con boost activo extiende el vencimiento +4h. |
| F4 | **Pase de temporada** (battle pass) | Temporada de 30 días (arranca al seedearse). **20 tiers × 50 pts**. Puntos: nodo limpiado +10, tarea diaria +5, oleada ganada +5. Riel FREE (recursos/KH chico) + riel PREMIUM (gemas promo chicas, speedups). Premium se desbloquea con **1440 gemas** (`decrementIfEnough`) — NO toca Stars/paymentService. Claims por tier idempotentes (UNIQUE player+season+tier+track). |
| F5 | **Acto 2 de campaña** | 10 nodos `a2n1..a2n10` (config pura en `CAMPAIGN`), unlock desde `a1n9`. Stats escalados (hp 3000→9000, dps 80→200), tipos rotando, 2 bosses. Pensado para escuadras con héroes epic+. UI: separador visual por acto en OperationsMap. |
| F6 | **Códice de colección** | Bonus pasivo por héroes ÚNICOS poseídos: **+1% ATK de escuadra por cada 3 héroes únicos, cap +6%**. Aplicado server-side en `_buildCombatState` (y visible en un panel simple). |
| — | ~~Piggy bank~~ | **CORTADO**: exige nuevo producto Stars en el bot (camino de dinero real) — riesgo alto vs. valor. Post-launch junto a VIP/suscripción. |
| — | ~~Chief gear / VIP~~ | Post-launch (spec original del análisis). |

## Invariantes de dinero (INNEGOCIABLES, heredan de CLAUDE.md §7.2b)

1. KH se acuña SOLO vía `tokenService.awardTokens` (cap diario aplica a sweep/calendario/pase).
2. Gemas NUNCA tienen ruta a KH/TON. **Novedad controlada:** se permiten **gemas promocionales** (calendario día 7, tiers premium del pase) vía `gemService.grantPromo(playerId, amount, reason)` con ledger propio (`gem_promo_grants`). Sigue siendo moneda de un solo sentido; el pase premium se PAGA con gemas (sink neto positivo).
3. Todo claim (sweep del día, día de calendario, tier del pase) es **atómico e idempotente**: UPDATE/INSERT condicional; el premio va gated por el claim (patrón `_clearNode`).
4. El boost ×2 jamás multiplica `awardTokens` (sólo recursos).
5. Server-side siempre: costos, elegibilidad y premios salen de catálogos en `shared/`, nunca del request.

## Datos (migraciones 031-034)

- **031** `campaign_sweeps`: player_id UNIQUE, sweep_date TEXT, sweeps_today INT — reset comparando fecha UTC en el UPDATE condicional.
- **032** `login_calendar` (player_id UNIQUE, cycle_day INT 1-7, last_claim_date TEXT) + `gem_promo_grants` (id, player_id, amount, reason, created_at; índice player_id).
- **033** `player_boosts` (player_id UNIQUE, boost_id TEXT, expires_at TEXT).
- **034** `pass_seasons` (id, season_key UNIQUE, started_at, ends_at) + `player_pass` (player_id UNIQUE, season_key, points, premium INT) + `pass_claims` (player_id, season_key, tier, track; UNIQUE(player_id, season_key, tier, track)).

## Catálogos nuevos en `shared/`

- `gameConfig.CAMPAIGN` += acto 2 (F5).
- `gameConfig.SWEEP` = { perDay: 5, resourcePct: 0.6, kh: 1 }.
- `gameConfig.LOGIN_CALENDAR` = [7 días de rewards; día 7 = { gems: 20 }].
- `gameConfig.SEASON_PASS` = { days: 30, tiers: 20, ptsPerTier: 50, premiumCostGems: 1440, points: {node_clear: 10, daily_task: 5, wave_win: 5}, rewards: [...] }.
- `gameConfig.CODEX` = { heroesPerStep: 3, atkPerStep: 0.01, maxSteps: 6 }.
- `shopConfig.GEM_SINKS` += `production_boost` { costGems: 80, hours: 4, mult: 2 }.

## Servicios / rutas

- `campaignService.sweepNode(playerId, nodeId)` + `POST /api/campaign/sweep`.
- `calendarService` (`getState`, `claim`) + `GET/POST /api/calendar/*`.
- `boostService` (`buy`, `getMultiplier(key)` con caché 60s, patrón stormService) + `POST /api/shop/boost`; consumo en `farmService`/`commerceService` junto a event/storm.
- `passService` (`getState`, `addPoints(action)`, `unlockPremium`, `claimTier`) + `/api/pass/*`; hooks de puntos en `_clearNode`, `dailyTaskService`, `waveDefenseService` (try/catch no crítico).
- `gemService.grantPromo` (ledger + increment; sin tocar `credit`).
- `codexService.getAtkBonus(playerId)` consumido en `_buildCombatState`.

## Cliente

- OperationsMap: botón "⚡ Asalto" en nodos cleared (muestra `sweepsLeft`), separador de actos.
- `CalendarPanel` (overlay `calendar`) + badge en el hub (QuestRail o BastionHub).
- Tienda: card del boost ×2 con estado activo/vencimiento.
- `PassPanel` (overlay `pass`): riel de 20 tiers, puntos, botón premium.
- `CodexPanel` (overlay `codex`) simple: conteo de únicos + bonus actual.
- Slices correspondientes en gameStore (patrón `campaign`).

## Criterios de aceptación

- [ ] Sweep: 5/día, sólo cleared, 60% recursos + 1 KH capado, atómico (no hay 6º sweep bajo carrera), test de regresión.
- [ ] Calendario: un claim por día UTC, día 7 otorga gemas promo CON fila en ledger, idempotente.
- [ ] Boost: ×2 en farm/commerce activo ↔ vencido; KH idéntico con y sin boost (test).
- [ ] Pase: puntos fluyen de las 3 fuentes; claim de tier idempotente; premium sólo si `decrementIfEnough(1440)`.
- [ ] Acto 2: integridad de la cadena (test CAMPAIGN existente lo cubre), a2n1 disponible al limpiar a1n9.
- [ ] Códice: +2% con 6 únicos (test de `_buildCombatState`).
- [ ] Suite completa verde + build + E2E con screenshots.
