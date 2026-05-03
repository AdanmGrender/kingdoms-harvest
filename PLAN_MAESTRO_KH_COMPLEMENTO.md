# 🩹 KINGDOMS HARVEST — Complemento al Plan Maestro
## Hallazgos del estado real (escaneo 2026-05-02)

> Este documento **complementa** `PLAN_MAESTRO_KH.md`. No lo reemplaza.
> Es la lista de issues descubiertos al ejecutar el juego, comparados contra
> los screenshots reales en `scripts/screenshots/01..16_*.png`.
>
> Branch escaneado: `iso-rework` @ `27f7ec5` (ShadowSystem + UI fixes mergeados)
> Método: `npm run dev` local + `node scripts/screenshot_ui.js` (Puppeteer 390×844 @2x)

---

## 🟥 ESTADO ONLINE — el juego está OFFLINE para Telegram

| Recurso | Estado | Detalle |
|---|---|---|
| `WEBAPP_URL` (`cars-intake-camcorder-guitars.trycloudflare.com`) | ❌ HTTP 000 | El túnel Cloudflare temporal expiró |
| Servidor local 3001 | ✅ Bind OK al limpiar orphan PIDs | crash con `EADDRINUSE` si hay zombi |
| Vite local 5173 | ✅ Sirve el cliente | mismo riesgo de orphan |
| Bot Telegram polling | ⚠️ `409 Conflict: terminated by other getUpdates` | Otra instancia (¿VPS?) también está consumiendo updates |
| VPS PM2 | ❓ Sin verificar | `deploy/setup-vps.sh` sugiere VPS+nginx pero no se sabe si sigue vivo |

### Fix-to-online (prioridad **HOY**)

1. **Decidir hosting canónico** — VPS o local+tunnel. Hay dos despliegues posibles compitiendo por el bot token (causa del 409).
2. **Si local+tunnel:** levantar `cloudflared tunnel --url http://localhost:3001`, capturar URL nueva, actualizar:
   - `server/.env` `WEBAPP_URL=<nueva>`
   - `setChatMenuButton` del bot (script `deploy/update-tunnel-url.sh` ya lo hace pero apunta a paths del VPS — necesita adaptarse a Windows)
   - Reinicio del server con `--update-env`
3. **Si VPS:** confirmar PM2 corriendo en el host, y matar el polling local antes de re-conectarse.
4. **Crear `npm run dev:safe`** que mate procesos huérfanos en 3001/5173 antes de levantar — el `EADDRINUSE` + assertion crash de libuv que vimos hoy se repite cada vez que un nodemon previo no muere limpio.

---

## 🐞 BUGS VISUALES OBSERVADOS EN SCREENSHOTS

> Severidad: 🔴 rompe UX · 🟡 fea pero usable · 🟢 polish

### B-01 🔴 Sprite roto en estructura inferior-izquierda
**Visible en:** 02, 04, 05, 06, 07, 08, 10, 11, 12, 13, 14, 15, 16 (todas las vistas world)
**Síntoma:** un edificio en la esquina inferior-izquierda aparece como bloque blanco/gris fragmentado.
**Causa probable:** el cambio de threshold chroma-key a 252 en `BootScene.js` (commit `ce74308`) pasó muy cerca del color del techo de ese sprite y le comió pixeles. Otros buildings se ven OK con el mismo threshold.
**Fix sugerido:** auditar cada cell de `buildings.png` en Phaser debug. Considerar pre-procesar el atlas a PNG con alpha real en vez de usar chroma-key runtime.

### B-02 🔴 Marcadores "$" / "S" sueltos sobre el terreno
**Visible en:** 02, 07, 08, 10, 11, 12, 14, 15
**Síntoma:** símbolos pequeños tipo "$" flotan sobre grass/dirt sin contexto.
**Causa probable:** placeholders de resource nodes (gold/stone) en `IsoMapGenerator.js → RESOURCE_TYPES` que renderizan texto en vez del sprite, o sprite no cargado.
**Fix sugerido:** revisar `WorldScene.drawDecorations()` y/o el ramo de resources — confirmar que cada `RESOURCE_TYPES.<x>.tileId` mapea a una clave existente en el atlas.

### B-03 🔴 Labels de villagers se apilan ilegibles
**Visible en:** 11 (clúster Brynn/Cedric/Aldric), 13, 14, 15
**Síntoma:** cuando 2+ villagers están a <40px de distancia, sus labels se superponen y forman texto borroso.
**Fix sugerido:** en `Villager.js` añadir `nameLabel.setVisible(false)` cuando otro villager está dentro de N pixeles, o usar `setDepth` + offset vertical alternado, o solo mostrar label al hover/select.

### B-04 🟡 Resource bar truncada por el avatar/level
**Visible en:** 03 (HUD close-up)
**Síntoma:** el primer recurso (madera, 50) queda parcialmente oculto detrás del badge de nivel.
**Fix sugerido:** en `GameHUD.jsx` reducir `min-w` del bloque del avatar o limitar a 6 chars en `displayName`. Alternativa: mover XP bar bajo el avatar a una segunda línea.

### B-05 🟡 Botones de acción del overlay tapan el bottom-nav
**Visible en:** 14 (`Entrenar Milicia` → `Entre…licia`), 15 (`Cosechar Zanahoria` → `Cose…nahoria`)
**Síntoma:** el botón de acción pleno-ancho del overlay queda detrás de Héroes/Construir/Mundo y se trunca.
**Causa:** z-index del bottom-nav > z-index del action-button del overlay, pero el overlay no reserva padding inferior para evitar superposición.
**Fix sugerido:** añadir `pb-[80px]` al contenedor del overlay o subir z-index del action-button con `padding-bottom` matching la altura de `BottomNavBar`.

### B-06 🟡 Sidebar derecho de eventos sobresale del viewport
**Visible en:** 02, 12, 13 (todas)
**Síntoma:** los botones verticales (Paquete 23h59m, Evento valor, Especial, Asedio) tienen su lado derecho cortado fuera de pantalla.
**Fix sugerido:** envolver `EventSidebar` en `right-0` en lugar de `right-[N]px` y dar `max-w-[60px]` con icono+texto vertical. Alinear con safe-area-inset-right en iOS.

### B-07 🟡 VillagerPanel: botón principal cortado por sidebar izquierdo
**Visible en:** 10 (`…gnar a edificio`)
**Síntoma:** el botón "Asignar a edificio" empieza ya pegado al sidebar izquierdo y se le come la primera letra.
**Fix sugerido:** padding horizontal mínimo de 60px en la fila inferior del overlay.

### B-08 🟡 Tabs del building toolbar sin estado activo claro
**Visible en:** 04, 05, 06
**Síntoma:** "Granja / Defensa / Social / Noble" parecen 4 textos planos. La tab activa solo se distingue por subrayado fino apenas visible.
**Fix sugerido:** background pill dorado o accent-red en la tab activa, no solo underline.

### B-09 🟡 Tutorial dim oscurece UI funcional
**Visible en:** 01
**Síntoma:** el dim del tutorial cubre los sidebars y los hace ver "encendidos" en gris.
**Fix sugerido:** el tutorial debería usar un spotlight (clip-path) sobre el elemento highlightado en vez de un dim global.

### B-10 🟢 Avatar `Dev` muestra "100" sin unidad
**Visible en:** todas
**Síntoma:** después del nombre `Dev` aparece "× 100" — ¿es power? XP? gold? No se sabe.
**Fix sugerido:** añadir tooltip o icono explícito (escudo→power, espada→ATK, etc.).

### B-11 🟢 Edificios starter no aparecen en el mundo
**Visible en:** 02, 12, 13 etc.
**Síntoma:** El plan maestro lista edificios iniciales (Town Hall, Granja, Cuartel) pero el mapa solo muestra villagers + decoraciones + 1 estructura rota (B-01).
**Causa probable:** `WorldScene.drawBuildings()` itera `mapData.objects.filter(o => o.type === 'building')`, pero el seed de objects vacío para player nuevo, o el endpoint `/api/buildings/list` devuelve `[]`.
**Fix sugerido:** auditar `playerService.initPlayer()` — debería sembrar Town Hall + 1-2 starter buildings, ya que la mecánica de upgrade no funciona sin nada que upgradear.

---

## ⚙️ ISSUES TÉCNICOS / DX

### T-01 🔴 No hay aislamiento entre instancias de bot polling
Cuando hay un VPS y un dev local apuntando al mismo `BOT_TOKEN`, ambos hacen `getUpdates` y Telegram devuelve `409 Conflict`. **El primero que arranca gana, el otro queda muerto sin notificarlo en UI.**
**Fix:** flag `BOT_POLLING=false` en `.env` para los devs locales que no necesitan recibir mensajes del bot, solo mandarlos. O un segundo bot-token de dev separado.

### T-02 🟡 `dev:server` no detecta puerto ocupado y crashea libuv
Síntoma observado hoy: `EADDRINUSE` → `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)` → muere sin reiniciar.
**Fix:** wrapper script que libere 3001 antes de listen, o catch del error y exit limpio en `start()` de `index.js`.

### T-03 🟡 Cliente sigue vivo si server muere
Vite no sabe que el backend cayó; el usuario ve "Error al iniciar el juego" pero sin contexto. Conviene un health-poll en `gameStore` que muestre overlay "servidor desconectado".

### T-04 🟢 Screenshots automatizados no validan visualmente
`scripts/screenshot_ui.js` toma fotos pero nadie compara contra baseline. Para CI conviene `playwright` (ya instalado!) con visual regression — o como mínimo `pixelmatch` contra baseline commiteado.

### T-05 🟢 `package.json` tiene 2 librerías de screenshot redundantes
Tras el merge quedaron `playwright` y `puppeteer` como devDeps. Dos herramientas para lo mismo. Decidir y eliminar la otra.

### T-06 🟢 `node_modules` raíz solo se llenó al `npm install` manual
El script `screenshot_ui.js` falla sin ese install — añadir `postinstall` o documentar en CLAUDE.md.

---

## 🎮 GAPS DE CONTENIDO RESPECTO AL GDD

| GDD pide | Estado real | Brecha |
|---|---|---|
| Sistema de facciones (4 facciones, bonus, guerras) | DB sembrada, sin UI ni lógica | Pendiente Fase 2 |
| Tech tree (3 ramas Biblioteca) | No existe | Pendiente Fase 2 |
| Mapa de territorios | No existe | Pendiente Fase 2 |
| PvP funcional | Solo PvE estable; PvP marcado ⏳ | Pendiente Fase 2 |
| Push notifications crop/troop ready | No existe | Pendiente Fase 2 |
| Trading entre jugadores | No existe | Fase 3 |
| Alianzas/cooperativos | No existe | Fase 3 |
| Vista isométrica real | Top-down con tiles iso-naming pero proyección plana | **Fase 1.1 del plan maestro** |
| Edificios painted estilo ilustrado | Pixel art Kenney top-down | **Fase 1.2 del plan maestro** |
| HUD lateral derecho con eventos rotativos | Botones presentes pero off-screen y sin lógica de evento real | Pendiente |

---

## 🗺️ PRIORIZACIÓN RECOMENDADA

> Reordena las prioridades del Plan Maestro original en función de lo que **bloquea el playtest hoy**.

### 🟥 Sprint 0 — "Volver online y jugable" (3-5 días)
**Objetivo:** que cualquier usuario pueda abrir Telegram, tocar el bot, jugar 5 minutos sin tropezarse.

1. Decidir VPS vs tunnel y restaurar `WEBAPP_URL` válido (online)
2. **B-01** sprite roto — auditar chroma-key buildings
3. **B-02** símbolos "$" sueltos — corregir tileIds de resources
4. **B-05** action-button tapado por bottom-nav — padding inferior
5. **B-11** sembrar starter buildings al `initPlayer()`
6. **T-01** bot polling exclusivo (BOT_POLLING flag) o segundo token dev
7. **T-02** dev:server resiliente a puerto ocupado

### 🟧 Sprint 1 — "UI mobile pulida" (1 semana)
Cierra los bugs visuales restantes que se ven en cada screenshot.

8. **B-03** labels villager con anti-overlap
9. **B-04** HUD truncation (avatar más estrecho)
10. **B-06** event sidebar respeta safe-area
11. **B-07** villager-panel padding horizontal
12. **B-08** building-toolbar tab activa con pill
13. **B-09** tutorial spotlight en vez de dim global
14. **B-10** clarificar la unidad bajo el nombre `Dev`

### 🟨 Sprint 2 — "Visual upgrade" (sigue Plan Maestro Fase 1)
A partir de aquí entra el plan original sin cambios:
- 1.1 Migración isométrica real
- 1.2 Buildings painted (IA + retoque)
- 1.3 Terreno isométrico con autotile
- 1.4 Efectos atmosféricos

### 🟩 Sprint 3+ — "Sistemas core Phase 2" (4-5 semanas según plan original)
Sin cambios respecto al Plan Maestro. Heroes, alianzas, eventos, mapa mundial.

---

## ✅ LO QUE YA FUNCIONA (no romper)

Para que el próximo desarrollador no destruya cosas que sí están bien:

- ✅ HUD con SpriteIcons (reciente, post-merge `599cd4c`)
- ✅ BuildingInfoPanel con icono+nivel+costos
- ✅ DialogPanel con CharacterSprite del NPC
- ✅ HarvestPanel con calidad + preview de KH
- ✅ AnimalPanel con título dinámico ("Pollita — Huevo")
- ✅ ShadowSystem en NPCs/villagers/buildings (commit `ce74308`)
- ✅ 104/104 tests del server pasan
- ✅ Build de cliente limpio sin errores
- ✅ EventBridge Phaser↔React funcional
- ✅ Streak banner aparece (visible en screenshot 16)
- ✅ Bypass `SKIP_AUTH`/`x-skip-auth` para dev y screenshots automatizados

---

## 📎 ENTREGABLES INMEDIATOS QUE PIDE ESTE COMPLEMENTO

1. **Adaptar `deploy/update-tunnel-url.sh` para Windows** (paths `/home/kingdoms` → ruta local) o crear `scripts/dev_tunnel.ps1`.
2. **Crear `npm run dev:safe`** que limpie orphans y arranque server+client.
3. **Issue tracker mínimo:** crear issues en GitHub (B-01..B-11, T-01..T-06) para que cada bug tenga PR independiente.
4. **Visual regression CI:** baseline en `scripts/screenshots/baseline/`, comparación en cada PR con `pixelmatch`.

---

*Este complemento se actualiza cuando: (a) se cierre algún B-/T- listed, (b) un screenshot revele un nuevo issue, (c) cambie el target de hosting.*
