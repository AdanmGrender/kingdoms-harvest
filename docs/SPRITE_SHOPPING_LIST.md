# Sprite Shopping List — Kingdoms Harvest

> 18 slots faltantes para terminar de poblar el juego visualmente. Esta es
> una lista de **compra/curación manual** — el loader ya está listo, vos
> dropas los PNGs con el nombre correcto en la carpeta correcta y aparecen.
>
> **Estilo objetivo:** pixel-art top-down, paleta cálida medieval estilo
> Kenney (ya tenés su pack base en `client/public/assets/kenney-medieval/`).
> Si encontrás un asset con paleta muy distinta, mejor saltearlo — la
> coherencia visual pesa más que la cantidad.
>
> **Última auditoría:** 2026-05-04 · branch `iso-rework`

---

## Convenciones del loader (ya existentes)

El loader [BootScene.js](../client/src/game/scenes/BootScene.js) carga assets
desde dos raíces fijas. **Si respetás los nombres, no hace falta tocar
código.**

| Prefijo / ruta | Tipo | Frame size | Auto-cargado |
|---|---|---|---|
| `/assets/kenney-medieval/PNG/Default size/Tile/medievalTile_NN.png` | terreno | 64×64 | sí (1..58) |
| `/assets/kenney-medieval/PNG/Default size/Environment/medievalEnvironment_NN.png` | árbol/roca/flor | 64×64 | sí (1..21) |
| `/assets/kenney-medieval/PNG/Default size/Structure/medievalStructure_NN.png` | edificio | 64×64 | sí (1..23) |
| `/assets/game/characters/npc_<role>.png` | NPC sheet | 32×48, 4 frames | sí — agregar `<role>` a `npcNames` |
| `/assets/game/animals/<species>.png` | animal sheet | 32×32, 4 frames | parcial — chicken/cow/sheep ya, otros requieren edit |
| `/assets/game/effects/effects.png` | partículas | 16×16 sheet | sí (1 archivo único) |
| `/assets/game/ui/*.png` | UI estática | libre | sólo `dialog_frame` cargado, resto manual |
| `/assets/sprites/*.png` | UI sprite-sheet (iconos) | clip via CSS background-position | servido como `<img src>` |

> **Regla de oro:** cualquier `iso_struct_24+`, `iso_env_22+`, `iso_tile_59+`
> drop-in funciona si extendés el loop en BootScene (cambio de 1 línea).
> Cualquier `npc_<nuevoRole>.png` requiere agregar el role al array
> `npcNames` en BootScene + `createNPCAnimations`.

---

## Filtros de licencia (sólo verde está OK)

| Marca | Significado | Acción |
|---|---|---|
| 🟢 **CC0** | dominio público, hacé lo que quieras | drop-in directo |
| 🟢 **CC-BY** | atribución requerida | drop-in + agregar línea a `CREDITS.md` |
| 🟡 **CC-BY-NC** | uso no-comercial — ojo, KH cobra TON | **EVITAR** salvo que se aclare con el autor |
| 🔴 **paid** | comprar licencia | sólo si está presupuestado |
| 🔴 **"credit not required, donations welcome"** | usualmente CC-BY implícito | tratar como CC-BY |
| 🚫 **all rights reserved** | no usar | saltear |

**Sitios por nivel de fricción:**

1. **OpenGameArt.org** 🟢 — buscador filtrable por CC0; bulk-download decente
2. **itch.io** (free + pixel-art) — variable; cada pack tiene su licencia individual
3. **Kenney.nl** 🟢 — todo CC0, ya estás usando su pack medieval
4. **Craftpix free** — login requerido, mayoría CC0 con atribución; los premium son 🔴
5. **OpenGameArt + LPC ("Liberated Pixel Cup")** — sets coherentes 32×48 que matchean nuestro NPC frame size

---

## Los 18 slots

### A. Edificios — reemplazar fallbacks (5)

Actualmente estos buildings fueron mapeados a `iso_struct_N` reciclados de
otra pool — se ven OK pero "honestos no son". Reemplazar con sprites
custom mejora identidad.

| # | Slot | Nombre archivo | Tamaño | Search keywords | Licencia OK |
|---|---|---|---|---|---|
| 1 | **mine** (entrada cueva) | `iso_struct_24.png` (drop-in) | 64×64 PNG alpha | `medieval mine pixel art top-down`, `cave entrance 64x64`, `dwarf mine sprite` | 🟢 CC0 / CC-BY |
| 2 | **library** | `iso_struct_25.png` | 64×64 PNG alpha | `medieval library pixel`, `wizard tower 64x64`, `scholar tower top-down` | 🟢 CC0 / CC-BY |
| 3 | **embassy** (edificio diplomático) | `iso_struct_26.png` | 64×64 PNG alpha | `colonial mansion pixel`, `medieval embassy`, `noble house top-down` | 🟢 CC0 / CC-BY |
| 4 | **wall segment** (muralla) | `iso_struct_27.png` | 64×64 PNG alpha | `stone wall segment medieval pixel`, `castle wall tile`, `fortification 64x64` | 🟢 CC0 / CC-BY |
| 5 | **trap** | `iso_struct_28.png` | 64×64 PNG alpha | `medieval trap pixel`, `bear trap top-down`, `spike pit sprite` | 🟢 CC0 / CC-BY |

**Cómo activar:** subir el `medievalStructure_24.png` (etc) a
`client/public/assets/kenney-medieval/PNG/Default size/Structure/`, luego
en [BootScene.js:75-77](../client/src/game/scenes/BootScene.js#L75-L77)
extender el loop a `i <= 28`. Después actualizar
[buildingSprites.js](../client/src/game/config/buildingSprites.js)
para apuntar mine/library/etc a sus nuevos IDs.

> **Sources sugeridos:**
> - itch.io: ["Medieval Buildings 64×64"](https://itch.io/game-assets/free/tag-2d/tag-pixel-art) — pack típico tiene ~20 estructuras
> - OpenGameArt: search `medieval village set` — varios CC0
> - Craftpix free: "Medieval Buildings Pixel Art Pack" (login req)

---

### B. Personajes / Heroes (4)

| # | Slot | Nombre archivo | Tamaño | Search keywords | Licencia OK |
|---|---|---|---|---|---|
| 6 | **Hero portraits** (busts para HeroPanel) | `hero_<id>_portrait.png` (4 portraits) | 64×64 cada uno (front-facing bust) | `RPG hero portrait pixel`, `character bust 64x64`, `medieval hero face` | 🟢 CC0 |
| 7 | **Hero full-body sheets** (4 héroes top-down) | `hero_<id>.png` | 32×48 sheet, 4 frames por dirección (↓→↑← × 4 = 16 frames) | `LPC character base`, `top-down rpg hero spritesheet`, `4-direction walk pixel` | 🟢 CC0 (LPC) |
| 8 | **Princess walk-anim** (princess sprite ya cargada pero sin walk) | `npc_princess.png` (reemplazar) | 32×48 sheet, 4 frames mínimo | `princess pixel sprite 32x48`, `noble lady spritesheet` | 🟢 CC0 |
| 9 | **Villager extras** (scholar, priest, fisher) | `npc_scholar.png`, `npc_priest.png`, `npc_fisher.png` | 32×48 sheet, 4 frames | `medieval villager pixel pack 32x48`, `peasant spritesheet`, `priest sprite top-down` | 🟢 CC-BY (LPC) |

**Cómo activar:**
- (6) Hero portraits → drop en `/assets/game/characters/portraits/`, agregar import en [HeroPanel.jsx]
  (no creado todavía — espera a que esté el sistema héroes)
- (7) Hero sheets → drop en `/assets/game/characters/`, extender BootScene
  loop con 4 nuevos `this.load.spritesheet('hero_X', ...)`
- (8) Princess walk → reemplazar archivo + ya creas anim `npc_princess_walk`
  (BootScene ya lo registra, sólo necesita los frames 2-3)
- (9) Extras → agregar `'scholar', 'priest', 'fisher'` al array
  `npcNames` en [BootScene.js:81](../client/src/game/scenes/BootScene.js#L81)
  y [Villager.js:12-19](../client/src/game/entities/Villager.js#L12-L19)
  ROLE_SPRITE_MAP

---

### C. Iconos UI (4)

Los iconos actuales son emojis (🪙 🪵 🪨 ⛏️). Funciona pero rompe estilo
pixel-art. Sprite-sheet UI de iconos cuadrados es el reemplazo.

| # | Slot | Nombre archivo | Tamaño | Search keywords | Licencia OK |
|---|---|---|---|---|---|
| 10 | **Resource icons** (gold, wood, stone, iron, wheat, water, flour, bread) | `ui_resources.png` (8-frame sheet) | 32×32 cada frame (sheet 256×32) | `pixel resource icons`, `RPG inventory icons 32x32`, `food crafting icons pack` | 🟢 CC0 |
| 11 | **Item icons** (potions, scrolls, gems, keys para missions) | `ui_items.png` (16-frame sheet) | 32×32 cada frame | `pixel art item pack`, `inventory icons RPG`, `potion scroll gem pixel` | 🟢 CC0 |
| 12 | **Building category icons** (granja/defensa/social/noble) | `ui_categories.png` (4-frame sheet) | 32×32 cada frame | `pixel category icons medieval`, `RTS HUD icons` | 🟢 CC0 |
| 13 | **Status icons** (bell notif, gear, quest scroll, lock, check) | `ui_status.png` (8-frame sheet) | 16×16 cada frame | `pixel ui icon pack 16x16`, `kenney UI` (Kenney tiene packs UI gratis) | 🟢 CC0 (Kenney) |

**Cómo activar:** drop en `/assets/game/ui/`, agregar:

```js
// BootScene.preload()
this.load.spritesheet('ui_resources', '/assets/game/ui/ui_resources.png',
  { frameWidth: 32, frameHeight: 32 });
```

Después en componentes React, reemplazar `🪙` por `<SpriteIcon sheet="ui_resources" frame={0} />` (componente ya existe en [SpriteIcon.jsx]).

---

### D. Animales — variedad (3)

| # | Slot | Nombre archivo | Tamaño | Search keywords | Licencia OK |
|---|---|---|---|---|---|
| 14 | **pig** | `pig.png` | 32×32 sheet, 4 frames (idle 0-1, walk 2-3) | `pig pixel sprite 32x32`, `farm animal sheet`, `cerdito top-down` | 🟢 CC0 |
| 15 | **goat** | `goat.png` | 32×32 sheet, 4 frames | `goat pixel sprite top-down`, `farm goat 32x32` | 🟢 CC0 |
| 16 | **horse** | `horse.png` | 32×32 sheet, **8 frames** (4 idle + 4 walk para que galope mejor) | `horse pixel sprite top-down`, `medieval horse 32x32 walk cycle` | 🟢 CC0 |

**Cómo activar:** drop en `/assets/game/animals/`, extender [BootScene.js:96-107]
con `this.load.spritesheet('pig', ...)` etc. Agregar el animal al array
chroma-key de `create()` (línea 124-128) si tiene fondo blanco.
Agregar a `createAnimalAnimations()` para idle+walk anims.

> **Tip caveman:** OpenGameArt tiene "Lots of farm animals" pack CC0 con
> chicken/pig/cow/horse/sheep/goat juntos en mismo estilo — buscarlo es
> 1 búsqueda, te tira los 3 faltantes en 1 download.

---

### E. Efectos / clima (2)

| # | Slot | Nombre archivo | Tamaño | Search keywords | Licencia OK |
|---|---|---|---|---|---|
| 17 | **Weather overlay** (rain, snow, fog) | `weather_<type>.png` (3 archivos) | 256×256 tileable, 8 frames anim | `pixel rain overlay tileable`, `snow particles spritesheet`, `fog overlay seamless` | 🟢 CC0 |
| 18 | **Combat particles** (slash, parry, hit-spark, blood-puff) | `effects_combat.png` (16-frame sheet) | 32×32 sheet | `combat fx pixel`, `slash effect spritesheet 32x32`, `hit spark pixel art pack` | 🟢 CC0 |

**Cómo activar:** drop en `/assets/game/effects/`, registrar en BootScene
con frame size correcto. Para weather, tilear sobre el viewport en
WorldScene's render() durante la fase del día correspondiente.
DayNightSystem ya emite eventos — engancharle el rain.

---

## Workflow recomendado (caveman opinion)

1. **Pasada 1 — animales (slots 14-16):** la search "OpenGameArt farm
   animals CC0 pack" te da los 3 en 1 download. Empezá ahí, es el
   quick-win más visible.
2. **Pasada 2 — UI iconos (slots 10-13):** Kenney tiene un "UI Pack
   RPG" CC0 que cubre status + categorías. 1 download cubre 3 slots.
3. **Pasada 3 — edificios custom (slots 1-5):** los más visibles del
   juego. Buscar un pack medieval coherente (mismo artista) en
   itch.io free para que no se vean mezclados. ~$0-5 USD si hay que pagar.
4. **Pasada 4 — heroes (slots 6-9):** dejar para cuando exista el
   sistema héroes server-side. Hoy es prematuro.
5. **Pasada 5 — clima/efectos (slots 17-18):** polish final. Buscar
   "Pixel Art Effects Pack" — hay varios CC0.

---

## Después de descargar — verificación pre-commit

Antes de commitear cualquier sprite nuevo, correr este check:

- [ ] PNG con alpha (no fondo blanco). Si tiene blanco, agregarlo al
      `chromaKeyTargets` array en [BootScene.js:123-128](../client/src/game/scenes/BootScene.js#L123-L128)
- [ ] Frame size matchea la convención (32×32, 32×48, 64×64)
- [ ] Filename respeta el slug exacto del slot (snake_case, sin espacios,
      sin acentos)
- [ ] Licencia anotada en `docs/CREDITS.md` (crear si no existe) con:
      autor, sitio, URL, licencia, fecha de descarga
- [ ] Probado localmente con `cd client && npm run dev` y screenshot a
      `/?iso=1&preview=world` — el sprite tiene que renderizar sin
      errores de "missing texture" en consola

---

## Referencias del repo

- Loader: [client/src/game/scenes/BootScene.js](../client/src/game/scenes/BootScene.js)
- Building → struct mapping: [client/src/game/config/buildingSprites.js](../client/src/game/config/buildingSprites.js)
- Villager → NPC mapping: [client/src/game/entities/Villager.js](../client/src/game/entities/Villager.js)
- Decoration pools: [client/src/game/maps/IsoMapGenerator.js:64-80](../client/src/game/maps/IsoMapGenerator.js#L64-L80)
- AI generation prompts (si vas con seeles.ai): [docs/AI_ART_GUIDE.md](AI_ART_GUIDE.md)

---

## TL;DR

```
Slots:    18 (5 edificios + 4 chars + 4 UI + 3 animales + 2 efectos)
Sitios:   OpenGameArt (🟢 CC0) > Kenney (🟢 CC0) > itch.io (variable)
Tiempo:   ~3-4 hrs si vas pasada por pasada
Costo:    $0 si te limitás a CC0; ~$10-20 si comprás 1-2 packs premium
Bloqueo:  hero portraits (slot 6) — esperar al sistema héroes server-side
```
