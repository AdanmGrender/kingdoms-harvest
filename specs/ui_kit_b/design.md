# Design — `ui_kit_b` (feature 8, B3)

> Solo piel: no cambia lógica, API, economía ni estado (CLAUDE.md invariantes intactas). Entrada de arte obligatoria:
> `docs/art-direction/ui-kit-b.md`. Cualquier desvío está en §11 como pregunta abierta, no decidido.

## 1. Etapas separables

Tres etapas, cada una con su propio cierre (`vitest` + `build` verdes, ver R58), su commit(s) y su revisión. El orden es A → B → C;
B y C **no** comparten archivos de componentes con A, y C no depende del código de B salvo `SpriteIcon` y el kit.

| Etapa | Contenido | Requirements | Archivos principales | Revisor |
|---|---|---|---|---|
| **A** fuentes y tokens | IM Fell empaquetada, quitar Google Fonts/MedievalSharp/Cinzel, tokens `kh-*`, `UI_FONT` en Phaser, `loadUiFonts` | R1–R16 | `client/index.html`, `client/public/fonts/*`, `client/tailwind.config.js`, `client/src/styles/index.css`, `client/src/game/fonts.js`, componentes con `fontFamily` inline | reviewer (código) |
| **B** kit + contadores | `Panel`, `Button`, `IconButton`, `Bar`, `PortraitRing`; HUD recompuesto; 4 contadores nuevos | R17–R37 | `client/src/components/ui/*`, `hud/*`, `overlay/OverlayManager.jsx`, `styles/index.css` | reviewer |
| **C** íconos y emojis | hoja `icons.webp`, puerta de arte de p-kh, reemplazo de ~50 componentes, test de cero emojis | R38–R58 | `client/public/assets/b/ui/icons.webp`, `grimIconSheet.generated.js`, `spriteMap.js`, `SpriteIcon.jsx`, `components/**`, scripts | reviewer + **p-kh (arte)** |

Dentro de C hay cuatro hitos que también se revisan por separado: **C1** producción de arte y hoja de contacto → **⏸ puerta p-kh** → **C2** integración
de la hoja → **C3** reemplazo de emojis por grupos → **C4** evidencia y guardia (`noEmoji.test.js`). C2 no empieza sin `aprobacion_arte.md` (R43).

La Etapa A se puede mergear sola: arregla el bloqueo por política de seguridad (CSP prod: `styleSrc 'self'` + `fontSrc` por defecto `'self'` ⇒ la hoja de
`fonts.googleapis.com` en `client/index.html:9` se bloquea y nunca llega MedievalSharp, `server/src/index.js:91`).

## 2. Etapa A — fuentes y tokens

### 2.1 Archivos

| Archivo | Cambio |
|---|---|
| `client/index.html` | quitar `<link … fonts.googleapis.com … MedievalSharp>` (línea 9); dejar `<link rel="stylesheet" href="/fonts/fonts.css">` |
| `client/public/fonts/fonts.css` | 4 `@font-face` (IMFellEnglish 400 normal/italic, IMFellEnglishSC 400, AlegreyaSansSC 700); `font-display: swap` |
| `client/public/fonts/*.woff2` | borrar `Cinzel-600/800`, `AlegreyaSans-400/700`, `AlegreyaSansSC-500` |
| `client/public/fonts/README.md` | licencias OFL de las 3 familias que quedan |
| `client/tailwind.config.js` | `colors.kh.*` (13), `fontFamily.display/body/numeric`, alias `medieval`, `kingdom.*` reapuntado (§2.3) |
| `client/src/styles/index.css` | `body { font-family: theme body; color kh-bone; background kh-ink; font-size: 15px }` |
| `client/src/game/fonts.js` (nuevo) | `export const UI_FONT = "'IM Fell English SC', serif"`; `export function loadUiFonts(timeoutMs = 3000)` |
| `BootScene`, `NPC`, `Building`, `ParticleSystem`, `IsoWorldScene` | `fontFamily: UI_FONT` (solo la cadena; sin tocar tamaños ni lógica) |
| `client/src/components/**` | `style={{ fontFamily: 'MedievalSharp, serif' … }}` → `className="font-display"` (45 archivos, `grep -rl MedievalSharp client/src`) |
| `client/src/tests/fontsConfig.test.js` (nuevo) | R1, R3, R4, R6, R7, R8, R10, R15 |

### 2.2 `loadUiFonts`

```js
// client/src/game/fonts.js
export const UI_FONT = "'IM Fell English SC', serif";
// Resuelve siempre; nunca rechaza. Espera las 2 familias del texto Phaser o el timeout (R11, R12).
export async function loadUiFonts(timeoutMs = 3000): Promise<void>
```

`Promise.race([ Promise.all([document.fonts.load("16px 'IM Fell English'"), document.fonts.load("16px 'IM Fell English SC'")]), timeout ])`
con `.catch(() => {})`. Si `document.fonts` no existe (jsdom) resuelve de inmediato. `BootScene.create` hace `await loadUiFonts()` antes de crear el primer `Text`
(si `create` hoy es síncrono, se mueve el cuerpo a una función `build()` invocada tras la promesa; sin cambiar el orden de carga de assets).

### 2.3 Tokens y compatibilidad `kingdom.*`

`colors.kh` = tabla de `ui-kit-b.md` §3 (hex exactos). Las ~40 pantallas usan clases `kingdom-*`; no se renombran (R15), solo cambian de valor:

| `kingdom.*` | hoy | pasa a | token |
|---|---|---|---|
| `bg` | `#1a1712` | `#14110d` | `kh-ink` |
| `card` | `#332f2b` | `#2a2119` | `kh-oak` |
| `accent` | `#b32821` | `#7a1f1a` | `kh-seal` |
| `gold` | `#d9a441` | `#b08d57` | `kh-brass` |
| `green` | `#4ade80` | `#d9b77a` | `kh-brass-light` (el éxito no usa verde, §3 del brief de arte; ver §11-Q1) |
| `blue` | `#4a4550` | `#4a4a48` | `kh-iron` |

`fontFamily`: `display: ['"IM Fell English SC"','serif']`, `body: ['"IM Fell English"','serif']`, `numeric: ['"Alegreya Sans SC"','serif']`,
`medieval: <display>` (alias para no tocar clases `font-medieval` aún no migradas; se elimina en B si queda sin usos).

### 2.4 Dígitos (R13, R14)

Prueba obligatoria con la barra de recursos de 412 px **en Etapa A** (es de tipografía): captura con IM Fell y con `font-numeric` sobre datos de 5 cifras y `12.3K`.
`evidencia/digitos.md` registra el veredicto de p-kh/owner. Por defecto (sin veredicto) rige `im-fell`; si el veredicto es `font-numeric` se aplica la clase a los
números de contadores (ver §4.2). El veredicto condiciona R14 pero no bloquea cerrar A.

### 2.5 CSP (R16)

No se toca `server/src/index.js`: con `/fonts/*.woff2` y `fonts.css` de mismo origen la CSP existente (`defaultSrc 'self'`) ya permite las fuentes.
Verificación: Playwright contra `NODE_ENV=production` local, 0 requests a hosts de fuentes y 0 violaciones en consola.

### 2.6 Criterio de emoji (compartido, lo usa Etapa C)

`/\p{Extended_Pictographic}|\uFE0F|\u20E3/u` aplicado al texto de los archivos tras **quitar comentarios** (bloques `/* */`, `{/* */}` y líneas que empiezan por `//` o `*`).
Un único módulo `client/src/tests/helpers/emoji.js` exporta `EMOJI_RE` y `stripComments()`; lo usan `noEmoji.test.js` y el script de conteo. Los caracteres de
flecha/dingbat sin presentación emoji (`→`, `✓`, `×`, `…`, `—`) **no** cuentan salvo que `Extended_Pictographic` los incluya; los que sí lo hagan se reemplazan por
texto o ícono. Se excluyen del barrido `client/src/game/**` (Phaser, fuera de alcance), `config/` y `tests/`.

## 3. Etapa B — componentes del kit

Todos en `client/src/components/ui/`. Estilos en clases de `styles/index.css` (prefijo `kh-`) + props inline mínimas; **sin gradientes** (R29).
Piezas: `/assets/b/ui/{panel_frame,btn_red,btn_stone,bar_frame,portrait_ring}.webp` ya existentes (dimensiones: panel 673×899, btn_red 390×159,
btn_stone 409×159, bar 457×63, ring 260×255). El `border-image-slice` sale de la medición de cada pieza (constante por componente, comentada con el origen).

### 3.1 Firmas

```jsx
// Panel.jsx
export default function Panel({ variant = 'oak' /* 'oak'|'parchment' */, title, onClose, className = '', children, ...rest })
// Button.jsx
export default function Button({ variant = 'secondary' /* 'primary'|'secondary' */, disabled = false, onClick, className = '', children, ...rest })
// IconButton.jsx  (botón de riel)
export default function IconButton({ icon /* nombre del set */, label, onClick, active = false, accent, disabled = false, ...rest })
// Bar.jsx
export default function Bar({ value /* 0..100 */, tone = 'ember' /* 'ember'|'seal'|'macula' */, label, className = '' })
// PortraitRing.jsx
export default function PortraitRing({ src, size = 64, alt = '', className = '' })
```

### 3.2 Reglas de render

- `Panel oak`: `border-image: url(panel_frame.webp) <slice> fill / <ancho>px / 0 stretch`, `box-shadow: 0 4px 0 kh-ink` (sombra dura, sin blur de fondo). Título en `font-display` 20 px. `onClose` → botón 44×44, aria-label «Cerrar», glifo ✕ dibujado con dos pseudo-elementos CSS (R20).
- `Panel parchment`: fondo plano `kh-parchment`, borde `kh-brass` 2 px, texto `kh-parchment-ink` (R19); el marco 9-slice no se usa aquí.
- `Button`: `.kh-btn` con `border-image` por variante, `min-height: 44px`, `font: 16px display`. `:hover`/`:active` → `filter: brightness(.85)` + `outline`/borde `kh-brass-light`; `[disabled]` → `filter: saturate(.4)`, borde `kh-iron`, `pointer-events: none` (R21–R24).
- `IconButton`: escudete `kh-oak` con borde `kh-iron`, `SpriteIcon size=32`, etiqueta `font-display` 12 px debajo; el acento solo tiñe el borde (`drop-shadow` CSS con el token, no arte horneado).
- `Bar`: marco `bar_frame.webp` 9-slice, relleno `div` con ancho `clamp(0,value,100)%` y `background-color` del token (`ember`/`seal`/`macula`); `role="progressbar"`, `aria-valuenow/min/max` (R26, R27).
- `PortraitRing`: contenedor con imagen `object-fit: cover` en `border-radius: 50%` debajo, `portrait_ring.webp` encima; sin `src` → disco `kh-oak` (R28). **Solo se entrega el componente**; los retratos de héroes los consume B2/B4.

### 3.3 Reimplementación de clases heredadas (R30)

`.btn-primary`, `.btn-gold`, `.game-card`, `.progress-bar`, `.progress-fill` (16 archivos de `components/` las usan) mantienen nombre; su CSS pasa a tokens `kh-*` y a las piezas 9-slice
(sin tocar el JSX de esos consumidores). `grimChrome.js` se elimina (R36) tras migrar sus 5 importadores (`BottomNavBar`, `EventSidebar`, `QuickActionsSidebar`, `SocialSidebar`, `TopResourceBar`).

### 3.4 Barras de progreso (R35)

Migran a `Bar`: XP en `TopResourceBar` (hoy `div` con gradiente `#3b82f6→#22d3ee`) y `GameHUD`, `ConstructionTimer`, `AchievementPanel`, `meta/AchievementsPanel`,
`CombatInstancePanel` (HP enemigo → `seal`, energía → `ember`). Mismos valores de entrada; solo cambia el elemento visual. Cualquier otra barra suelta queda con `.progress-bar`/`.progress-fill` (R30).

## 4. `TopResourceBar` y contadores nuevos (Etapa B)

### 4.1 Layout

Dos filas dentro de un `Panel` oak compacto:

1. **Fila 1** (existente): avatar (`PortraitRing` pequeño o `IconButton` de corona) + nivel, nombre (`font-display`), poder, XP con `Bar`, y a la derecha oro / KH / gemas / hora del día.
2. **Fila 2** (nueva, «despensa»): 8 contadores en cuadrícula `grid-cols-8`, cada uno columna **ícono 28 px arriba, número ≥12 px abajo** → ~49 px por contador a 412 px.

```js
// TopResourceBar.jsx — reemplaza MAIN_RESOURCES (4) por:
const PANTRY = ['wood', 'stone', 'wheat', 'iron', 'egg', 'milk', 'wool', 'carrot'];
```

Cada contador: `<div data-resource={key}>` con `SpriteIcon name={key} size={28}` y `formatNumber(getAmount(key))`. `data-resource` es el selector que usa `counterTarget()` de `HubSceneB.js:532`
para el vuelo de recolectables (`hub_b_recoleccion`): con `egg|milk|wool` presentes (antes sin destino ⇒ caían al fallback de `cssToWorld`), el destino pasa a ser su contador real. `carrot` es el cultivo
de `crop_carrot`; `resourceKey` de pickups de cosecha ya emite `p.crop_id` (design de `hub_b_recoleccion`).

`resources` del store ya trae cualquier clave de `/player/resources`: si el server no devuelve `egg|milk|wool|carrot`, `getAmount` da 0 (R33, caso sin dato). **No se toca el server.**

### 4.2 Oro/KH/gemas/hora y riesgo de 412 px

Íconos de 28 px y números de 12 px obligan a medir la fila 1: avatar 40 + nombre 70 + 3 divisas (28 + ~38 de número) + hora ≈ 360–380 px dentro de 396 útiles. Si el test R32 desborda,
la solución es mover las divisas a la fila 2 como segunda columna de 3 y recortar la despensa a 8 en una sola línea; **no** bajar de 28 px ni de 12 px. La hora del día (`timeInfo.icon`) llega por
`EventBridge 'time:updated'` como emoji desde `DayNightSystem`; el chrome ignora ese `icon` y deriva `sun`/`moon` del campo `period` (`dawn|morning|midday|evening|night`, verificado en `DayNightSystem.js:112`): `night` → `moon`, el resto → `sun`; sin editar el sistema de Phaser.

Si el veredicto de dígitos es `font-numeric`, el `<span>` numérico lleva `font-numeric` (R14).

## 5. Etapa B — `OverlayManager` y rieles

`GenericPanel` (`OverlayManager.jsx:222`) pasa a usar `Panel` (`title`, `onClose`); su API de props no cambia. `BottomNavBar`, `QuickActionsSidebar`, `EventSidebar`, `SocialSidebar` sustituyen botones de
estilo inline por `IconButton`; `EventSidebar` y `SocialSidebar` conservan sus handlers (`setOverlay`, `EventBridge.emit`). No se mueve ni renombra ningún evento ni overlay.

## 6. Etapa C — reemplazo de emojis

Cobertura medida (grep PCRE sobre `client/src`): 96 archivos con emoji; en alcance (`components/`, `store/`, `services/`) 59; el resto es `game/**`, `config/` y `utils/` (fuera de alcance, salvo `spriteMap.js`, cuyos emojis son comentarios).
Tabla de reemplazos frecuentes (nombre del set; el resto de emojis se **quita** y queda el texto):

| Emoji | Nombre | | Emoji | Nombre |
|---|---|---|---|---|
| 🪙 💰 | `gold` | | ⚔ ⚔️ | `sword` |
| 🌾 | `wheat` | | 🛡 🛡️ | `shield` (nuevo) |
| 🪵 | `wood` | | 🪨 | `stone` |
| ⛏ ⛏️ | `iron` (recurso) / `mine` (edificio) | | 💎 | `gem` |
| ⭐ | `star` | | 💀 | `skull` |
| 📦 | `reward_bag` | | 🔨 | `hammer` (nuevo, Construir) |
| 🏰 | `castle` | | 🏠 | `farmhouse` |
| 🥚 🥛 🧶 | `egg` `milk` `wool` | | 🥕 🌽 🍅 🥔 🎃 🍇 | `carrot` `corn` `tomato` `potato` `pumpkin` `grape` |
| ☀️ 🌙 | `sun` `moon` (nuevos) | | ⚙️ | `gear` (dibujado como llave) |
| 📜 | `scroll` | | 🏆 | `medal` |

Reglas: (a) catálogos con `icon: '🏠'` pasan a `icon: 'farmhouse'` + `<SpriteIcon name={icon}>`; los **ids de datos no cambian** (R52). (b) Un emoji dentro de una cadena de UI
(`'🌾 Trigo'`) se parte en `<SpriteIcon/> Trigo`. (c) En `store/` y `services/` solo se borra el emoji del texto; el `type` de notificación queda (R53). (d) `AlliancesPanel.CHAT_STICKERS` es la
única lista blanca (R50, texto libre de jugadores, no ícono de UI). (e) Se elimina la prop `fallback` de las llamadas y del propio `SpriteIcon` (R54); nombre inexistente ⇒ recuadro vacío con `data-missing-icon` (R47).

Orden de ataque de C3 (grupos de ≤ 8 archivos, un commit y revisión por grupo): **G1** HUD y rieles (`hud/*`, `hub/*`, `ui/*`) · **G2** `OverlayManager`, `BuildingToolbar`, `BuildingInfoPopup`, `CropSelectMenu` ·
**G3** `commerce/*`, `meta/*`, `world/*` · **G4** `campaign/*`, `castle/*`, `menu/*` · **G5** `overlay/*` restantes (≈ 30 paneles) · **G6** `store/gameStore.js`, `services/*`.

## 7. Etapa C — set de íconos

### 7.1 Contrato (R39)

65 nombres de `GRIM_ICONS` con su `{ col, row }`, grilla de 8 columnas: gold, wood, stone, iron, wheat, water, bread, kh_token, crystal, relic, blueprint, carrot, potato, tomato, corn, pumpkin, grape, egg, milk, wool, chicken, sheep, cow,
castle, farmhouse, market, tower, barracks, tavern, mill, wall, trap, stable, sawmill, barn, sword, bow, spear, ram, horse, crown, scroll, medal, backpack, reward_bag, exclamation, gear, caravan, flame, wallet, map, heart, star, check, gem, star_currency,
speedup, enemy_carronero, enemy_bruto, enemy_aullador, enemy_coloso, enemy_boss_devorador, enemy_boss_heraldo, tide, skull (el orden real lo fija el `generated.js` actual; el test compara contra la lista congelada leída de `git show ab85126:…`).

### 7.2 Nombres nuevos (solo al final, R39)

`shield`, `hammer`, `sun`, `moon`, `alliance`, `rankings`, `quests`, `tech`, `world`, y edificios recortados `mine`, `smithy`, `library`, `embassy`, `farm_plot`.
Al existir como nombre directo en `GRIM_ICONS`, ganan sobre `GRIM_ALIASES` (`getGrimSprite` prueba `GRIM_ICONS[id]` primero): se borran las entradas `farm_plot`, `smithy`, `embassy`, `library` y `nav_token` de `GRIM_ALIASES` (R45).

### 7.3 Producción (R38, R41–R45)

- **Generar** (≈ 50): hojas 1:1 3×3 con la plantilla `icon_test_b_bold` de `art-b/uikit/manifest.json` + bloque de reglas §6.1 antepuesto; recorte por grilla + llave de color. Hoy `scripts/gen_art_b.js` y `scripts/process_art_b.js` ya hacen generación y proceso para `art-b/*`; se agregan entradas `icon_b_01…` al manifest y un `art-b/uikit/process.sh`. Presupuesto ≈ 1,1 USD (8 llamadas); **requiere `GEMINI_API_KEY` en `server/.env`**; no se lee ni imprime.
- **Recortar** (17): `scripts/crop_building_icons.js` (sharp) lee `client/public/assets/b/buildings/*.webp`, recorta al bbox no transparente y centra en celda de 192 px (R41).
- **Ensamblar**: `scripts/assemble_icon_sheet.js` se reescribe para celda 192 y salida `client/public/assets/b/ui/icons.webp` (+ `grimIconSheet.generated.js` con `GRIM_SHEET`, `_W`, `_H`, `GRIM_CELL = 192`). Altura = filas × 192; los 65 nombres ocupan hoy 9 filas (1024×1152 a 128 px) y los 14 nuevos caben en 2 filas más ⇒ ≈ 11 filas (1536×2112); el valor final lo calcula el script.
- **Hoja de contacto**: `scripts/contact_sheet_b.js` (o variante `--sizes 24,32,48 --bg 2a2119`) → `specs/ui_kit_b/evidencia/iconos_contacto.webp` (R42).
- **KH único** (R45): se parte de la prueba aprobada en `art-direction/ui-kit-b-prueba-iconos.webp` (sello-medallón de bronce con gavilla, corona y lacre); `kh_token` es el único nombre en esa celda y ningún alias lo apunta.
- **Antes de integrar**: `aprobacion_arte.md` de p-kh (R43). Hasta entonces `GRIM_SHEET` sigue apuntando a `grim_icons.png`, y los íconos nuevos viven solo bajo `art-b/uikit/` y `evidencia/`.

### 7.4 Enemigos — placeholder (R46)

`enemy_*` (6) están diferidos a `combate_b` (`ui-kit-b.md` §6.3). Para poder borrar `grim_icons.png` (R48) se recortan esas 6 celdas del set viejo a
`client/public/assets/sprites/enemy_icons_legacy.png` (celdas 128 px, tira horizontal) y `spriteMap` las resuelve con un `ENEMY_LEGACY` aparte antes de `getGrimSprite`. Se anota en este documento
como deuda explícita; `combate_b` la retira. Esto es la única mezcla viejo/nuevo y no ocurre en una misma barra o panel (los enemigos aparecen en `CombatInstancePanel`/`WaveDefensePanel`, que no muestran íconos de recursos junto a ellos — a confirmar en revisión de arte, §11-Q3).

### 7.5 `SpriteIcon`

`imageRendering: 'pixelated'` → `'auto'` (arte de 192 px reducido, no pixel art). Se elimina la prop `fallback`. Para `size < 28` solo se permite en código no-UI (ninguno); R55 lo verifica por barrido.
Con celda 192 y `size` 28–48, el `background-size` ya escala (`sheetW * displayW / sprite.w`), sin cambios de cálculo.

## 8. Tests nuevos

| Archivo | Etapa | Cubre |
|---|---|---|
| `fontsConfig.test.js` | A | R1, R3, R4, R6, R7, R8, R10, R15 |
| `fonts.test.js` (`loadUiFonts`) | A | R11, R12 |
| `kitStyles.test.js` + tests de `Panel/Button/IconButton/Bar/PortraitRing` | B | R17–R30 |
| `TopResourceBar.test.jsx` | B | R14, R32 (jsdom: estructura), R33, R34 |
| `iconSheet.test.js` | C | R38–R40, R45, R46 |
| `SpriteIcon.test.jsx` | C | R47, R54 |
| `noEmoji.test.js` | C | R49, R50, R54, R55 |

R32 (desborde real) y R16 se miden con Playwright (`scripts/ui_kit_b_evidence.js`, nuevo, patrón de `scripts/hub_b_pickups_evidence.js`: Vite dev `:5173`, server con `SKIP_AUTH=true`, Chromium 412×860 @2x con `channel: 'chromium'`).
Las capturas «antes» se toman **en el commit `ab85126`** (antes de T1) y se guardan como `*_antes.webp`.

## 9. Errores y casos límite

| Caso | Comportamiento |
|---|---|
| `document.fonts` ausente o la carga rechaza | `loadUiFonts` resuelve; texto con `serif` (R12) |
| Fuente tarda > 3 s | arranque continúa; `font-display: swap` corrige al llegar |
| `SpriteIcon` con nombre inexistente | recuadro vacío `data-missing-icon`, sin texto ni emoji (R47) |
| `Bar` con `value` < 0, > 100 o `NaN` | se acota a 0–100; `NaN` → 0 (R27) |
| `PortraitRing` sin `src` | disco `kh-oak` (R28) |
| `resources` sin `egg/milk/wool/carrot` | contador en 0 (R33) |
| 5+ cifras en un contador | `formatNumber` ya abrevia (`12.3K`); ancho validado en R32 |
| `GRIM_SHEET` apuntando a un `webp` ausente | `iconSheet.test.js` falla (dimensiones leídas del archivo) |
| Emoji nuevo introducido después | `noEmoji.test.js` falla |
| Faltan íconos aprobados | no se integra la hoja (R43); la Etapa C queda en C1 |

## 10. Alternativas descartadas

1. **Mantener Google Fonts con `preconnect` y abrir la CSP (`fontSrc`/`styleSrc` a `fonts.googleapis.com`)**: contradice «tipografía empaquetada», añade dependencia de red en APK/Mini App sin conexión estable y amplía la CSP en una app con dinero real. Se descarta.
2. **Un solo ítem «ui_kit» de gran tamaño (todo en una rama/PR)**: ~750 emojis en ~50 componentes en una revisión no es revisable y bloquea las etapas sin arte por la puerta de p-kh. Se parte en A/B/C.
3. **Reemplazar emoji por emoji-fuente (Noto Color Emoji empaquetada)**: sigue siendo «emoji como ícono» (viola `ui-kit-b.md` §8) y no resuelve el estilo. Se descarta.
4. **Renombrar `kingdom-*` → `kh-*` en las ~40 pantallas ahora**: diff enorme sin valor visual extra; se reapuntan los valores (R15) y la migración de clase se difiere.
5. **Generar también los íconos de edificio con IA**: duplica coste y arriesga inconsistencia con los edificios del hub; ya existen como B (`assets/b/buildings`) y se recortan.
6. **Sprites SVG por ícono en vez de hoja**: ~100 archivos y rediseño de `SpriteIcon`/`spriteMap` (26 archivos dependen del contrato de hoja). Se mantiene la hoja y los nombres (§6.3 del brief de arte).
7. **Dibujar los marcos con CSS puro (gradientes) en vez de 9-slice**: es justo el «candy»/sci-fi que se quiere retirar y `ui-kit-b.md` §5 pide reusar las piezas generadas.

## 11. Preguntas abiertas (a decidir por el owner / p-kh, no por el implementer)

- **Q1** `kingdom.green` (`#4ade80`, éxito/cultivos) se reapunta a `kh-brass-light` por el brief de arte («éxito = latón claro + texto, no verde»). Cambia el color de ~todos los estados de éxito; ¿OK, o se deja el verde hasta Etapa C?
- **Q2** Veredicto de dígitos (IM Fell vs `font-numeric`) — lo fija la prueba de R13.
- **Q3** Enemigos con placeholder viejo (§7.4): el brief lo permite explícitamente, pero convive con el set B en `CombatInstancePanel`. ¿Se acepta hasta `combate_b`?
- **Q4** `GEMINI_API_KEY`/presupuesto ≈ 1,1 USD para generar ~50 íconos: requiere autorización del owner antes de C1.
- **Q5** Íconos nuevos fuera del contrato (`shield`, `hammer`, `sun`, `moon`, `alliance`, `rankings`, `quests`, `tech`, `world`): ¿p-kh confirma la lista de motivos?
