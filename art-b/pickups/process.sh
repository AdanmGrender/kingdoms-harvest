#!/usr/bin/env bash
# Objetos de recolección (feature hub_b_recoleccion): art-b/pickups/raw → client/public/assets/b/pickups (correr desde la raíz del repo).
# Generar antes: node scripts/gen_art_b.js --manifest art-b/pickups/manifest.json   (requiere GEMINI_API_KEY)
# --height 128 = ceil16(1.5 × 84 px lógicos mostrados) (specs/hub_b_recoleccion/design.md §6, R13).
#   NODE="/c/Program Files/nodejs/node.exe" bash art-b/pickups/process.sh
set -e
N="${NODE:-node}"; R=art-b/pickups/raw; O=client/public/assets/b/pickups
p() { "$N" scripts/process_art_b.js "$@" </dev/null; }
mkdir -p $O
p $R/pickup_sack.png       $O/sack.webp       --height 128
p $R/pickup_egg_basket.png $O/egg_basket.webp --height 128
p $R/pickup_milk_pail.png  $O/milk_pail.webp  --height 128
p $R/pickup_wool_bale.png  $O/wool_bale.webp  --height 128
