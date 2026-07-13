# Kingdoms Harvest — Spec

> **Metodología:** Spec Driven Development. Cada sección define un contrato (entradas, salidas, invariantes, criterios de aceptación). Las notas de implementación son secundarias al contrato.

---

## 0. Contexto del Sistema

**Qué:** Juego medieval farming + RTS como Telegram Mini App. Los jugadores construyen un reino, cosechan recursos, comercian con caravanas, entrenan tropas y ganan **KH Tokens** canjeables por TON cryptocurrency.

**Stack:**

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18 + Vite 6, Phaser 3.90, TailwindCSS 3.4 |
| Estado cliente | Zustand 4.4 + Socket.io (sync tiempo real) |
| Backend | Node.js + Express 4.18 |
| Base de datos | SQLite vía `sql.js` (WASM in-memory + persistencia en disco) |
| Auth | Telegram initData HMAC-SHA256, ventana 5 min |
| Blockchain | TON vía `tonweb`; `@tonconnect/ui-react` para wallet |
| Bot | `node-telegram-bot-api` |

**No-goals (fuera de scope):**
- PvP completamente asíncrono (Phase 2)
- Sistema de facciones completo (Phase 2)
- Mapa territorial con conquista (Phase 2)
- Tech tree funcional en Library (Phase 2)

**Entorno de ejecución actual (julio 2026):**
- El VPS de Hostinger (`82.25.66.103`) está **apagado**. El servidor corre **localmente
  en esta PC Windows** (ver §15 Dev Commands).
- Con el VPS apagado, `BOT_POLLING=true` es seguro en local. Si el VPS vuelve a
  encenderse con el bot activo, poner `BOT_POLLING=false` en local para no duplicar
  el polling de Telegram (dos pollers con el mismo token se roban updates).

---

## 1. Spec: Estructura del Repositorio

```
kingdoms-harvest/
├── client/src/
│   ├── components/overlay/   # Overlays in-game (GameHUD, OverlayManager, panels)
│   ├── components/token/     # UI economía de tokens
│   ├── components/ui/        # Componentes compartidos (SpriteIcon, LoadingScreen)
│   ├── game/scenes/          # WorldScene.js (principal), BootScene.js
│   ├── game/systems/         # CameraSystem, ParticleSystem, SelectionSystem
│   ├── game/entities/        # Building, CropPlot, NPC, Animal, Villager
│   ├── game/maps/            # MapGenerator.js (mundo procedural 160×120)
│   ├── game/EventBridge.js   # Singleton Phaser ↔ React (EventEmitter3)
│   ├── store/gameStore.js    # Estado global Zustand
│   └── services/             # Clientes axios por dominio
├── server/src/
│   ├── routes/               # 11 routers Express (uno por dominio)
│   ├── services/             # 14+ archivos de lógica de negocio
│   ├── middleware/           # telegramAuth, validate, errorHandler
│   ├── config/database.js    # Query builder custom sobre sql.js
│   └── game/gameTick.js      # Cron del juego (subsistemas independientes)
├── shared/
│   ├── gameConfig.js         # CROPS, TROOPS, BUILDINGS, RESOURCES
│   └── tokenConfig.js        # Economía de tokens (cap diario, tareas, tasas)
└── server/migrations/        # Migraciones DB numeradas secuencialmente
```

---

## 2. Spec: API HTTP

### 2.1 Contrato de Endpoint

**Todo endpoint debe cumplir:**

```
ENTRADA:
  - Header: x-telegram-init-data (HMAC-SHA256 válido, max 5 min de antigüedad)
  - Body: validado por middleware validate() — ver §2.2
  - req.playerId: integer (Telegram user ID, inyectado por telegramAuth)

SALIDA exitosa:
  - HTTP 200, body JSON con datos de resultado

SALIDA de error:
  - HTTP 400: error de negocio (saldo insuficiente, estado inválido)
  - HTTP 401: auth fallida
  - HTTP 429: rate limit (100 req/min por IP)
  - Body: { error: string } — sanitizado por safeErrorMessage()

INVARIANTES:
  - Nunca exponer stack traces al cliente
  - Nunca exponer IDs internos de DB (usar telegram_id como identificador externo)
  - Toda escritura a DB debe pasar por el query builder (no sql.js directo)
```

**Plantilla canónica:**

```js
// server/src/routes/thingRoutes.js
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
```

Montar en `server/src/index.js`: `app.use('/api/things', thingRoutes);`

### 2.2 Spec de Validación de Input

```
validate(schema) — tipos permitidos:
  type: 'string'  → maxLength requerido si puede ser user-supplied
  type: 'number'  → min/max recomendado
  type: 'boolean'
  required: true/false (default false)

INVARIANTE: Toda string que llegue de usuario DEBE tener maxLength ≤ 100
  para prevenir buffer abuse. Body total: max 16 KB.
```

### 2.3 Endpoints Existentes

| Ruta base | Router | Descripción |
|-----------|--------|-------------|
| `/api/player` | playerRoutes.js | Init, perfil, nivel |
| `/api/farm` | farmRoutes.js | Plantar, cosechar, regar |
| `/api/buildings` | buildingRoutes.js | Construir, mejorar |
| `/api/commerce` | commerceRoutes.js | Caravanas, ventas |
| `/api/missions` | missionRoutes.js | NPCs, misiones |
| `/api/combat` | combatRoutes.js | PvE, PvP |
| `/api/tokens` | tokenRoutes.js | Balance, retiro, leaderboard |
| `/api/tasks` | taskRoutes.js | Tareas diarias, captcha |
| `/api/villagers` | villagerRoutes.js | Asignación de aldeanos |
| `/api/animals` | animalRoutes.js | Producción animal |
| `/api/social` | socialRoutes.js | Referidos, canal Telegram |

---

## 3. Spec: Base de Datos

### 3.1 Contrato del Query Builder

```js
const db = require('../config/database');

// SELECT
db('tabla').where('columna', valor).first()          // → objeto | undefined
db('tabla').where({ campo: valor, campo2: v2 })      // → array

// INSERT → [lastInsertRowId]. Acepta objeto o ARRAY de objetos (bulk).
db('tabla').insert({ campo: valor })
db('tabla').insert([{...}, {...}])
// Estilo Knex: const [{ id }] = await db('tabla').insert({...}).returning('id')

// UPDATE
db('tabla').where('id', id).update({ campo: valor })

// Incremento seguro
db('tabla').where('player_id', id).increment('balance', n)

// Decremento atómico (solo si saldo >= cantidad)
const affected = await db('tabla')
  .where({ player_id: id, resource_id: 'gold' })
  .decrementIfEnough('amount', cost);
if (!affected) throw new Error('Saldo insuficiente');

// RAW — LAZY estilo Knex (desde 2026-07-02):
await db.raw('UPDATE ...', [params])          // → { count, lastId }; SIN await NO ejecuta
db('t').where(...).update({                    // como valor: fragmento SQL inline
  balance: db.raw('balance + ?', [n]),
})

// TRANSACCIÓN (BEGIN/COMMIT/ROLLBACK; reentrante; trx === db)
await db.transaction(async (trx) => { ...queries con trx()... });
// .forUpdate() existe como no-op (compat Knex; SQLite es single-writer)

// ⚠️ SQL crudo: dialecto SQLite — MIN/MAX escalares (NO LEAST/GREATEST),
//    resultado de UPDATE → .count (NO .rowCount)
```

### 3.2 Invariantes Críticas de sql.js

```
⚠️  CRÍTICO: changes() y last_insert_rowid() se capturan DENTRO de dbRun()
    ANTES de que se llame a saveToDisk(). sqlDb.export() resetea esos contadores.
    Nunca mover saveToDisk() antes de la captura.

⚠️  saveToDisk() está debounced 2 segundos. En SIGINT/SIGTERM se hace flush
    sincrónico. No llamar saveToDisk() directamente — usar el mecanismo existente.

⚠️  sql.js es single-threaded in-process. A 1000+ jugadores migrar a
    better-sqlite3 o PostgreSQL.

⚠️  NODE_ENV=test → DB in-memory fresca (no lee ni escribe data/kingdoms.db).
    Los tests corren migraciones completas vía tests/setup.js.
```

### 3.3 Migrations

- Archivo: `server/migrations/00N_descripcion.js`
- Exports: `up(db)` y `down(db)`
- Se ejecutan en orden numérico al arrancar el servidor
- Usar `CREATE INDEX IF NOT EXISTS` para índices en columnas `player_id`

---

## 4. Spec: Sistema de Servicios

### 4.1 Contrato de Servicio

```
ENTRADA: (playerId: integer, ...params)
SALIDA:  objeto con datos de resultado
ERROR:   throw new Error('Mensaje legible por usuario')
         — safeErrorMessage() lo filtra antes de enviarlo al cliente

INVARIANTE: Un servicio NUNCA llama directamente a sql.js.
            Siempre usa el query builder de database.js.
```

**Plantilla canónica:**

```js
// server/src/services/myService.js
const db = require('../config/database');

const myService = {
  async doThing(playerId, amount) {
    const player = await db('players').where('telegram_id', playerId).first();
    if (!player) throw new Error('Jugador no encontrado');
    // lógica...
    return { success: true };
  },
};

module.exports = myService;
```

### 4.2 Spec: Tokens — awardTokens()

```
ENTRADA:  (playerId, amount, source)
          source ∈ ['harvest','battle_win','battle_pvp','sell','mission_complete',
                    'daily_task','captcha','resource_burn']

SALIDA:   { awarded: number, balance: number, dailyRemaining: number, capped: boolean }

INVARIANTES:
  - awarded puede ser < amount si se alcanzó el cap diario
  - Cap diario: 50 + (player.level × 10) tokens por UTC day
  - Multiplicador de streak se aplica automáticamente:
      Día 7 → ×2 | Día 14 → ×2.5 | Día 21 → ×3 | Día 30 → ×5
  - La comisión de referido se paga async (errores se loguean, no propagan)

NUNCA llamar db('player_tokens').increment() directamente para premiar tokens.
SIEMPRE usar tokenService.awardTokens().
```

### 4.3 Spec: Tareas — trackProgress()

```
ENTRADA:  (playerId, action, count = 1)
          action ∈ ['harvest','sell','battle_win','mission_complete','login','captcha']

EFECTO:   Incrementa progreso de la tarea diaria correspondiente.
          Si progreso >= target → marca completa y llama awardTokens() automáticamente.

INVARIANTE: Idempotente si la tarea ya está completa — no premia dos veces.

Llamar después de cada acción de jugador que mapee a una tarea.
```

---

## 5. Spec: Sistema de Farming

### 5.1 Comportamiento

```
CULTIVOS: 7 tipos (gameConfig.js → CROPS)
  Cada cultivo: { growthTime: segundos, baseYield, qualityChance, tokenReward }

FLUJO:
  plant(playerId, plotId, cropId)
    PRE:  plot existe, pertenece a playerId, está vacío, player tiene semillas
    POST: farm_plot.crop_id=cropId, farm_plot.planted_at=now(), status='growing'

  harvest(playerId, plotId)
    PRE:  plot está maduro (now - planted_at >= growthTime)
    POST: recursos incrementados, tokens awarded vía awardTokens(playerId, n, 'harvest')
          dailyTaskService.trackProgress(playerId, 'harvest', 1)
    SALIDA: { resources, quality, tokensAwarded }

CALIDAD: 'common' | 'uncommon' | 'rare' — afecta yield multiplicador
```

### 5.2 Animales

```
TIPOS: chicken, cow, sheep
PRODUCCIÓN: periódica server-side (gameTick.js)
RECOLECCIÓN: collectAnimal(playerId, animalId)
  POST: animal.last_collected=now(), recursos incrementados
```

---

## 6. Spec: Sistema de Combate

### 6.1 PvE

```
ENTRADA:  attackPVE(playerId, targetId, troops: { troopId, quantity }[])

CÁLCULO de poder:
  attackPower = Σ (troop.atk * qty) × 1.1   ← bonus first-strike atacante
  defPower    = Σ (troop.def + troop.atk × 0.3) × qty

RESULTADO:
  attackPower > defPower → victoria
  POST victoria: awardTokens(playerId, 3, 'battle_win')
                 trackProgress(playerId, 'battle_win', 1)
  POST derrota:  bajas proporcionales, sin tokens

INVARIANTE: losses = Math.min(calculatedLosses, troop.quantity)
            — nunca bajas negativas
```

### 6.2 PvP (Phase 2 — spec parcial)

```
Estado actual: combatService.js tiene esqueleto, no completamente implementado.
Al implementar: misma fórmula de combate, recompensa +8 tokens por victoria.
```

---

## 7. Spec: Economía de Tokens

### 7.1 Tabla de Fuentes

| Acción | Tokens |
|--------|--------|
| Cosechar cultivo | +2 |
| Completar misión | +5 |
| Ganar combate PvE | +3 |
| Ganar combate PvP | +8 |
| Realizar venta | +1 |
| Completar tarea diaria | +3–12 |
| Resolver captcha diario | +5 |

### 7.2 Spec de Retiro

```
PRE-CONDICIONES (todas deben cumplirse):
  - balance >= 500 KH
  - player.level >= 5
  - cuenta >= 7 días de antigüedad
  - last_withdrawal > 24h atrás

PROCESO:
  - Fee: 5% descontado del monto
  - Tasa: 1 KH = 0.0001 TON
  - Procesado en background cada 5 minutos desde hot wallet

ENVÍO ON-CHAIN (tokenService.sendTON + processPendingWithdrawals):
  - Envío real con @ton/ton (WalletContractV4, TonCenter). Confirma por
    incremento de seqno y devuelve el hash real (base64url). SIN pseudo-hash:
    si no confirma → needs_review (jamás se completa con hash inventado).
  - Seguridad de payout (dinero real):
    · presend flag → un fallo ANTES del broadcast (addr inválida, wallet sin
      configurar, balance del hot wallet insuficiente) reintegra el balance.
      Un fallo DESPUÉS del broadcast (incierto) → estado 'needs_review': NO
      reintegra (evita doble pago) y NO completa; lo resuelve un humano con el
      seqno persistido (migración 027: seqno/attempts/claimed_at).
    · Tope diario MAX_DAILY_TON_PAYOUT (difiere, no falla).
    · 'processing' colgado > WITHDRAWAL_PROCESSING_STALE_MIN → needs_review.
    · Kill-switch env WITHDRAWALS_ENABLED=false pausa payouts.
  - Requiere TON_HOT_WALLET_MNEMONIC (secrets/ o env) + TON_NETWORK=mainnet
    para producción. Probar SIEMPRE en testnet primero.
```

### 7.2b Spec: INGRESO de dinero (Telegram Stars → Gemas)

```
⚠️ INVARIANTE INNEGOCIABLE: con dinero real SOLO se compran GEMAS.
   JAMÁS se venden KH Tokens. KH es retirable a TON (dinero real), así que
   venderlo haría del juego una CASA DE CAMBIO (lavado + regulatorio + baneo
   del bot por ToS de Stars). Las gemas son moneda de UN SOLO SENTIDO: entran
   con dinero, se gastan adentro, NO tienen ninguna ruta a KH/TON.
   Por eso viven en tabla propia (player_gems) y NO en player_resources — los
   recursos tienen ruta de quema a KH (burnResourcesForTokens).
   Testeado en server/tests/paymentService.test.js.

CATÁLOGO (shared/shopConfig.js): GEM_PACKS (pouch/chest/vault/relic, 50–1000
  Stars con bonus 0–30%) + GEM_SINKS (speedup, hero_summon, wave_retry).

FLUJO DE COBRO (paymentService + bot/telegramBot.js):
  1. Cliente pide link:  POST /api/shop/invoice { productId }
     → bot.createInvoiceLink(..., provider_token '', currency 'XTR')
  2. Cliente abre:       Telegram.WebApp.openInvoice(link)
  3. Bot: 'pre_checkout_query' → revalida producto/moneda/precio contra el
     catálogo del server → answerPreCheckoutQuery (Telegram exige < 10s)
  4. Bot: 'successful_payment' → ÚNICA fuente de verdad para acreditar gemas.

INVARIANTES DE SEGURIDAD DEL COBRO:
  ✓ NINGUNA ruta HTTP acredita gemas (el cliente no es fuente de verdad)
  ✓ Idempotencia: telegram_payment_charge_id UNIQUE; el insert del pago y el
    crédito van en la MISMA transacción → un replay de Telegram revienta contra
    el UNIQUE, hace ROLLBACK y no acredita dos veces (probado con replays
    concurrentes)
  ✓ Se acredita a msg.from.id (pagador REAL según Telegram), nunca al id del
    invoice_payload (que el cliente podría manipular)
  ✓ La cantidad de gemas sale del CATÁLOGO del server, nunca del mensaje
  ✓ Gasto de gemas: decrementIfEnough atómico (sin saldo negativo bajo carrera)
  ✓ Los sinks calculan el costo SERVER-SIDE contra el estado real (nunca se
    confía en un precio enviado por el cliente)

⚠️ Requiere BOT_POLLING activo (o webhook): con polling apagado los updates de
   pago NO llegan a este proceso y las compras quedarían sin acreditar.

Migración 028: player_gems, star_payments.
```

### 7.3 Spec de Quema de Recursos

```
Gold:      500 unidades → 5 KH
Crystal:   1 unidad     → 10 KH
Relic:     1 unidad     → 15 KH
Blueprint: 1 unidad     → 12 KH
```

---

## 8. Spec: Sistema de Tareas

### 8.1 Tareas Diarias (reset UTC midnight)

| Task ID | Action | Trigger |
|---------|--------|---------|
| `harvest_5` | `harvest` | `farmService.harvest()` |
| `sell_3` | `sell` | `commerceService.sellToCaravan()` |
| `battle_win_1` | `battle_win` | `combatService.attackPVE/PVP()` |
| `mission_1` | `mission_complete` | `missionService.completeMission()` |
| `login` | `login` | `playerService.initPlayer()` |
| `captcha_daily` | `captcha` | `captchaService.solveChallenge()` |

### 8.2 Spec: Captcha

```
GET /api/tasks/captcha/challenge
  SALIDA: { challengeId, question, type }
  type ∈ ['math', 'sequence', 'word']
  Expira: 5 minutos. Max 5 intentos por challenge.

POST /api/tasks/captcha/solve
  ENTRADA: { answer: string (max 30 chars, /^[a-zA-Z0-9 ]+$/) }
  SALIDA:  { correct: boolean, message: string }
  POST correcto: trackProgress(playerId, 'captcha', 1)

INVARIANTE: El challenge se invalida tras 5 intentos fallidos,
            forzando a solicitar uno nuevo.
```

### 8.3 Tareas Sociales (one-time)

```
- Unirse al canal Telegram — verificado vía bot.getChatMember()
- Invitar 1/5/10 amigos — verificado por referral count en DB
```

---

## 9. Spec: EventBridge (Phaser ↔ React)

### 9.1 Contrato

```
Singleton: client/src/game/EventBridge.js (EventEmitter3)

REGLA: Phaser no importa componentes React. React no importa clases Phaser.
       Toda comunicación va por EventBridge.emit() / EventBridge.on().

LIMPIEZA: Todo useEffect que registre un listener DEBE devolver cleanup:
  return () => EventBridge.off('evento', handler);
```

### 9.2 Eventos Registrados

| Evento | Payload | Dirección | Descripción |
|--------|---------|-----------|-------------|
| `overlay:open` | `{ type, data }` | Phaser → React | Abre panel |
| `overlay:close` | — | React → Phaser | Cierra panel |
| `entity:selected` | `{ entityType, data }` | Phaser → React | Toque en entidad |
| `entity:deselected` | — | Phaser → React | Deselección |
| `building:placed` | `{ buildingId, x, y }` | React → Phaser | Confirmar placement |
| `building:addToScene` | `{ buildingId, posX, posY }` | React → Phaser | Añadir edificio |
| `building:startPlacement` | `{ buildingId, tileIndex }` | React → Phaser | Iniciar modo colocación |
| `building:cancelPlacement` | — | React → Phaser | Cancelar colocación |
| `building:confirmPlacement` | — | React → Phaser | Confirmar colocación |
| `token:earned` | `{ amount, x, y }` | React → Phaser | Texto flotante "+X KH" |
| `time:updated` | `{ icon, period, dayCount }` | Phaser → React | Ciclo día/noche (cada 10 min) |
| `game:notification` | `{ text, type }` | cualquiera → React | Toast UI |
| `game:input` | `{ enabled }` | React → Phaser | Lock/unlock input |
| `placement:started` | — | Phaser → React | Modo colocación activo |
| `placement:ended` | — | Phaser → React | Modo colocación terminado |

---

## 10. Spec: Visual / UI

### 10.1 Paleta (tailwind.config.js)

```
kingdom-bg:     #1a1a2e  — fondo general
kingdom-card:   #16213e  — paneles/cards
kingdom-accent: #e94560  — botones, highlights
kingdom-gold:   #ffd700  — texto importante, XP, nivel
kingdom-green:  #4ade80  — éxito, cultivos
kingdom-blue:   #0f3460  — paneles secundarios
```

### 10.2 Tipografía

- **MedievalSharp** serif → títulos, niveles, etiquetas de recursos
- System sans-serif → texto de cuerpo, descripciones

### 10.3 Spec de Sprites

```
SPRITES DE UI (/public/assets/sprites/):
  Componente: SpriteIcon — CSS background-position clipping
  Íconos disponibles: medal, scroll, castle_flag, reward_bag, backpack, farmer, etc.

TILESETS (/public/assets/game/tilesets/):
  buildings.png  — 512×512, frames 128×128 en grid 4×4 (16 edificios)
    frameWidth: 128, frameHeight: 128 (BootScene.js)
    BUILDING_SIZE en pantalla: 96px (Building.js)
  terrain.png    — 512×512, tiles 32×32 (19 tipos de terreno, 16/fila)
  farm_tiles.png — 256×256, stages 64×64 (4 etapas × 2 estados seco/regado)

⚠️  Los assets bajo /public/assets/game/ están GITIGNOREADOS (no se commitean).
    Tras un clone fresco, regenerar placeholders: node scripts/gen_placeholders.js
    Specs completas para el artista: docs/art-spec.md + docs/SPRITE_SHOPPING_LIST.md

ANCLAS DE TERRENO POR ZONA (/public/assets/game/zones/, WorldScene top-down):
  Técnica "generación por zonas" — en vez de tiles teselables (que la IA no
  hace) o una lámina gigante, el mapa 32×32 se parte en grilla de 8×8 tiles y
  cada zona ancla UNA imagen IA de terreno grimdark según su bioma dominante.
  systems/ZoneAnchors.js dibuja a depth 0.5 (sobre tiles planos, bajo decals y
  gameplay); flipX/flipY por zona rompe la repetición. STREAMING: el mundo NO
  vive entero en memoria de render — systems/ZoneStreamer.js construye cada
  zona (tiles+ancla+decals+decoraciones vía WorldScene.buildZone) cuando entra
  a cámara (+1 zona de margen) y la destruye al salir (~4 checks/s). Las
  entidades de gameplay (edificios/NPCs/cultivos/animales) no se streamean.

ÍCONOS UI GRIMDARK (/public/assets/sprites/grim_icons.png):
  Sheet 8 col × celdas 128px con ~54 íconos originales; generado por
  gen_icons.sh + assemble_icon_sheet.js, que también escribe el manifiesto
  client/src/config/grimIconSheet.generated.js (GRIM_ICONS nombre→col/row).
  spriteMap.getSprite resuelve PRIMERO contra el set grim (tabla GRIM_ALIASES
  re-mapea alias legacy: militia→sword, nav_farm→farmhouse, streak→flame...)
  y cae a los sheets medievales viejos si falta. TopResourceBar usa SpriteIcon
  con fallback emoji.

RETRATOS DE HÉROE (/public/assets/game/heroes/<id>.png, 160px):
  18 retratos (10 héroes base + 8 nuevos 40k-INSPIRADOS originales: varok,
  morghal, azyra, fenn, kryx, serafina, gorr, nyx — ver HEROES en
  gameConfig.js). gen_heroes.sh los genera; HeroPanel los muestra con
  fallback onError al CharacterSprite legacy. Botón Héroes del BottomNavBar
  abre el overlay 'heroes' (antes abría 'troops' como stand-in). Familias (2 variantes
  grass/dirt, 1 sand/snow/ice): zone_<familia>_<n>.png. Genera: gen_zones.sh
  (Nano Banana → downscale 512px). No-op si el arte falta → fallback a tiles.

PERSONAJES NPC (/public/assets/game/characters/npc_<rol>.png):
  Sheet DIRECCIONAL 4×3 (128×144, frame 32×48): fila 0 = down (frente, 0-3),
  fila 1 = up (espalda, 4-7), fila 2 = side (perfil der., 8-11; izq = flipX).
  7 roles grimdark ORIGINALES (farmer/baker/princess/wizard/knight/merchant/
  ranger). El arte IA trae alpha propio -> NO se chroma-keya (BootScene los
  sacó de chromaKeyTargets). Diseños sin marcas de terceros (IP art-style.md).
  Tubería (todo one-image-por-dirección para consistencia; process_art limpia
  bg): gen_chars.sh (sprite estático) -> gen_walks.sh (tira 4 poses side,
  assemble_walk.js) -> gen_dirs.sh (tiras front/back/side, assemble_dirs.js
  apila con ESCALA COMPARTIDA + pies al piso). NPC.js elige la dirección por el
  vector de movimiento (diagonales -> cardinal más cercana) y reproduce
  walk_<dir>/idle_<dir>; alias legacy `_idle`/`_walk` (down) para Villager.
  Bestias de granja (chicken/cow/sheep 32×32) por gen_animals.sh.
  Handle de test: window.__phaserGame (solo DEV, PhaserGame.jsx).
```

### 10.5 Modo Isométrico (experimento)

```
Escenas registradas en client/src/game/config.js:
  WorldScene     — top-down, ACTIVA por defecto
  IsoWorldScene  — experimento iso 2:1 (rama WiFOf); se activa con ISO_MODE=true
                   (constante hardcodeada en config.js, ya no lee VITE_ISO_MODE)
  IsoScene       — POC iso legacy (rama iso-rework); se activa con URL ?iso=1

Decisión de estilo documentada en docs/art-style.md.
```

### 10.4 Clases CSS Canónicas

```css
.game-card      /* card oscura con borde dorado */
.btn-primary    /* botón rojo accent */
.btn-gold       /* gradiente amarillo-dorado */
.sprite-icon    /* image-rendering: pixelated */
.progress-bar / .progress-fill
```

Animaciones custom: `fadeIn`, `pulse-gold`, `shake`, `grow` (index.css)

---

## 11. Spec: Seguridad

### 11.1 Invariantes de Seguridad (nunca violar)

```
AUTH:
  ✓ Toda ruta HTTP usa telegramAuth middleware (HMAC-SHA256 + ventana 5 min)
  ✓ WebSocket auth: misma validación HMAC en evento 'join_game'
  ✓ Dev bypass (SKIP_AUTH / x-skip-auth) SOLO activo si NODE_ENV !== 'production'
  ✓ window.__gameStore expuesto SOLO si import.meta.env.DEV (Vite lo elimina en build)

SQL:
  ✓ Nunca concatenar valores en queries — usar placeholders ?
  ✓ Nombres de columnas/tablas pasan por sanitizeIdentifier() whitelist
  ✓ Operadores pasan por sanitizeOperator() whitelist

RATE LIMITING:
  ✓ HTTP: 100 req/min por IP
  ✓ WebSocket: 30 events/min por socket

INPUT:
  ✓ Body JSON máximo 16 KB
  ✓ Strings de usuario: maxLength validado por validate() middleware
```

---

## 12. Spec: Performance

```
ESCRITURAS DB:
  - saveToDisk() está debounced 2s (batching automático)
  - Flush sincrónico en SIGINT/SIGTERM
  - A 1000+ jugadores: agregar Redis para estado de jugador frecuentemente leído

GAME TICK:
  - gameTick.js ejecuta subsistemas con try-catch INDEPENDIENTE por subsistema
  - Un subsistema que falla no bloquea los demás

QUERIES:
  - Índices en todas las columnas player_id (migration 004_add_indexes.js)
  - Leaderboard: JOIN único, no bucle N+1
```

---

## 13. Spec: Criterios de Aceptación por Feature

### Para cualquier feature nueva, está COMPLETA cuando:

```
[ ] Servicio: lógica en server/src/services/ con inputs/outputs documentados
[ ] Ruta: endpoint en server/src/routes/ con telegramAuth + validate()
[ ] Config compartida: constantes en shared/gameConfig.js o tokenConfig.js
[ ] Migración: si hay cambio de schema, 00N_descripcion.js creado
[ ] Tests: Jest tests en server/tests/ (mantener 228/228 — DB in-memory, ver §3.2)
[ ] Store: estado en gameStore.js si el cliente necesita persistencia
[ ] Componente: UI en client/src/components/
[ ] EventBridge: eventos documentados en §9.2 si hay comunicación Phaser↔React
```

---

## 14. Spec: Estado de Implementación

### Phase 1 — MVP ✅ Completo

| Feature | Tests | Estado |
|---------|-------|--------|
| Farm system (7 cultivos + 3 animales) | ✓ | ✅ |
| Construcción + upgrades (14 tipos, 4 zonas) | ✓ | ✅ |
| Misiones NPC + comercio caravanas | ✓ | ✅ |
| Entrenamiento tropas + combate PvE | ✓ | ✅ |
| Auth Telegram HMAC + Mini App | ✓ | ✅ |
| Economía KH Token (cap, streak, referral, retiro) | ✓ | ✅ |
| Tareas diarias/sociales + streaks | ✓ | ✅ |
| UI React + Phaser mobile-first | ✓ | ✅ |
| Sprites: placeholders gitignoreados + brief de artista | — | ✅ |
| **Total tests** | **228/228 pasando** | ✅ |

### Phase 2 — En Progreso

| Feature | Spec | Implementado |
|---------|------|-------------|
| PvP combat completo | §6.2 | ⏳ esqueleto |
| Sistema de facciones | — | ✅ UI + seed en arranque |
| Mapa territorial + conquista | — | ✅ TerritoryMapPanel + tributos |
| Tech tree (Library) | — | ⏳ |
| Push notifications bot (crop/troop ready) | — | ✅ notificationService + prefs (migración 019) |
| Torneos, guilds, prestigio, marketplace P2P | — | ✅ migraciones 010–016 |
| Experimento isométrico (2 escenas, flag-gated) | §10.5 | ⏳ en evaluación |

### Phase 3 — Capa Idle (2026-07-04, "juego idle grimdark")

| Feature | Implementado |
|---------|-------------|
| F1: Menú de inicio + Settings v2 (9 prefs notif + audio + gráficos) | ✅ |
| F1: Reporte offline "Mientras no estabas" (snapshots + catch-up 12h por caída del server, heartbeat + server_downtime, migración 021) | ✅ `idleService` |
| F2: Tormentas Disformes — 5 tipos aleatorios (WARP_STORMS), modificadores en farm/KH/ATK/research, convoyes sellados, banner + viñeta reactiva, socket + bot (migración 022) | ✅ `stormService` |
| F3: Marea Disforme — defensa por oleadas 100% automática, sim por rondas server-side, boss cada 5, replay log, recompensas KH source `wave_defense` (migración 023) | ✅ `waveDefenseService` |
| F4: Escuadras (5 slots, migración 024) + HERO_SKILLS auto-disparadas por energía + CLASS_BONUSES por fin en el combate real + recovery | ✅ |
| F5: techs de comercio conectadas (trade_routes, caravan_master) + research 30min×tier | ✅ |

### Bugs Conocidos (auditoría 2026-07-02, fixes aplicados el mismo día)

| Issue | Severidad | Estado | Ubicación |
|-------|-----------|--------|-----------|
| Economía KH rota: `db.raw()` ejecutaba inmediato pero tokenService lo usaba estilo Knex como valor de `.update({...})` | CRITICAL | ✅ Resuelto: `db.raw` ahora es lazy (clase `Raw`) y `update()` inserta fragmentos raw | `database.js`, `tokenService.js` |
| `LEAST`/`GREATEST`/`rowCount` (dialecto PostgreSQL) en SQL crudo → rompía TODA ganancia de recursos y el tick de aldeanos | CRITICAL | ✅ Resuelto: `MIN`/`MAX`/`count` | `playerService.js:201`, `villagerService.js:72-108` |
| Upsert `ON CONFLICT` de marketService fallaba: `player_resources` no tenía UNIQUE(player_id, resource_id) | HIGH | ✅ Resuelto: migración 020 (dedupe + índice único) | `migrations/020_player_resources_unique.js` |
| Infra de tests era Knex/PostgreSQL: sin `migrate.rollback()`, sin modo test (apuntaba a la DB real) | HIGH | ✅ Resuelto: modo test in-memory (`NODE_ENV=test`), `rollback()` implementado, `insert()` bulk | `database.js`, `tests/setup.js` |
| Throttle de aldeanos (gate 5 min, `villager_last_tick`) perdido en el merge — se simulaba cada tick | MEDIUM | ✅ Resuelto: restaurado de rama WiFOf | `gameTick.js` §4c |
| Config de héroes (HEROES, HERO_RARITIES, HERO_ITEMS) perdida en el merge — heroService crasheaba | HIGH | ✅ Resuelto: restaurada de rama WiFOf | `shared/gameConfig.js` |
| `db.transaction`/`forUpdate` (Knex) no existían en el builder | MEDIUM | ✅ Resuelto: BEGIN/COMMIT/ROLLBACK reentrante; `forUpdate()` no-op (SQLite es single-writer) | `database.js` |
| 8 migraciones llamaban `db.raw` sin `await` (rompería con raw lazy) | MEDIUM | ✅ Resuelto: `async` + `await` añadidos | `migrations/005–012` |
| Deps huérfanas `knex` + `pg` en package.json (la migración a PostgreSQL de 24e7d7d fue revertida al builder sql.js, las deps quedaron) | LOW | ⚠️ Known | `server/package.json` |
| Migraciones con números duplicados (005×2, 006×2 … 012×2) por merge de dos ramas. NO es bug funcional: el runner trackea por nombre de archivo completo y ordena lexicográficamente. Para nuevas migraciones usar 021+ | LOW | ⚠️ Known | `server/migrations/` |
| TON tx hash era pseudo | LOW | ✅ Resuelto: envío real @ton/ton + confirmación por seqno + hash real; sin confirmar → needs_review (nunca hash inventado). Safety de payout: presend→refund / incierto→needs_review, cap diario, kill-switch, recuperación de processing colgado (migración 027) | `tokenService.sendTON/processPendingWithdrawals` |
| PvP no completamente implementado | MEDIUM | ⏳ Phase 2 | `combatService.js` |

---

## 15. Dev Commands (local — PC Windows)

> El desarrollo y la ejecución ocurren en esta PC (PowerShell). El VPS está apagado.

```powershell
# Servidor (Express → :3001)
cd server; npm run dev            # nodemon
cd server; node src/index.js      # arranque directo
cd server; npm test               # Jest — ⚠️ infra rota, 45/228 pasan (ver §14)

# Cliente (Vite → :5173)
cd client; npm run dev
cd client; npm run build          # Build prod → client/dist/

# Sprites placeholder (tras clone fresco — assets/game/ está gitignoreado)
node scripts/gen_placeholders.js

# Screenshots UI (requiere servidor + Vite corriendo)
$env:SKIP_AUTH = 'true'; node server/src/index.js   # terminal 1
cd client; npm run dev                              # terminal 2
node scripts/screenshot_ui.js                       # terminal 3
```

**Variables de entorno** (`server/.env`):

| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `BOT_TOKEN` | ✅ | Telegram bot token |
| `WEBAPP_URL` | ✅ | URL de la Mini App (CORS) |
| `BOT_POLLING` | opcional | `false` desactiva el polling del bot (usar si otra instancia ya está polleando con el mismo token) |
| `PORT` | opcional | Puerto del servidor (default: 3001) |
| `TICK_INTERVAL_MS` | opcional | Intervalo del game tick (default: 60000) |
| `TON_HOT_WALLET_MNEMONIC` | ✅ para retiros | Mnemónico 24 palabras del hot wallet (o archivo en `server/secrets/`) |
| `TON_API_KEY` | opcional | TonCenter API key (evita rate limits) |
| `TON_NETWORK` | opcional | `testnet` \| `mainnet` (default: testnet) |
| `REDIS_URL` | opcional | Cache + rate limit compartido; sin Redis usa memoria local |
| `SENTRY_DSN` | opcional | Monitoreo de errores |

**Base de datos local:** `server/data/kingdoms.db` (sql.js). Las migraciones se aplican
solas al arrancar. Los tests corren con `NODE_ENV=test` → DB in-memory, nunca tocan
`data/kingdoms.db`.

**Deploy (VPS — actualmente APAGADO, solo referencia):** PM2 (`ecosystem.config.js`) +
Nginx (`deploy/nginx.conf.template`, ver `deploy/setup-vps.sh`). El servidor Express
sirve `client/dist/` como estáticos con SPA fallback. Para exponer la Mini App desde
esta PC usar un túnel (p. ej. cloudflared / ngrok) y actualizar `WEBAPP_URL` —
ver `deploy/update-tunnel-url.sh`.
