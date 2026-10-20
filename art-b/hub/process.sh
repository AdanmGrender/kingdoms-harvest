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
  p $R/hub_base.png      $O/hub/base.webp      --width 1280
  p $R/hub_fg.png        $O/hub/fg.webp        --width 1280
  mkdir -p art-b/hub/refs && cp $O/hub/base.webp art-b/hub/refs/hub_base.webp
fi

if [ "$T" != 1 ]; then
  # Tanda 2: edificios (17) y trabajadores (8)
  p $R/bld_throne_room.png $O/buildings/throne_room.webp --height 704
fi
