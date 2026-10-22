# Design — `hub_b_tramos_nivel`

Piel pura sobre `hub_b_escena`/`hub_b_recoleccion`: 51 webp nuevos (17 × `medio`, `alto`, `obra`) junto a los 17 `bajo` existentes, una función pura de tramo en `hubLayout.js`, y en `HubSceneB.syncBuildings` el cambio de textura del sprite existente según una `variant`. Sin tocar `server/` ni `shared/`.

## 1. Archivos a tocar

| Archivo | Cambio |
|---|---|
| `client/src/game/hub/hubLayout.js` | `BUILDING_MAX_LEVEL`, `TIERS`, `buildingTier`, `variantKey`, `variantTextureCandidates`; `HUB_TEXTURES` pasa a 80 entradas; `selectHubBuildings` agrega `tier` y `variant` |
| `client/src/game/scenes/HubSceneB.js` | quitar `CONSTRUCTION_TINT` (`:23`) y su uso (`:225` y el `clearTint`/`setAlpha` de la rama `built`); `createBuildingSprite(buildingId, variant)`; `applyVariant(entry, slot, variant)` llamado en `syncBuildings`; helper `variantTex` |
| `client/src/services/socketService.js` | `building_complete` llama `useGameStore.getState().loadBuildings()` además del aviso |
| `client/src/tests/hubLayout.test.js` | espejo `BUILDING_MAX_LEVEL`, tabla de cortes, `tier`/`variant`, `HUB_TEXTURES` = 80, candidatos de caída |
| `client/src/tests/pickupSources.test.jsx` (o `buildingTiers.test.jsx` nuevo) | handler `building_complete` |
| `client/src/tests/buildingVariantScene.test.js` (nuevo) | `syncBuildings`/`applyVariant` con doble de sprite (R32) |
| `art-b/tramos/manifest.json`, `art-b/tramos/process.sh` | nuevos; `/art-b/tramos/raw/` en `.gitignore` |
| `scripts/verify_tiers_b.js` | nuevo: transparencia, pie, ratio, centro y peso de los 51 webp |
| `scripts/hub_b_tramos_evidence.js` | nuevo: Playwright de capturas, mejora, obra y fps (calco de `scripts/hub_b_evidence.js`) |
| `client/public/assets/b/buildings/<id>_{medio,alto,obra}.webp` | 51 nuevos (los 17 `<id>.webp` no se tocan) |
| `docs/art-direction/hub-tramos-nivel.md` | nuevo: regla, tabla de cortes, obra, nombres, pipeline |
| `docs/art-direction/guia-manual-arte.md` | filas nuevas en "Dónde vive cada imagen" |
| `specs/hub_b_tramos_nivel/evidencia/` | evidencia |

No se toca: `server/`, `shared/`, `gameStore.js`, `EventBridge.js`, `HubPickups`, trabajadores. `OverlayManager.jsx:256` y `entities/Building.js` son de la escena v1 y quedan fuera.

## 2. Regla de tramo (R1–R5, R9)

```js
export const TIERS = ['bajo', 'medio', 'alto'];
export const BUILDING_MAX_LEVEL = { farm_plot: 10, barn: 10, mill: 5, sawmill: 5, smithy: 5, stable: 5, house: 5,
  mine: 5, wall: 15, tower: 10, barracks: 10, trap: 8, tavern: 5, market: 5, embassy: 3, throne_room: 10, library: 8 };
export function buildingTier(buildingId, level) {
  const max = Object.prototype.hasOwnProperty.call(BUILDING_MAX_LEVEL, buildingId) ? BUILDING_MAX_LEVEL[buildingId] : 0;
  const lv = Number(level);
  if (!max || !Number.isFinite(lv) || lv < 1) return 'bajo';
  if (lv <= Math.round(max / 3)) return 'bajo';
  if (lv <= Math.round((2 * max) / 3)) return 'medio';
  return 'alto';
}
```

Sin `is_building` en la firma (R9). `level > max` da `alto` (R4). `Number(null)` es 0 → `bajo`. Los valores de `BUILDING_MAX_LEVEL` salen de `shared/gameConfig.js` y el implementer los verifica contra él (R6).

## 3. Tabla de cortes (R2, R7)

`bajo` ≤ `round(max/3)`, `medio` ≤ `round(2·max/3)`, `alto` el resto (con estos max no aparece el caso `.5` de `Math.round`).

| max | edificios | bajo | medio | alto |
|---|---|---|---|---|
| 3 | embassy | 1 | 2 | 3 |
| 5 | mill, sawmill, smithy, stable, house, mine, tavern, market | 1-2 | 3 | 4-5 |
| 8 | trap, library | 1-3 | 4-5 | 6-8 |
| 10 | farm_plot, barn, tower, barracks, throne_room | 1-3 | 4-7 | 8-10 |
| 15 | wall | 1-5 | 6-10 | 11-15 |

Con max 5 el `medio` cubre solo el nivel 3: es un hito, no una barra de progreso. `BUILDING_MAX_LEVEL` espeja `shared/gameConfig.js` porque `client/` no lo importa (CommonJS fuera de la raíz de Vite; igual que `HUB_SLOTS`); el test lee `shared/` con `createRequire` y compara.

## 4. Variantes y texturas (R25, R35, R36)

```js
export const variantKey = (id, v) => (v === 'bajo' ? `hubb_bld_${id}` : `hubb_bld_${id}_${v}`);   // v ∈ TIERS + 'obra'
export function variantTextureCandidates(id, v) {              // orden de caída
  if (v === 'obra') return [variantKey(id, 'obra'), variantKey(id, 'bajo')];
  const i = TIERS.indexOf(v);
  return TIERS.slice(0, (i < 0 ? 0 : i) + 1).reverse().map((t) => variantKey(id, t));
}
```

`HUB_TEXTURES`: `BUILDING_IDS.flatMap((id) => [...TIERS, 'obra'].map((v) => ({ key: variantKey(id, v), url: `/assets/b/buildings/${id}${v === 'bajo' ? '' : '_' + v}.webp` })))`. Total 4 + 68 + 8 = 80. El regex del test existente sigue valiendo.

`variantTex(id, v)` en la escena recorre `variantTextureCandidates` y devuelve la primera con `this.textures.exists`; si ninguna, `'hubb_placeholder'`.

## 5. Escena (R26–R36)

`selectHubBuildings` (`hubLayout.js:158-177`) agrega `tier = buildingTier(id, record.level)` y `variant = state === 'construction' ? 'obra' : tier`. El `level` es el del representativo (`pickRepresentative`: el más alto entre los construidos; si todos están en obra, el de menor id).

`createBuildingSprite(buildingId, variant)`: igual que hoy (`HubSceneB.js:245-255`) con la textura de `variantTex` y `sprite.setData('variant', variant)`.

`applyVariant(entry, slot, variant)`, llamada en `syncBuildings` tras `entry.record = item.record` (`:220`) y antes del bloque de `state`:

```js
const sp = entry.sprite;
if (sp.getData('variant') === variant) return;                 // R32
this.tweens.killTweensOf(sp);                                  // R31
sp.setTexture(this.variantTex(item.buildingId, variant));
const sc = Math.min(slot.w / sp.width, slot.h / sp.height);   // R29
sp.setScale(sc).setData('baseScale', sc).setData('variant', variant);
sp.removeInteractive();
sp.setInteractive({ pixelPerfect: true, alphaTolerance: 8 }); // R30
```

`setTexture` conserva origen `(0.5,1)`, posición y profundidad: con pie y aspecto compartidos (R14–R16) el sprite no salta. En el bloque de `state`, la rama `construction` ya no hace `setTint`/`setAlpha`; solo destruye trabajador y humo; la rama `built` repone trabajador/humo y no necesita `clearTint` (R33, R34). Se elimina `CONSTRUCTION_TINT`.

Fantasma (R36): `startPlacement` (`:624`) sigue con `hubb_bld_${id}` (bajo); sin cambio de código.

## 6. "Sin recargar" y refresco (R28, R34, R37, R38, R44)

- Inicio: `upgradeBuilding`/`buildNew` (`gameStore.js:537-556`) ya llaman `loadBuildings()` → `set({ buildings })` → suscripción (`HubSceneB.js:90`) → `syncBuildings`. El server pone `is_building = true` y sube `level` al iniciar (`buildingService.js:175-179`): `variant` pasa a `obra`.
- Fin: `gameTick.js:113-132` pone `is_building = false` y emite `building_complete`; hoy `socketService.js:21-26` solo notifica, así que el hub quedaba en el estado viejo. Se agrega `useGameStore.getState().loadBuildings()` al handler (patrón `crop_ready` → `loadPlots`, `pickupSources.test.jsx:21`): `variant` pasa al tramo del `level` nuevo. `loadBuildings` ya emite `building:completed` solo en la transición; no se duplica. Sin eventos nuevos (R39).

## 7. Arte (R10–R23) y estimación Gemini

**Estimación:** 34 tramos + 17 obras = **51 imágenes** (la prueba previa de 3, R21, es parte de las 51) + ~50 % de reintentos esperables (silueta/pie/ancla fuera de tolerancia) ≈ **75 llamadas** al modelo de imagen 2K de `gen_art_b.js`. Carta blanca del owner: no es pregunta.

**Reaprovechar:** los 17 bajos (como ref de identidad y de dimensiones), `art-b/gr/refs` y el preset `grimdark` de `gen_art_b.js`. No hay arte de obra B previo: lo único parecido es el andamio v1 (`entities/Building.js`, escena vieja, sin sprite B).

**Recomendación: una `obra` por edificio (17)**, no un andamio genérico superpuesto. Motivo técnico: un overlay genérico no se adapta a las 17 huellas ni a las alturas de `HUB_SLOTS` (embassy/tower/wall difieren mucho), taparía o desbordaría la caja de la ranura y rompería el pie compartido; además el dibujo propio deja ver la "piedra a medio poner" del propio edificio. No hay motivo técnico a favor del overlay, así que no queda como pregunta de arte.

Pipeline calcado de `art-b/hub/` y `art-b/pickups/`:

1. `art-b/tramos/manifest.json`: 51 ítems `{id: "tier_<id>_<medio|alto|obra>", kind: "ui", aspect, refs: ["client/public/assets/b/buildings/<id>.webp", "art-b/gr/refs/…"], prompt}`. Prompt común: mismo edificio, misma huella, silueta y toma, mismo pie, sin texto ni marcos. `medio`: reforzado, más piedra y detalle. `alto`: ornamentado, iluminado, estandartes. `obra`: andamios, vigas expuestas, lonas, piedra a medio poner, silueta reconocible.
2. Generación: `node scripts/gen_art_b.js --manifest art-b/tramos/manifest.json [--only <ids>]` (requiere `GEMINI_API_KEY`).
3. Prueba (R21): `--only tier_barn_medio,tier_barn_alto,tier_barn_obra` (`barn`, silueta clara); hoja a p-kh; parar hasta veredicto.
4. `art-b/tramos/process.sh`: `scripts/process_art_b.js raw/<x>.png $B/<id>_<variante>.webp --height <H del bajo>` con la misma altura y `--min-hole` que el bajo (`art-b/hub/process.sh:31-…`), para que aspecto y pie coincidan (R14, R15).
5. Verificación: `scripts/verify_tiers_b.js` (R13–R17: alpha, pie, ratio, `dcx`, peso) y `scripts/contact_sheet_b.js --cols 4` (R18: bajo/medio/alto/obra).
6. Anclas (R20): `evidencia/tramos_anclas.webp` con sharp, cruces en `HUB_SLOTS.throne_room.fire`, `tavern.smoke`, `smithy.smoke`. La `obra` no necesita ancla de fuego/humo (la escena los apaga en obra: `syncBuildings` y `syncFire` exigen `state === 'built'`).

El bajo se **reutiliza** sin regenerar (R12). Mantener sus alturas evita reajustar `HUB_SLOTS`.

## 8. Evidencia (R38, R40–R42, R44)

`scripts/hub_b_tramos_evidence.js` (patrón de `scripts/hub_b_evidence.js`): Playwright 412×860 @2x; intercepta `GET /api/buildings` para sembrar `level` por tramo y `is_building`; captura los hubs por tramo y en obra, el ciclo de mejora (intercepta `POST /api/buildings/upgrade`, luego `GET /api/buildings` con `is_building = 1`, y por último con `is_building = 0` tras disparar el handler de `building_complete`), mide fps 20 s y consola. Los Vitest cubren la lógica pura y el doble de sprite.

## 9. Casos de error

| Caso | Comportamiento |
|---|---|
| `level` nulo, no numérico, < 1 | `bajo` (R3) |
| `level` > max | `alto` (R4) |
| `building_id` sin max | `bajo`; la escena ni lo dibuja (sin ranura) |
| webp de variante no carga | cae al tramo inferior (`obra` → `bajo`), luego `hubb_placeholder`; sin excepción (R35) |
| Mejora cruza dos cortes | pasa directo al tramo final al terminar; `applyVariant` no encadena |
| Doble `syncBuildings` misma variante | no-op (R32) |
| `building_complete` y `loadBuildings` falla | `loadBuildings` ya captura y hace `console.error`; el aviso se emite antes; el siguiente `loadBuildings` (mejora, `buildings:refresh`) lo corrige |
| Se pierde el socket durante la obra | el hub queda en `obra` hasta el próximo `loadBuildings`; mismo límite que hoy con el tint |
| Edificio nuevo (`buildNew`) | nace en `obra`; al terminar, `bajo` (nivel 1) |

## 10. Alternativas descartadas

- **Andamio genérico superpuesto** (un solo sprite de obra sobre el edificio): no encaja con 17 huellas distintas ni con el pie compartido (§7).
- **Mantener el tint gris durante la obra**: reemplazado por decisión del owner; el tint no comunica "se está reconstruyendo".
- **Regenerar también los 17 bajos**: duplica costo y rompe arte aprobado en `hub_b_escena`; se reutilizan.
- **Destruir y recrear el sprite al cambiar de variante**: pierde interactividad, tweens y profundidad, y parpadea; `setTexture` + recalcular escala es más barato y atómico.
- **Cortes por tabla fija de niveles**: se desfasa si `shared/` cambia `maxLevel`; la fracción de max se adapta y el test detecta divergencia del espejo.
- **Evento nuevo `building:variantChanged` en `EventBridge`**: innecesario; la suscripción al store ya llega a `syncBuildings`.
- **Importar `maxLevel` desde `shared/`**: descartado en `hub_b_escena` (CommonJS fuera de la raíz de Vite); se espeja con test.

## 11. Pregunta abierta única: fórmula y tabla de cortes

**Recomendación (la que usa este spec):** `bajo` ≤ `round(max/3)`, `medio` ≤ `round(2·max/3)`, `alto` el resto; tabla de §3. Es proporcional al `maxLevel` real, igual para los 17 y se adapta si `shared/` cambia.

**Alternativa:** cortes fijos por hito (p. ej. `bajo` 1-2, `medio` 3-5, `alto` 6+) iguales para todos: más simple, pero `embassy` (max 3) nunca llegaría a `alto` y `wall` (max 15) lo vería ya en el nivel 6.

El owner confirma o ajusta la tabla en la puerta de aprobación; si cambia, solo cambian `buildingTier`, su tabla de tests y `hub-tramos-nivel.md`, no el arte (siempre 3 tramos + obra).
