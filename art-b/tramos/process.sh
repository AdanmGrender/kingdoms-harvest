#!/usr/bin/env bash
# Tramos de nivel del hub (feature hub_b_tramos_nivel): art-b/tramos/raw → client/public/assets/b/buildings (correr desde la raíz).
# Generar antes: node scripts/gen_art_b.js --manifest art-b/tramos/manifest.json [--only tier_barn_medio,...]   (requiere GEMINI_API_KEY)
# --height = el mismo del bajo (art-b/hub/process.sh) para que aspecto y pie coincidan (R14, R15). Sin --crop: un edificio por imagen.
#   NODE="/c/Program Files/nodejs/node.exe" bash art-b/tramos/process.sh [id1 id2 ...]   (sin args = los 17)
set -e
N="${NODE:-node}"; R=art-b/tramos/raw; B=client/public/assets/b/buildings
p() { "$N" scripts/process_art_b.js "$@" </dev/null; }
declare -A H=([throne_room]=608 [mine]=256 [library]=448 [embassy]=416 [tower]=288 [wall]=208 [barracks]=240 [tavern]=320 [market]=256 [smithy]=304 [mill]=368 [house]=208 [barn]=224 [sawmill]=304 [stable]=272 [farm_plot]=240 [trap]=160)
IDS=("$@"); [ ${#IDS[@]} -eq 0 ] && IDS=("${!H[@]}")
for id in "${IDS[@]}"; do
  for v in medio alto obra; do
    if [ -f "$R/tier_${id}_${v}.png" ]; then
      p "$R/tier_${id}_${v}.png" "$B/${id}_${v}.webp" --min-hole 0.00001 --height "${H[$id]}"
    fi
  done
done
