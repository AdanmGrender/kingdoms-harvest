# 🏰 Kingdoms Harvest — Prompt de Continuación para Claude Code (Opus 4.6)

> **Modelo:** `claude-opus-4-7`
> **Proyecto:** `C:\Users\manes\Desktop\kingdoms-harvest`
> **Stack:** Node.js/Express + React/Vite + Phaser 3 | SQLite (sql.js) | Telegram Mini App + TON

---

## CONTEXTO DEL PROYECTO

Kingdoms Harvest es un Telegram Mini App game que combina mecánicas de farming con guerra de castillos. Arquitectura full-stack:

- **Client:** React 18 + Vite + Phaser 3 (game engine) + TailwindCSS
- **Server:** Express + Socket.IO + sql.js (SQLite) + node-cron (game tick cada 60s)
- **Shared:** `shared/gameConfig.js` (recursos, cultivos, edificios, tropas) + `shared/tokenConfig.js` (economía KH Token → TON)
- **Phaser scenes:** `BootScene.js` (carga assets) → `WorldScene.js` (mapa RTS god-view 160x120 tiles)
- **Sistemas Phaser:** `CameraSystem.js` (drag-pan + pinch-zoom + WASD), `SelectionSystem.js` (tap-to-select), `BuildingPlacementSystem.js`, `DayNightSystem.js`, `ParticleSystem.js`
- **Server services:** `farmService`, `buildingService`, `combatService`, `siegeService`, `missionService`, `tokenService`, `villagerService`, `dailyTaskService`, `commerceService`, `referralService`

---

## TAREAS PRIORIZADAS (ejecutar en orden)

### 🔴 TAREA 1 — ARREGLAR SPRITES DE TERRENO

**Problema:** El `MapGenerator.js` usa un tileset `terrain.png` con solo ~19 tile indices que se repiten generando terreno visualmente monótono. El terreno no luce parejo ni natural.

**Archivos clave:**
- `client/src/game/maps/MapGenerator.js` — generador procedural con noise-based terrain
- `client/src/game/scenes/BootScene.js` — carga `terrain.png` como tileset
- `client/src/game/scenes/WorldScene.js` — `createTilemap()` usa los layers ground/decoration/collision
- `client/public/assets/game/tilesets/terrain.png` — tileset actual (32x32 tiles)

**Qué hacer:**
1. Reemplazar `terrain.png` con un tileset de alta calidad basado en assets de **Liberated Pixel Cup (LPC)**. Fuente: https://opengameart.org/content/lpc-terrain
2. Actualizar los tile indices en `MapGenerator.js` (const `T = {...}`) para mapear al nuevo tileset LPC.
3. Implementar autotiling (terrain transitions) — sistema de autotile 4-bit o Wang tiles para transiciones suaves grass↔dirt, grass↔water, grass↔sand.
4. Agregar al menos 4-6 variantes de grass tiles, 2-3 de dirt, decoraciones de suelo para romper repetición.
5. El terreno debe verse PAREJO sin saltos bruscos entre tiles que no encajan.
6. Actualizar `TILE_SIZE` si el nuevo tileset usa dimensiones diferentes (LPC estándar: 32x32).

---

### 🔴 TAREA 2 — ARREGLAR TOUCH/TÁCTIL PARA MÓVILES

**Problema:** En móviles el input táctil no funciona: no se selecciona terreno/entidades, pinch-to-zoom no responde.

**Archivos clave:**
- `client/src/game/systems/CameraSystem.js` — drag-pan + pinch-zoom + wheel
- `client/src/game/systems/SelectionSystem.js` — tap-to-select con `TAP_THRESHOLD = 18px`
- `client/src/game/config.js` — configuración Phaser (falta config de input)

**Qué hacer:**
1. Agregar configuración de input en `config.js`: `input: { activePointers: 3, touch: { capture: true } }`
2. Fix conflicto Camera vs Selection: agregar flag `hasDragged` en CameraSystem, verificar en SelectionSystem antes de procesar tap.
3. Fix pinch-to-zoom: manejar caso donde un dedo se levanta, resetear pinchDistance al cambiar cantidad de pointers.
4. Agregar `window.Telegram.WebApp.expand()` y `disableVerticalSwipes()` para Telegram WebView.
5. `preventDefault()` en canvas touch events para evitar browser gestures.

---

### 🔴 TAREA 3 — ARREGLAR SUPERPOSICIÓN DE PLANTACIONES

**Problema:** CropPlots se superponen visualmente (64x64px display, spacing insuficiente o offset incorrecto).

**Archivos clave:**
- `client/src/game/entities/CropPlot.js` — `setDisplaySize(64, 64)`
- `client/src/game/maps/MapGenerator.js` — grid `55 + c*7, 52 + r*6`
- `client/src/game/scenes/WorldScene.js` — `createFarmPlots()`

**Qué hacer:**
1. Recalcular spacing de farm plots verificando coordenadas reales en píxeles.
2. Ajustar origin del sprite, verificar centrado correcto.
3. Implementar depth sorting dinámico basado en posición Y.
4. Agregar visual boundary (borde de tierra arada) a cada plot.
5. Verificar que farm_tiles.png no tiene padding/margin causando bleeding.

---

### 🟡 TAREA 4 — MEJORAR CALIDAD VISUAL DE SPRITES (LPC)

**Problema:** Sprites actuales son placeholder de baja calidad.

**Qué hacer:**
1. Adoptar estándar Liberated Pixel Cup (LPC) como base artística.
2. Fuentes LPC (OpenGameArt.org): `lpc-terrain`, `lpc-farming-tilesets`, `lpc-character-generator`, `lpc-animals`, `lpc-buildings`.
3. Mantener frame sizes que BootScene.js espera (32x48 NPCs, 32x32 animals, 64x64 buildings).
4. Actualizar animaciones en BootScene.js con frame ranges del nuevo spritesheet.
5. Los sprites de alta resolución en `/sprites/` usar como fondos de menús/overlays React.

---

### 🟡 TAREA 5 — REVISAR GESTIÓN INTERNA DE RECURSOS DEL SERVIDOR

**Qué revisar:**
1. **Bug: `await` faltante** en `gameTick.js` línea ~107 — `db.raw()` sin await, producción de edificios no se aplica.
2. **Race conditions** en `missionService.completeMission()` — wrappear en `db.transaction()`.
3. **Memory leak** en `productionAccumulators` — agregar cleanup periódico de jugadores inactivos.
4. **N+1 queries** en tick loop — refactorizar a batch queries.
5. **sql.js persistencia** — implementar auto-save periódico a disco (cada 5 min).
6. **Rate limiting** — verificar en todas las rutas sensibles.

---

### 🟢 TAREA 6 — POPUP DE ADS CON RECOMPENSA

**Qué hacer:**
1. Integrar **Adsgram** SDK para Telegram Mini Apps (rewarded video ads).
2. Crear `RewardedAdPopup.jsx` con preview de recompensa + botón "Ver Anuncio".
3. Triggers: después de cosecha (doble), fin de construcción (bonus), completar misión (tokens extra), botón HUD.
4. Server-side validation: `POST /api/ads/claim-reward` con cooldown anti-cheat.

---

### 🟢 TAREA 7 — TOKENS CONVERTIBLES A TON

**Estado:** Parcialmente implementado (tokenConfig, tokenService, WalletPanel).

**Qué hacer:**
1. Verificar que `tokenService.processWithdrawals()` funciona con `tonweb`.
2. Integrar TON Connect UI en cliente (manifest ya existe).
3. UI de withdrawal: balance → input cantidad → preview TON → confirmar → estado.
4. Dashboard de economía (tokens en circulación, retiros, inflación).

---

### 🟢 TAREA 8 — MISIONES Y LOGROS CON RECOMPENSAS

**Estado:** Misiones ya implementadas en server. Falta: achievements y UI panels.

**Qué hacer:**
1. Definir ~10 achievements en `shared/gameConfig.js` con rewards de tokens + XP.
2. Crear tabla `player_achievements` (player_id, achievement_id, progress, target, completed_at, claimed).
3. Achievement tracking service invocado desde cada service relevante.
4. UI: AchievementsPanel (grid cards con progreso) + MissionsPanel (lista activas con timer).
5. Notificación toast al desbloquear logro.

---

## PRIORIDAD DE EJECUCIÓN

| # | Tarea | Prioridad | Impacto |
|---|-------|-----------|---------|
| 1 | Sprites de terreno (LPC) | 🔴 CRÍTICA | Visual — juego se ve roto |
| 2 | Touch/táctil móvil | 🔴 CRÍTICA | Jugabilidad — no funciona en móvil |
| 3 | Superposición plantaciones | 🔴 CRÍTICA | Visual — crops se pisan |
| 4 | Calidad visual sprites | 🟡 ALTA | Visual — placeholders |
| 5 | Gestión recursos server | 🟡 ALTA | Estabilidad — bugs datos |
| 6 | Popup ads recompensa | 🟢 MEDIA | Monetización |
| 7 | Tokens → TON | 🟢 MEDIA | Economía |
| 8 | Misiones y logros | 🟢 MEDIA | Engagement |

**Ejecutar 🔴 primero, luego 🟡, luego 🟢.**
