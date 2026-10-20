#!/usr/bin/env bash
# Hub B (feature hub_b_escena): art-b/hub/raw → client/public/assets/b (correr desde la raíz del repo).
# Alturas = ceil16(1.5 × alto lógico mostrado) (specs/hub_b_escena/design.md §5.1, §8.4); nunca mayores que el
# recorte de origen (regla de no ampliación §8.3). Coords de --crop medidas por componentes conexos sobre los crudos.
#   NODE="/c/Program Files/nodejs/node.exe" bash art-b/hub/process.sh [1|2]   (sin argumento: ambas tandas)
set -e
N="${NODE:-node}"; R=art-b/hub/raw; O=client/public/assets/b
p() { "$N" scripts/process_art_b.js "$@" </dev/null; }
T="${1:-all}"

if [ "$T" != 2 ]; then
  # Tanda 1: capas de la escena
  p $R/hub_sky_calm.png  $O/hub/sky_calm.webp  --scene
  p $R/hub_sky_storm.png $O/hub/sky_storm.webp --scene
  # base/fg tocan el borde inferior con barro: el fondo se estima con la mediana de las 4 esquinas, así que se
  # pintan 2×2 px de las esquinas inferiores con el color de la esquina superior izquierda (gris liso) vía --erase.
  # fg: --min-hole baja el mínimo de los huecos de fondo cerrados (bolsillos grises entre tablas y pasto).
  p $R/hub_base.png      $O/hub/base.webp      --erase 0,2750,2,2 --erase 1534,2750,2,2 --width 1280
  p $R/hub_fg.png        $O/hub/fg.webp        --erase 0,1534,2,2 --erase 2750,1534,2,2 --min-hole 0.00001 --width 1280
  mkdir -p art-b/hub/refs && cp $O/hub/base.webp art-b/hub/refs/hub_base.webp
fi

if [ "$T" != 1 ]; then
  # Tanda 2: edificios (17). Crops = bbox de componentes conexos (escala 1/4, tol 38) + 8 px de margen.
  # throne_room y mine salen de bld_sheet_7 (bld_throne_room suelto falló 2 veces: insertos/kit de piezas; mine de
  # bld_sheet_5 quedó cortada por el borde). farm_plot se corta en y=1266: bajo esa línea hay una banda de niebla.
  # --height = ceil16(1.5 × alto mostrado real) (design.md §5.1). T12 agrandó las ranuras (medición del chrome real y
  # legibilidad en teléfono): cada caja es alto objetivo × aspecto del webp, así que el alto mostrado = h de la ranura
  # y la relación queda en ~1.0-1.07× a DPR 3 (R42) y ~1.5-1.6× a DPR 2 (R43). Si cambia una ranura, se recalcula.
  B=$O/buildings
  p $R/bld_sheet_7.png $B/throne_room.webp --crop 116,28,1216,1460  --min-hole 0.00001 --height 608
  p $R/bld_sheet_7.png $B/mine.webp        --crop 1424,480,1260,936 --min-hole 0.00001 --height 256
  p $R/bld_sheet_1.png $B/library.webp     --crop 160,28,1084,1428  --min-hole 0.00001 --height 448
  p $R/bld_sheet_1.png $B/embassy.webp     --crop 1356,44,1204,1416 --min-hole 0.00001 --height 416
  p $R/bld_sheet_2.png $B/tower.webp       --crop 112,8,948,804     --min-hole 0.00001 --height 288
  p $R/bld_sheet_2.png $B/wall.webp        --crop 1292,48,1344,764  --min-hole 0.00001 --height 208
  p $R/bld_sheet_2.png $B/barracks.webp    --crop 636,792,1456,724  --min-hole 0.00001 --height 240
  p $R/bld_sheet_3.png $B/tavern.webp      --crop 12,240,904,944    --min-hole 0.00001 --height 320
  p $R/bld_sheet_3.png $B/market.webp      --crop 916,472,964,704   --min-hole 0.00001 --height 256
  p $R/bld_sheet_3.png $B/smithy.webp      --crop 1908,304,836,868  --min-hole 0.00001 --height 304
  p $R/bld_sheet_4.png $B/mill.webp        --crop 84,44,1008,1420   --min-hole 0.00001 --height 368
  p $R/bld_sheet_4.png $B/house.webp       --crop 1292,40,1068,724  --min-hole 0.00001 --height 208
  p $R/bld_sheet_4.png $B/barn.webp        --crop 1476,772,1228,716 --min-hole 0.00001 --height 224
  p $R/bld_sheet_5.png $B/sawmill.webp     --crop 24,192,1032,1024  --min-hole 0.00001 --height 304
  p $R/bld_sheet_5.png $B/stable.webp      --crop 900,304,1012,980  --min-hole 0.00001 --height 272
  p $R/bld_sheet_6.png $B/farm_plot.webp   --crop 52,200,1420,1066  --min-hole 0.00001 --height 240
  p $R/bld_sheet_6.png $B/trap.webp        --crop 1548,204,1064,1062 --min-hole 0.00001 --height 160
  # Trabajadores (8): pose A = figura izquierda, B = derecha; --flip donde miran a la izquierda.
  W=$O/workers
  p $R/wk_sheet_farmer.png     $W/farmer_a.webp     --crop 156,44,976,1420   --height 208 --flip
  p $R/wk_sheet_farmer.png     $W/farmer_b.webp     --crop 1420,80,1176,1384 --height 208 --flip
  p $R/wk_sheet_woodcutter.png $W/woodcutter_a.webp --crop 208,64,920,1356   --height 208
  p $R/wk_sheet_woodcutter.png $W/woodcutter_b.webp --crop 1396,176,1216,1248 --height 208
  p $R/wk_sheet_miner.png      $W/miner_a.webp      --crop 200,48,860,1416   --height 208 --flip
  p $R/wk_sheet_miner.png      $W/miner_b.webp      --crop 1384,168,1172,1292 --height 208 --flip
  p $R/wk_sheet_merchant.png   $W/merchant_a.webp   --crop 192,96,948,1396   --height 208
  p $R/wk_sheet_merchant.png   $W/merchant_b.webp   --crop 1496,76,1100,1416 --height 208
fi
