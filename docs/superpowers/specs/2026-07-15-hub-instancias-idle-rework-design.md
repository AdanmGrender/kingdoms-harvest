# Kingdoms Harvest — Rework a Hub + Instancias (molde idle grimdark)

> **Metodología:** Spec Driven Development (igual que CLAUDE.md). Cada sección
> define un contrato (entradas, salidas, invariantes, criterios de aceptación).
> **Fecha:** 2026-07-15 · **Estado:** diseño aprobado, pendiente de plan.

---

## 0. Contexto y decisión

El juego hoy carga directo un **mundo procedural 160×120 tiles** que se pasea
con streaming por zonas (`WorldScene` + `ZoneStreamer`). El owner lo describe
como "un campo inmenso" sin loop de juego claro: *"no hay misiones, no hay juego,
no hay nada"*. Paradójicamente **casi todas las piezas de un idle-defense ya
existen** (Fase 3, CLAUDE.md §14): Marea Disforme (oleadas), escuadras de 5 con
`HERO_SKILLS` por energía, reporte offline con tope 12h, research, tormentas.
Lo que falta es la **ESTRUCTURA que las une**.

Se toma como molde **Last Asylum: Plague** (idle + base-builder + squad
auto-battle + tower-defense). Investigación confirmó su forma: **hub-and-spoke**
(base = pantalla-ancla), navegación por **marcadores de misión** que
teletransportan, **mapa de nodos** como lanzador (no lugar traversable),
instancias que **alternan sobre un riel**, **auto-batalla con un solo verbo**
(tap a la ultimate cuando carga energía), **nodo idle con tope 12h**, y **boss
muro** por tier.

**Decisiones tomadas con el owner:**
1. **Base idle + mapa de niveles.** La base se vuelve pantalla-ancla compacta
   (motor idle); las instancias son la acción.
2. **Combate: auto-batalla + tap-skills.** Pelea sola por rondas; el jugador
   dispara las ultimates de sus héroes con timing.
3. **Enfoque: capa de navegación sobre lo hecho.** Reusar ~80%; jubilar el mapa
   160×120 como entrada (no borrarlo). Nada de reescribir el cliente en React
   puro ni descartar el farming.

**Regla IP (vigente, innegociable):** grimdark 40k-INSPIRADO pero 100% ORIGINAL.
Ninguna marca de Games Workshop ni contenido/nombres de Last Asylum: Plague. Se
copia el *patrón mecánico*, no el contenido. El juego mueve cripto real → un
juicio = muerte.

---

## 1. Objetivo y no-goals

**Objetivo:** reemplazar la entrada "pasear un mundo gigante" por
**hub-and-spoke con mapa de instancias**, dando un loop de sesión claro
(recolectar → gestionar → combatir → volver) y combate con agencia real
(tap-skills), reusando los sistemas ya construidos.

**No-goals de esta iteración (v1):**
- Mapa ramificado / multi-acto (v1 = 1 acto lineal de ~8-10 nodos).
- PvP como nodo (Phase 2).
- Tormentas Disformes como modificador de nodo (v2 — el sistema ya existe, se
  conecta después).
- Borrar el `WorldScene` 160×120 (queda detrás de bandera).
- Rebalance económico profundo (se ajustan números de recompensa de nodo, no la
  economía KH/gemas/retiro).

---

## 2. Estructura de navegación (hub-and-spoke)

```
┌───────────────────────────────────────────────┐
│  RIEL DE MISIONES (marcadores, top)            │ ← teletransporta a instancia
│  ▸ Sanar heridos   ▸ Oleada 3   ▸ ...          │
└───────────────────────────────────────────────┘
                     │
        ┌────────────▼────────────┐
        │  BASTIÓN (home / hub)    │ ← escena Phaser compacta FIJA (idle)
        │  base + recoger + nav    │
        └────────────┬────────────┘
                     │ "Operaciones"
        ┌────────────▼────────────┐
        │  MAPA DE OPERACIONES     │ ← React, lanzador de nodos
        │  ●─✓─●─▶─●─🔒─●─🔒        │   tap nodo = entrar instancia
        └──────────────────────────┘
```

**Contrato:**
- **Entrada por defecto** del juego pasa de `WorldScene` (mundo gigante) a
  **Bastión hub**. `App.jsx` deja de cargar el mundo streameado como default.
- **Bastión (hub):** escena Phaser **compacta y fija** — reusa edificios, granja,
  sprites y arte actuales, pero **cámara fija** y **sin `ZoneStreamer`**. Es la
  pantalla-ancla; muestra puntos rojos sobre lo recolectable.
- **Riel de misiones:** nuevo componente React (top). Cada marcador abre la
  instancia relevante (nodo de combate, gestión, recolectar). Reemplaza el
  movimiento libre como forma de navegar.
- **Mapa de operaciones:** nuevo componente React (no Phaser). Grilla/cadena de
  **nodos** con estado `cleared | available | locked`. Tap en nodo disponible →
  entra a la instancia.

**Invariantes:**
- El jugador nunca "camina" para llegar a contenido. Todo es tap → instancia.
- El hub y los paneles existentes (33 en `OverlayManager`) siguen accesibles;
  ahora se abren desde el hub y los nodos, no paseando.

---

## 3. Tipos de instancia y cómo se intercalan

Cada nodo del mapa tiene un `type`. La cadena **fuerza la rotación** (no dos del
mismo tipo seguidos) igual que el molde.

| Nodo | Qué es | Reusa |
|------|--------|-------|
| ⚔️ `combat` | auto-batalla vs fuerza PvE + tap-skills | `combatService` + escuadras + `HERO_SKILLS` |
| 🌊 `wave` | defensa por rondas (survival) | `waveDefenseService` (Marea Disforme) |
| 💀 `boss` | muro cada 5 nodos, mejor loot | boss del sim de oleadas |
| 🌾 `collect` | nodo idle: barrer stock offline | `idleService` (tope 12h) |
| 🔧 `manage` | "mejorá X / asigná aldeano" para abrir el siguiente | edificios/aldeanos actuales |

Riel de sesión típico: `manage → collect → combat → wave → boss → volver`.

**Gating:** un nodo pasa a `available` cuando el anterior queda `cleared`. El
`boss` exige sus pre-nodos limpios. Esto convierte el "campo inmenso" en una
**lista de nodos con candado**.

---

## 4. Combate paso-a-paso (auto + tap-skills) — contrato server-authoritative

**Por qué server-authoritative:** el juego acredita KH (dinero real vía retiro
TON). El cliente NUNCA puede decidir el resultado. El servidor resuelve; el tap
es *intención* que el servidor valida.

**Modelo: round-stepped run.** Un combate/oleada es una serie de rondas
resueltas de a una por el servidor, guardando estado compacto (patrón de
`wave_runs`, que ya persiste `result` JSON/log).

**API (`campaignRoutes.js`, todas con `telegramAuth` + `validate()`):**

```
POST /api/campaign/enter
  IN:  { nodeId: string }
  PRE: nodo existe, está 'available' para el jugador
  OUT: { runId, state } — snapshot inicial: escuadra (5 slots, stats+energía),
        defensas de base, oleada/enemigos ronda 0
  EFECTO: crea fila en campaign_runs (status 'active', state JSON)

POST /api/campaign/step
  IN:  { runId: string, action: { type: 'advance' }
                              | { type: 'skill', slot: 1-5, targetId?: string } }
  PRE: run 'active', pertenece al jugador; si 'skill' → energía del héroe llena
  OUT: { state, roundLog, result? }  result ∈ null | 'victory' | 'defeat'
  EFECTO: el SERVIDOR resuelve la ronda con la acción; actualiza state JSON.
          Timeout de cliente sin tap → el cliente manda 'advance' (auto-fire
          idle-friendly: el server dispara ults llenas si no hubo elección).
  POST victory: tokenService.awardTokens(source), desbloquea siguiente nodo,
                dailyTaskService.trackProgress('battle_win'), aplica recovery de
                héroes (heroService.applyHeroRecovery en derrota).
```

**Invariantes de seguridad:**
- Resultado calculado 100% server-side (fórmula `combatService`/`waveDefense`).
- `skill` sólo se acepta si la energía del héroe está llena en el `state`
  persistido (no en lo que diga el cliente).
- Recompensa sale del catálogo del nodo (`CAMPAIGN`), nunca del request.
- Idempotencia: un `runId` sólo puede pasar a `victory`/`defeat` una vez; el
  award va atado a esa transición (claim atómico como torneos/daily tasks).
- Reusa la whitelist de sources de `tokenService` (source `wave_defense`
  existente, o se agrega `campaign` a la whitelist en `tokenConfig`).

**Cliente:** un panel React de combate reproduce el `state`/`roundLog`; cuando un
héroe tiene energía llena, su retrato brilla y el tap manda `step{skill}`. Sin
tap en ~2s → `step{advance}`.

**Fallback documentado (riesgo):** si el round-stepped resulta pesado para v1, se
puede degradar a "server pre-sima el run completo; el tap elige objetivo/timing
de la ultimate dentro de una ventana que el server RE-resuelve desde ese punto".
Sigue siendo server-authoritative. Se decide en el plan.

---

## 5. Base idle compacta (el hub)

**Contrato:**
- Escena Phaser **fija** (reusa arte/edificios/granja/sprites); cámara sin
  paneo del mundo grande; `ZoneStreamer`/`ZoneAnchors` apagados en este modo.
- Producción offline: ya la maneja `gameTick` + `idleService` (tope 12h). El hub
  muestra puntos rojos sobre lo recolectable.
- **Ritual de volver:** entrar → barrer montón idle (reporte offline existente)
  → repartir en edificios/héroes → correr 1-2 instancias → salir.

**Invariante:** el hub no introduce nueva economía; sólo re-empaqueta la
producción/recolección ya existente en una pantalla fija.

---

## 6. Datos y backend (lo nuevo)

- **`shared/gameConfig.js` → `CAMPAIGN`:** array de nodos del acto 1. Cada nodo:
  `{ id, type, name, unlocks, enemies?, rewards, requires[] }`. Contenido y
  números, cero lógica (como `WARP_STORMS`/`WAVE_CONFIG`).
- **Migración `030_campaign_progress.js`:**
  - `player_campaign_progress` (player_id, node_id, status, cleared_at;
    UNIQUE(player_id, node_id); índice en player_id — CLAUDE.md §3.3).
  - `campaign_runs` (id, player_id, node_id, status, state JSON, created_at;
    índice player_id). Guarda el estado del round-stepped.
- **`server/src/services/campaignService.js`** (contrato de servicio §4.1):
  - `getMap(playerId)` → nodos con estado calculado (cleared/available/locked).
  - `enterNode(playerId, nodeId)` → valida gating, crea run, devuelve state.
  - `resolveStep(playerId, runId, action)` → resuelve ronda, autoridad total.
  - `_clearNode(playerId, nodeId)` → claim atómico + award + desbloqueo.
  - Todo con el query builder (nunca sql.js directo).
- **`server/src/routes/campaignRoutes.js`** montado en `index.js`
  (`app.use('/api/campaign', ...)`).
- **Reuso sin tocar lógica:** `waveDefenseService`, `heroService`
  (escuadras+skills+recovery), `missionService`, `idleService`,
  `tokenService.awardTokens`, `dailyTaskService.trackProgress`, tienda, retiro
  TON, tormentas.

**Cliente nuevo:**
- `components/hub/BastionHub.jsx` (o reuso de `MainMenu`→hub), `QuestRail.jsx`,
  `components/campaign/OperationsMap.jsx`, `CombatInstancePanel.jsx`.
- `gameStore.js`: slice `campaign` (`loadMap`, `enterNode`, `step`).
- `OverlayManager.jsx`: registrar el/los panel(es) nuevos.
- Escena Phaser compacta (config de cámara fija; puede ser un modo de
  `WorldScene` o una escena `BastionScene` chica).

---

## 7. Reuso / jubilación / migración

- **Jubilar (no borrar):** el mundo 160×120 con streaming deja de ser default.
  Queda accesible tras bandera (`?preview=world` / const en `config.js`). Cero
  riesgo, se puede volver a mirar.
- **Migración de jugadores existentes:** al primer login post-rework,
  `campaignService` siembra el progreso en el nodo 1 (`available`). No se pierde
  base, héroes, recursos ni balance KH.
- **Los 33 paneles** siguen vivos; cambian sólo sus puntos de entrada.

---

## 8. Alcance v1 vs. v2+

**v1 (molde funcionando de punta a punta):**
1. Hub Bastión (base compacta fija) + riel de misiones.
2. Mapa de operaciones: 1 acto, ~8-10 nodos encadenados.
3. Tipos de nodo: `combat`, `wave`, `boss`, `collect`, `manage`.
4. Combate round-stepped con tap-skills (server manda).
5. Recompensa + desbloqueo del siguiente + volver a base.
6. Migración 030 + `campaignService` + `campaignRoutes` + tests Jest.

**v2+ (después):** más actos/regiones, tormentas como modificador de nodo, mapa
ramificado, PvP como nodo, eventos limitados.

---

## 9. Criterios de aceptación (v1 COMPLETA cuando)

- [ ] Al iniciar, el juego abre el **hub Bastión**, no el mundo 160×120.
- [ ] El riel de misiones lleva a la instancia correcta con un tap.
- [ ] El mapa de operaciones muestra nodos con candado; limpiar uno desbloquea
      el siguiente; el boss exige pre-nodos limpios.
- [ ] Una instancia de combate se juega round-stepped; el tap dispara la
      ultimate; sin tap en ~2s auto-avanza.
- [ ] El resultado y la recompensa se calculan **server-side**; un `runId` no
      puede premiar dos veces (claim atómico).
- [ ] Recolectar barre el stock idle (tope 12h) sin doble conteo.
- [ ] `cd server && npm test` verde (suite actual + tests nuevos de
      `campaignService`: gating, round-step, idempotencia de award, migración).
- [ ] El mundo 160×120 sigue accesible tras bandera (no roto).
- [ ] Driver E2E (`run-kingdoms-harvest`) saca screenshots de hub, mapa de
      nodos y combate.

---

## 10. Riesgos y decisiones abiertas

1. **Round-stepped vs. pre-sim.** Round-stepped da agencia real pero más
   requests y estado server-side. Fallback en §4. **Decidir en el plan.**
2. **Escena Phaser compacta vs. panel React para el hub.** El enfoque aprobado
   dice reusar Phaser (base compacta fija). Confirmar si `WorldScene` en modo
   cámara-fija alcanza o conviene una `BastionScene` nueva chica.
3. **Fuente de recompensa de nodo.** Reusar source `wave_defense` o agregar
   `campaign` a la whitelist de `tokenConfig`. Trivial; decidir en el plan.
4. **`pvpCombatService.js` es código muerto/roto** (conocido). No se toca en v1;
   PvP-como-nodo es v2.
5. **Balance de recompensas** de nodos: números placeholder en `CAMPAIGN`, se
   afinan con playtest; no bloquea v1.
