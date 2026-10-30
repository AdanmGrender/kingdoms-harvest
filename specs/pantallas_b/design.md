# pantallas_b — Design

Base: `feat/art-direction-b` @1395f33 (incluye #24, #25, #26). Solo cliente. Las líneas citadas son de ese commit; el implementer las re-verifica con `grep` antes de editar.

> **Estado.** La tarea del leader pide dejar la feature en `in_progress` en el mismo commit del spec; `docs/specs.md` dice `spec_ready` → aprobación humana → `in_progress`. Se siguió la tarea. La puerta humana sigue vigente: el implementer NO empieza hasta que el owner responda Q1–Q8 en la tarea [GATE].

## 1. Contexto y qué hay hoy

El kit B (`components/ui/`: `Panel`, `Button`, `Bar`, `PortraitRing`, `IconButton`, tokens `KH` en `kitPieces.js:8-21`) ya está en HUD, tienda, escribano y modales. Estas superficies no lo usan:

| Superficie | Archivo | Hoy |
|---|---|---|
| Menú | `menu/MainMenu.jsx` | gradientes y fondo `/assets/game/ambient/menu_bg.png` (no existe) |
| Roster | `overlay/HeroPanel.jsx` | `RARITY_COLORS` Tailwind (`:10-14`), `rounded-t-xl` propio (`:365`), `✕` (`:380`), `max-h-[75vh]` |
| Mapa Marca | `overlay/SystemMapPanel.jsx` | `STATE_STYLE` hex (`:34-39`), `maxHeight: '80vh'` (`:77`), `✕` (`:96`), fondo `system_bg.png` (no existe) |
| Mapa Reinos | `overlay/GalaxyMapPanel.jsx` | `STATE_STYLE` con `#a855f7` (`:30-35`), `80vh` (`:70`), `✕` (`:87`), fondo `galaxy_bg.png` (no existe) |
| Resultado combate | `campaign/CombatInstancePanel.jsx:233-240` | `btn-gold` / `btn-primary` |
| Resultado guerra | `overlay/WarPanel.jsx:255-279` (+ contenedor `:441`, `65vh`, `✕` `:449`) | verde/rojo Tailwind, botón `rgba(55,65,81)` |
| Resultado territorio | `world/TerritoryMapPanel.jsx:178-200` | `game-card`, `border-green-500` |
| Hallazgos F9 | `overlay/SettingsPanel.jsx:207-215`, `ui/NotificationPrefsPanel.jsx:78-89`, `castle/TechTreePanel.jsx:55`, `overlay/MissionsPanel.jsx:49-50,117`, `HeroPanel.jsx:196,253,431,465` | verde `#16a34a`/`#4ade80`, pestaña `bg-purple-700`, grises 500/600 |

Contraste medido (T3 lo reproduce en test): `kh-bone-dim` sobre `kh-oak` 5.83:1, sobre `kh-oak-light` 4.71:1 (OK), sobre `kh-iron` 3.28:1 (NO usar). `text-gray-500` sobre oak 3.27:1 y `text-gray-600` 2.09:1 (de ahí el hallazgo). `kh-seal` como texto sobre oak 1.53:1: el lacre es solo fondo/borde, el texto sobre él es `bone` (7.55:1).

## 2. Preservar #24 (R1–R6)

- No se toca `utils/viewport.js`, `components/ui/AppFrame.jsx` ni `index.css:381-404` (R5).
- Se reemplaza cada `vh` de AA por `calc(var(--kh-frame-h) * k)` (R2). Es lo que hace `ShopPanel.jsx:64`. Riesgo del brief: con aspecto > 2.1 el frame es más bajo que el viewport y `80vh` lo desbordaba. Esto cierra el riesgo solo para AA; los otros ~9 paneles con `vh` quedan fuera (Q5 de #24, §9).
- `MainMenu` ya usa el marco (`h-full` en vez de `h-screen`, #24 T5). Se agrega padding `var(--kh-safe-top|bottom)` (R3).
- `CombatInstancePanel` es `fixed inset-0` (`:116`). Se verifica en captura 412×915 que respeta el frame (R4); si no, se cambia a `absolute inset-0` dentro de `.kh-frame` (decisión del implementer, anotada en la evidencia).

## 3. Piezas nuevas (todas con tokens `KH`, sin arte nuevo)

- `components/ui/Toggle.jsx` — `({ on, disabled, onChange, label })`; `<button role="switch" aria-checked>`; pista 44×24 dentro de un área 44×44 (padding transparente), encendida `KH['brass-light']`, apagada `KH.iron`, perilla `KH.bone`. Encendida vs apagada = 4.65:1. Reemplaza el `Toggle` local de `SettingsPanel.jsx:207` y el `<button>` inline de `NotificationPrefsPanel.jsx:78-89`. Tests: `kitComponents.test.jsx` (R37).
- `components/ui/ResultBanner.jsx` — `({ outcome, title, children, onClose })`; `Panel variant="parchment"` (patrón de `OfflineReportModal.jsx:59`); `role="status"`; victoria: filete `brass-light`; derrota: franja `seal` con texto `bone`; un solo `Button primary` de cierre. Los tres resultados lo usan (R15–R20). `children` conserva los textos actuales (R21).
- `.kh-tab` / `.kh-tab--active` en `styles/index.css` junto a `.kh-btn` (`:233`). `min-height: 44px`; activa `oak-light` + borde `brass-light` + `bone`; inactiva `oak` + borde `iron` + `bone-dim`; texto 12–13 px. Usada por TechTree (`TechTreePanel.jsx:55`) y las pestañas Stats/Equipar de `HeroPanel.jsx:216` (R39–R41, R44). Test en `kitStyles.test.js`.

Alternativa descartada: pintar cada pestaña con `style` inline en cada panel. Se descarta porque ya hay tres paneles con pestañas (Héroes, Investigación, Meta) y el inline repite 44 px y colores en cada uno; una clase CSS se testea en un solo lugar.

## 4. Decisiones por pantalla

### MainMenu (R3, R22–R25)
- Botón principal `Button primary`, resto `secondary`; título `font-display` `bone`; subtítulos `bone-dim`.
- Fondo: constante `MENU_KEY_ART = '/assets/b/menu/key_art.webp'` y `onError` que cae a `backgroundColor: KH.ink` (R24). Se quita la referencia a `menu_bg.png` (R25). Con Q1 sin aprobar, el menú sale con fondo plano `kh-ink` y la feature sigue verde.

### HeroPanel (R26–R30, R44)
- `HeroPortrait` (`:43-60`) ya tiene `failed` + `CharacterSprite`. Cambia a `PortraitRing` (`ui/PortraitRing.jsx`, prop `size`); si `failed`, `PortraitRing` sin `src` (disco `oak`) con `CharacterSprite` centrado encima, mismo tamaño. Ruta de retrato igual: `/assets/game/heroes/<id>.png` (gitignored; hoy 18 retratos legacy); el arte nuevo es Q3.
- `RARITY_COLORS` (`:10-14`) pasa a mapa de tokens: `common`→iron, `rare`→brass, `epic`→ember, `legendary`→brass-light (borde y texto). El badge conserva el texto de rareza (R12, R28).
- Barras de stats a `Bar` (R29). Contenedor a `Panel` con `onClose`, sin `rounded-t-xl` ni `✕` (`:365`, `:380`).
- Estados vacíos `:196-197`, `:253`, `:431`, `:465`: `text-gray-500|600` → `kh-bone-dim`, ≥ 12 px.

### SystemMapPanel / GalaxyMapPanel (R31–R36)
- `STATE_STYLE` pasa a tokens: `claimed`→brass-light, `available`→brass, `traveling`→ember, `locked`→iron (anillo) con etiqueta `bone-dim`. Se conservan las etiquetas (`Controlado`, `Dominado`, `En los Caminos Velados`, `Fuera de alcance`, etc.). Se elimina el púrpura de Galaxy (`#a855f7`, `:32`) y el cian (`#4fd8c8`).
- Fondo: `/assets/b/map/marca.webp` y `reinos.webp` con capa `linear-gradient` oscura `rgba(20,17,13,.78)` encima (R34) y fallback `kh-oak` (R33). Q2.
- Identidad del Velo (Galaxy): único acento permitido `kh-macula` en filetes `aria-hidden` (R35); Q6.
- Contenedor `Panel`; `maxHeight` por `--kh-frame-h` (R2).

### Resultados (R15–R21)
- `CombatInstancePanel.jsx:233-240`: el bloque final pasa a `ResultBanner`; `EmberField` (`:250`) sigue solo en victoria (R18). Los botones «Volver…» pasan a `Button`.
- `WarPanel.jsx:255-279`: `ResultBanner` con el botín como `children`; el «← Volver» (`:274-278`) lo pasa a `Button secondary`. Contenedor `:441-442`: `Panel`; `max-h-[65vh]` → `calc(var(--kh-frame-h) * 0.65)`.
- `TerritoryMapPanel.jsx:178-200`: `ResultBanner`. El `SpriteIcon alliance size={28}` y el texto de conquista pasan intactos a `children`.

### Hallazgos F9 (R37–R43)
- Switches: `Toggle` (§3). Slider `accent-yellow-500` (`SettingsPanel.jsx:198`) → `style={{ accentColor: KH['brass-light'] }}`.
- Investigación: pestañas con `.kh-tab`. «Arte de la Guerra» es la rama más larga (`shared/gameConfig.js:534-537`); la pestaña usa `flex-wrap`/2 líneas y `min-height: 44px` en vez de truncar (R41). Banner «en progreso» y ramas completadas (`:66-68, 84, 91, 98`) a tokens.
- Misiones: vacío `:49-50` a `bone-dim`; botón verde `:117` a `Button primary`. Contenedor y `✕` (`:44`) al kit.

## 5. Archivos a tocar

Cliente (todo bajo `client/src/`): `components/menu/MainMenu.jsx`, `components/overlay/{HeroPanel,SystemMapPanel,GalaxyMapPanel,WarPanel,MissionsPanel,SettingsPanel}.jsx`, `components/castle/TechTreePanel.jsx`, `components/world/TerritoryMapPanel.jsx`, `components/campaign/CombatInstancePanel.jsx`, `components/ui/NotificationPrefsPanel.jsx`, `styles/index.css`. Nuevos: `components/ui/Toggle.jsx`, `components/ui/ResultBanner.jsx`, `tests/pantallasB.test.jsx`. Ampliados: `tests/kitComponents.test.jsx`, `tests/kitStyles.test.js`. Arte (solo si Q1/Q2/Q3 = sí): `client/public/assets/b/menu/key_art.webp`, `client/public/assets/b/map/{marca,reinos}.webp`, `client/public/assets/b/heroes/portraits/`. No se toca `server/`, `shared/`, `game/`, `AppFrame.jsx`, `viewport.js`.

## 6. Casos de error

| Caso | Comportamiento | R |
|---|---|---|
| Falta el key art / fondo de mapa | color plano `ink` / `oak`, texto legible | R24, R33 |
| Falla `<img>` de retrato | disco `oak` + `CharacterSprite`, sin imagen rota | R27 |
| `outcome` no reconocido en `ResultBanner` | se trata como `defeat` (sin fanfarria) | R15 |
| Estado de plaza desconocido | cae a `locked` (como hoy `STATE_STYLE[...] \|\| locked`) | R31 |
| Aspecto > 2.1 | contenido dentro del frame; bandas laterales de #24 | R4 |
| Sin `result.loot` | no se renderiza la línea de botín | R19, R20 |

## 7. Textos

Sin cambios de copy visible (R21), con una excepción pendiente de Q5: la rareza se muestra hoy como id en inglés (`common`, `rare`…, `HeroPanel.jsx:108,150`).

## 8. Alternativas descartadas

1. **Rehacer `HeroPanel` como grilla de retratos grandes.** Cambia el layout y el flujo; B4 es restyle, no rediseño. Queda como idea para F10 / siguiente ola.
2. **Un `ResultBanner` por pantalla.** Tres bloques casi iguales; un componente se testea una vez.
3. **Generar los fondos en este spec.** Las reglas del proyecto exigen el gate de arte (`p-kh`) y `aprobacion_arte.md`; ver Q1–Q3.

## 9. Fuera de alcance (anotado, no hecho)

- `MetaPanel` y sus pestañas (Rankings, Torneos, Alianzas…), `OperationsMap`, `ShopPanel`, `AchievementPanel`, `CodexPanel`, `CraftingPanel`, `GuildPanel`, `PassPanel`, `CalendarPanel` y demás paneles con `vh` o grises: ola siguiente. Q4.
- S1–S5 (`fix_superposiciones_ui`) y T1–T4 (`fix_textos_ui`): ya mergeados.
- APK / pantalla completa nativa (F10), Telegram fullscreen (Q3 de #24).
- Música, animaciones nuevas, rediseño de layout.
- Medir contraste de texto sobre el arte final (R34 lo mide en captura; el arte puede forzar ajustar la capa).

## 10. Preguntas abiertas (el owner responde en la tarea [GATE])

- **Q1 — Key art del menú.** ¿Generamos el key art (`menu/key_art.webp`) dentro de esta feature, con gate de arte p-kh? **Recomendación: sí, pero como etapa E separada al final** (como `reporte_escribano`): el código de T1–T9 queda completo con fondo plano; si el arte se aprueba, T10 solo suma el archivo. Así la feature no queda bloqueada por arte.
- **Q2 — Fondos de mapa.** ¿Generamos `marca.webp` y `reinos.webp` (2 imágenes)? **Recomendación: sí, en la misma etapa E**, con capa oscura y tope 250 KB. Si no, ambos mapas quedan en `oak` plano (decisión válida de estilo B).
- **Q3 — Retratos de héroes.** ¿Se regeneran los 18 retratos con la línea B? **Recomendación: no en esta feature.** 18 imágenes es un lote grande y los actuales viven en `assets/game/` (gitignored, no versionados). Se pide una feature de arte aparte; B4 los muestra en `PortraitRing` con fallback.
- **Q4 — Alcance de «pantallas principales».** ¿La lista de §1 es suficiente? **Recomendación: sí.** Tienda, Logros, Operaciones y el resto de `MetaPanel` ya están en el kit parcial o son otra ola; agregarlos duplica la feature.
- **Q5 — Rareza en español.** ¿Mostramos «Común / Rara / Épica / Legendaria» en lugar del id inglés? **Recomendación: sí**, con un mapa local de 4 etiquetas en `HeroPanel` (cambio de copy único, anotado en el reporte). Si no, R28 se cumple con el texto actual.
- **Q6 — Acento `macula` del Velo.** ¿Mantenemos un acento verde-musgo en Reinos Caídos? **Recomendación: solo en filetes decorativos**, nunca en texto ni estados; es la única nota de identidad que sobrevive sin salir de la paleta.
- **Q7 — Etiquetas de estado de plaza.** Hoy «Controlado» (Marca) y «Dominado» (Reinos). **Recomendación: no unificar** (lore distinto, `docs/lore.md`).
- **Q8 — `CombatInstancePanel` a pantalla completa.** ¿Se mantiene `fixed inset-0` si respeta el frame? **Recomendación: sí; solo se cambia a `absolute` dentro del frame si la captura 412×915 lo desborda.**
