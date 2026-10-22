# Tramos de nivel y obra del hub (`hub_b_tramos_nivel`)

> Referencia de producción de arte y de la regla que elige qué sprite se ve.
> Spec: `specs/hub_b_tramos_nivel/`. Código: `client/src/game/hub/hubLayout.js` y `HubSceneB.js`.

## 1. Qué se ve

Cada edificio del hub tiene **cuatro** dibujos:

| Variante | Cuándo se usa | Archivo | Clave Phaser |
|---|---|---|---|
| `bajo` | primeros niveles (y fallback de todo) | `client/public/assets/b/buildings/<id>.webp` | `hubb_bld_<id>` |
| `medio` | nivel intermedio | `.../<id>_medio.webp` | `hubb_bld_<id>_medio` |
| `alto` | últimos niveles | `.../<id>_alto.webp` | `hubb_bld_<id>_alto` |
| `obra` | mientras se construye o mejora (`state === 'construction'`) | `.../<id>_obra.webp` | `hubb_bld_<id>_obra` |

La obra gana siempre al tramo: un edificio de nivel alto que se está mejorando se ve en obra, y al completarse pasa al tramo
del nivel nuevo (`building_complete` recarga los edificios).

## 2. Regla de tramo

`buildingTier(buildingId, level)` en `hubLayout.js`, con `maxLevel` del edificio (`BUILDING_MAX_LEVEL`, espejo de `shared/gameConfig.js`):

- `bajo`  si `level <= round(max / 3)`
- `medio` si `level <= round(2·max / 3)`
- `alto`  el resto (incluye `level > max`)
- id desconocido o nivel no numérico / menor que 1 → `bajo`

## 3. Tabla de cortes

| max | edificios | bajo | medio | alto |
|---|---|---|---|---|
| 3 | embassy | 1 | 2 | 3 |
| 5 | mill, sawmill, smithy, stable, house, mine, tavern, market | 1-2 | 3 | 4-5 |
| 8 | trap, library | 1-3 | 4-5 | 6-8 |
| 10 | farm_plot, barn, tower, barracks, throne_room | 1-3 | 4-7 | 8-10 |
| 15 | wall | 1-5 | 6-10 | 11-15 |

Con max 5 el `medio` es solo el nivel 3: es un hito, no una barra de progreso.

## 4. Fallback

`variantTextureCandidates(id, variant)` da el orden de caída; la escena usa la primera textura cargada y, si no hay ninguna, `hubb_placeholder`:

- `alto` → `alto`, `medio`, `bajo`
- `medio` → `medio`, `bajo`
- `obra` → `obra`, `bajo`

Mientras falten webp de tramo, el hub se ve como antes (el `bajo`).

## 5. Contrato de cada webp nuevo (los comprueba `scripts/verify_tiers_b.js`)

- Fondo transparente real: 4 esquinas con alpha 0 y borde exterior de 1 px transparente.
- El pie toca el último 2 % del alto (así cae en `slot.y` en todas las variantes).
- Relación de aspecto a ±15 % de la del `bajo` (la caja de la ranura sale del aspecto del bajo).
- Centro horizontal del contenido a ≤ 6 % del ancho respecto del `bajo`.
- ≤ 150 KB cada uno y ≤ 2,2 MB los 51.
- Mismo edificio que el `bajo` (misma huella y silueta). `obra`: andamios, vigas, lonas, piedra a medio poner.
- Anclas: `throne_room.fire`, `tavern.smoke` y `smithy.smoke` de `HUB_SLOTS` deben seguir cayendo en el brasero / chimenea (≤ 20 px lógicos).

## 6. Pipeline

Desde la raíz del repo, en git-bash (la clave `GEMINI_API_KEY` va en `server/.env` o en el entorno):

```bash
# 1. generar (51 ítems; --only para un subconjunto, --force para pisar crudos)
node scripts/gen_art_b.js --manifest art-b/tramos/manifest.json --only tier_barn_medio,tier_barn_alto,tier_barn_obra
# 2. procesar: quita fondo y escala a la MISMA altura que el bajo; sin ids = los 17
bash art-b/tramos/process.sh barn
# 3. verificar R13-R17
node scripts/verify_tiers_b.js barn
# 4. hoja de contacto (bajo/medio/alto/obra)
node scripts/contact_sheet_b.js --cols 4 --out specs/hub_b_tramos_nivel/evidencia/tramos_prueba.webp <webps>
```

- `art-b/tramos/manifest.json`: ids `tier_<id>_<medio|alto|obra>`, `refs` = el `bajo` del edificio + `art-b/hub/refs/hub_base.webp`.
- Crudos en `art-b/tramos/raw/` (ignorado por git).
- Alturas de `process.sh` = las del `bajo` en `art-b/hub/process.sh`.
- Puerta de arte: primero la prueba de 3 imágenes del `barn` (`medio`, `alto`, `obra`); sin veredicto de p-kh en `specs/hub_b_tramos_nivel/evidencia/aprobacion_arte.md` no se generan las otras 48.
  Las reglas de prompt que salieron de esa prueba están en ese archivo, sección "Reglas de prompt para los 17 edificios".

## 7. Código que lo carga

`HUB_TEXTURES` registra hoy solo `hubb_bld_<id>` (bajo). Tras el `APROBADO` de arte (T11) pasa a registrar también `_medio`, `_alto` y `_obra` de cada edificio (80 entradas); el nombre de archivo es `<id>[_<variante>].webp` y debe coincidir con la tabla del apartado 1. Hasta entonces la escena cae al `bajo` (apartado 4).
