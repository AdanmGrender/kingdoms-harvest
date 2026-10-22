# Tasks — `ui_kit_b` (feature 8, B3)

> Tres etapas, cada una implementable y revisable por separado (design §1). Orden A → B → C. Al cerrar cada etapa: `cd client && npx vitest run`,
> `cd client && npm run build`, `cd server && npx jest --runInBand --forceExit` en verde (R58). Cada tarea cierra con `Evidencia:` inline.
> Rama: `feature/ui_kit_b` (ya incluye `hub_b_recoleccion`, commit `ab85126`; no repetir el merge).

## Etapa A — Fuentes y tokens (revisión A)

- [x] T1 — Capturas «antes» (hub + 4 paneles: construir, héroes, mercado, ajustes) en el commit `ab85126` con `scripts/ui_kit_b_evidence.js --mode antes` (script nuevo, patrón de `hub_b_pickups_evidence.js`) → `evidencia/*_antes.webp` + `consola.txt`. Cubre: R56, R57. Evidencia: `node scripts/ui_kit_b_evidence.js --mode antes` sobre el árbol de `ab85126` (HEAD solo añade spec) → evidencia/{hub,construir,heroes,mercado,ajustes}_antes.webp + consola_antes.txt (pageerrors 0, console.error 0).
- [x] T2 — Test rojo `client/src/tests/fontsConfig.test.js` (sin Google Fonts, `fonts.css` con 4 `@font-face` y `woff2` existentes, sin `MedievalSharp|Cinzel|Alegreya Sans` salvo `Alegreya Sans SC`, 13 tokens `kh-*`, fontFamily, mapa `kingdom.*`, `UI_FONT`) y `fonts.test.js` de `loadUiFonts`. Cubre: R1, R3, R4, R6, R7, R8, R10, R11, R12, R15. Evidencia: client/src/tests/fontsConfig.test.js (R1,R3,R4,R5,R6,R7,R8,R10,R15) + fonts.test.js (R11,R12) escritos antes de T3–T5; verdes al cerrar: `npx vitest run src/tests/fontsConfig.test.js src/tests/fonts.test.js` → 2 files, 20 passed.
- [x] T3 — `client/index.html`: quitar el `<link>` de Google Fonts, dejar `/fonts/fonts.css`; `fonts.css` con las 4 familias; borrar los `woff2` sobrantes y actualizar `fonts/README.md`. Cubre: R1, R2, R3, R5. Evidencia: index.html con `<link rel="stylesheet" href="/fonts/fonts.css">` y sin googleapis; fonts.css con 4 @font-face; borrados Cinzel-600/800, AlegreyaSans-400/700, AlegreyaSansSC-500; README actualizado; fontsConfig.test.js R1/R2/R3/R5 en verde.
- [x] T4 — `tailwind.config.js`: `colors.kh` (13), `fontFamily.display/body/numeric`, alias `medieval`, `kingdom.*` reapuntado (design §2.3); `index.css`: `body` con body-font, `kh-bone`, `kh-ink`, 15 px. Cubre: R6, R7, R8, R15. Evidencia: tailwind.config.js (colors.kh 13 hex, fontFamily display/body/numeric + alias medieval, kingdom.* → kh, green → brass-light) y index.css body (IM Fell English, #e6dcc3 sobre #14110d, 15px, sin Segoe UI); fontsConfig.test.js R6/R7/R8/R15 en verde.
- [x] T5 — `client/src/game/fonts.js` (`UI_FONT`, `loadUiFonts`); usarlos en `BootScene` (espera de fuentes antes del primer texto) y en `NPC`, `Building`, `ParticleSystem`, `IsoWorldScene`. Cubre: R10, R11, R12. Evidencia: client/src/game/fonts.js (UI_FONT, loadUiFonts con timeout 3000 ms que nunca rechaza); usado en BootScene (textos creados tras loadUiFonts), NPC, Building, ParticleSystem, IsoWorldScene; fonts.test.js 5/5 y fontsConfig R10 en verde.
- [x] T6 — Reemplazar `fontFamily: 'MedievalSharp…'` inline de `client/src/components/**` (45 archivos) por `className="font-display"`; quitar usos de Cinzel/Alegreya Sans. Cubre: R4, R9. Evidencia: 38 archivos de components/** migrados de fontFamily inline a className font-display (script de migración + 4 casos a mano en CombatInstancePanel/BastionHub); `grep -rnE "MedievalSharp|Cinzel|Alegreya Sans([^ ]| [^S]|$)"` sobre client/src, index.html, tailwind.config.js y fonts.css → vacío; `npx vitest run` 11 files / 208 passed; `npm run build` OK.
- [x] T7 — Prueba de dígitos a 412 px (IM Fell vs `font-numeric`) → `evidencia/digitos.md`, `digitos_im_fell.webp`, `digitos_numeric.webp`; pedir veredicto a p-kh/owner. Cubre: R13. Evidencia: `--mode digitos` → evidencia/digitos.md, digitos_im_fell.webp, digitos_numeric.webp (sin desborde a 412 px, fila 172/172 en ambas variantes). Veredicto PENDIENTE de p-kh (Q2): tarea `[KH][arte]` a crear/linkar por Central; se consume en T14 (etapa B).
- [x] T8 — Verificación prod: `NODE_ENV=production` local, Playwright sin requests a hosts de fuentes ni violaciones CSP + `document.fonts.check`; cierre de etapa (vitest, build, jest). Cubre: R2, R16, R58. Evidencia: `--mode prod` sobre client/dist servido con la CSP exacta de server/src/index.js (el server real con NODE_ENV=production rechaza SKIP_AUTH): document.fonts.check true en las 3 familias, requests de fuentes solo /fonts/*, fuentesExternas [], cspViolaciones [], pageerrors 0, console.error 0 (evidencia/prod_fuentes.json, consola_prod.txt, prod_hub.webp); vitest 11 files / 208 passed, `npm run build` OK, `cd server && npx jest --runInBand --forceExit` 25 suites / 388 passed.

## Etapa B — Kit de componentes y contadores (revisión B; depende de A)

- [ ] T9 — Tests rojos de render: `Panel`, `Button`, `IconButton`, `Bar`, `PortraitRing`, `kitStyles.test.js` (sin `gradient`). Cubre: R17, R18, R19, R20, R21, R22, R23, R25, R26, R27, R28, R29.
- [ ] T10 — `Panel.jsx` (variantes `oak`/`parchment`, `onClose` 44×44 con glifo CSS) y reglas `.kh-panel*` en `index.css` con 9-slice de `panel_frame.webp`. Cubre: R17, R18, R19, R20.
- [ ] T11 — `Button.jsx` (`primary` → `btn_red`, `secondary` → `btn_stone`, hover/active/disabled) e `IconButton.jsx`. Cubre: R21, R22, R23, R24, R25.
- [ ] T12 — `Bar.jsx` (tonos `ember|seal|macula`, clamp 0–100, `role="progressbar"`) y `PortraitRing.jsx` (con y sin `src`). Cubre: R26, R27, R28.
- [ ] T13 — Reimplementar `.btn-primary`, `.btn-gold`, `.game-card`, `.progress-bar`, `.progress-fill` con tokens y 9-slice, sin gradientes; consumidores intactos. Cubre: R29, R30.
- [ ] T14 — `TopResourceBar`: dos filas, despensa de 8 contadores (`wood|stone|wheat|iron|egg|milk|wool|carrot`, `data-resource`, ícono 28 px, número ≥ 12 px), oro/KH/gemas, `sun|moon` desde `period`, XP con `Bar`, `font-numeric` según veredicto de T7; test `TopResourceBar.test.jsx`. Cubre: R14, R32, R33, R34, R35.
- [ ] T15 — `GenericPanel` (`OverlayManager.jsx`) sobre `Panel`; `BottomNavBar`, `QuickActionsSidebar`, `EventSidebar`, `SocialSidebar` sobre `IconButton`/`Panel`; eliminar `grimChrome.js`. Cubre: R36, R37.
- [ ] T16 — Migrar barras de `GameHUD`, `ConstructionTimer`, `AchievementPanel`, `meta/AchievementsPanel`, `CombatInstancePanel` a `Bar`. Cubre: R35, R37.
- [ ] T17 — Verificación de etapa: Playwright 412×860 de la barra (sin desborde, `scrollWidth <= clientWidth`) → `evidencia/barra_412.webp`; `git diff --stat` vacío en `server shared client/src/store client/src/services`; `pickupSources.test.jsx` en verde; vitest/build/jest. Cubre: R31, R32, R57, R58.

## Etapa C — Íconos B, puerta de arte y reemplazo de emojis (revisión C; depende de A y B)

### C1 — Producción de arte (hasta la puerta)

- [ ] T18 — Test rojo `iconSheet.test.js` (constantes ↔ dimensiones del `webp`, 65 nombres contrato congelados desde `git show ab85126:client/src/config/grimIconSheet.generated.js`, nuevos solo al final, celdas no vacías, `kh_token` único, enemigos legacy) y `SpriteIcon.test.jsx`. Cubre: R38, R39, R40, R45, R46, R47.
- [ ] T19 — `scripts/crop_building_icons.js`: recorte de 17 edificios desde `assets/b/buildings/*.webp` a celdas de 192 px. Cubre: R41.
- [ ] T20 — Entradas en `art-b/uikit/manifest.json` (plantilla `icon_test_b_bold` + reglas §6.1), generación con `scripts/gen_art_b.js` y proceso por grilla/llave de color; reaprovechar las hojas de prueba si cumplen. **Requiere autorización del owner y `GEMINI_API_KEY` (design §11-Q4).** Cubre: R44, R45.
- [ ] T21 — Reescribir `scripts/assemble_icon_sheet.js` (celda 192, 8 columnas, salida `client/public/assets/b/ui/icons.webp` + `grimIconSheet.generated.js` candidato **fuera** de `client/src/config` hasta la aprobación) y generar `evidencia/iconos_contacto.webp` (24/32/48 px sobre `kh-oak`). Cubre: R38, R42.
- [ ] T22 — ⏸ **Puerta de arte p-kh**: revisar `iconos_contacto.webp` y registrar `evidencia/aprobacion_arte.md` (fecha, autor `p-kh`, veredicto `APROBADO`, lista de regeneraciones si no). Sin esto no se pasa a C2. Cubre: R43, R44.

### C2 — Integración

- [ ] T23 — Copiar `icons.webp` y el `generated.js` aprobado a `client/`; `spriteMap`: borrar `nav_token`, `farm_plot`, `smithy`, `embassy`, `library` de `GRIM_ALIASES`, añadir `ENEMY_LEGACY` con `enemy_icons_legacy.png` (recorte del set viejo); `SpriteIcon`: `image-rendering: auto`, sin `fallback`, `data-missing-icon`. Cubre: R38, R39, R40, R45, R46, R47, R54.
- [ ] T24 — Borrar `grim_icons.png` y `scripts/gen_icons.sh`; limpiar referencias en `docs/`. Cubre: R48.

### C3 — Reemplazo de emojis por grupos (un commit y revisión por grupo)

- [ ] T25 — `client/src/tests/helpers/emoji.js` (`EMOJI_RE`, `stripComments`) y `noEmoji.test.js` (barrido de `components/`, `store/`, `services/`; lista blanca `CHAT_STICKERS`; `fallback=` en `SpriteIcon`; `size` < 28). Rojo al inicio. Cubre: R49, R50, R54, R55.
- [ ] T26 — G1: `hud/*`, `hub/*`, `ui/*` (`TopResourceBar`, `BottomNavBar`, rieles, `BuildingInfoPopup`, `ConstructionTimer`, `QuestRail`, `BastionHub`, `NotificationPrefsPanel`). Cubre: R51, R52, R54, R55.
- [ ] T27 — G2: `overlay/OverlayManager`, `BuildingToolbar`, `CropSelectMenu`, `GameHUD`, `HeroPanel`, `SettingsPanel`. Cubre: R51, R52, R54, R55.
- [ ] T28 — G3: `commerce/*`, `meta/*`, `world/*`. Cubre: R51, R52, R54, R55.
- [ ] T29 — G4: `campaign/*`, `castle/*`, `menu/*`. Cubre: R51, R54, R55.
- [ ] T30 — G5: resto de `overlay/*` (Shop, Pass, Calendar, WarPanel, WaveDefense, Villager, Marketplace, Seasonal, WorldEvent, SystemMap, GalaxyMap, Achievement, Withdrawal, Guild, Troop, Tutorial, OfflineReport, Missions, FactionSelect, Prestige, Crafting, Squad, Dialog, Codex, StarMap, StreakBanner). Cubre: R51, R52, R54, R55.
- [ ] T31 — G6: texto de notificaciones en `store/gameStore.js`, `services/socketService.js`, `services/api.js` sin cambiar `type`. Cubre: R53.

### C4 — Evidencia y cierre

- [ ] T32 — `noEmoji.test.js` en verde + corrida de control con un emoji de prueba que lo hace fallar (salida citada). Cubre: R49, R50.
- [ ] T33 — Capturas «después» (hub + 4 paneles) con `ui_kit_b_evidence.js --mode despues`, `consola.txt` sin errores; barra a 412 px legible. Cubre: R56, R57, R32.
- [ ] T34 — Cierre: vitest, build y jest en verde, `grep` de `grim_icons|gen_icons|grimChrome|MedievalSharp` vacío, `CHANGELOG.md` (al pasar a `done`, lo hace el flujo de cierre). Cubre: R48, R58.

## Bloqueado

