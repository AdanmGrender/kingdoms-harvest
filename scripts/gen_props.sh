#!/usr/bin/env bash
# gen_props.sh — genera props grimdark de decoración con Nano Banana y los
# distribuye a los slots iso_env que usa el generador de mapa (DECOR_POOLS en
# client/src/game/maps/IsoMapGenerator.js), reemplazando los placeholders
# cuadrados. Todo arte ORIGINAL (prompts genéricos, sin marcas de terceros).
#
#   bash scripts/gen_props.sh
#
# Requiere GEMINI_API_KEY en server/.env. Ver docs/ai-art-pipeline.md.
set -e
cd "$(dirname "$0")/.."
ENVDIR="client/public/assets/kenney-medieval/PNG/Default size/Environment"
pad() { printf "%02d" "$1"; }

# prop → prompt
declare -A PROMPTS=(
  [dead_tree]="a single charred dead leafless tree, blackened twisted bare trunk and branches, ash at its base"
  [ruined_pillar]="a single broken crumbling stone pillar with rubble scattered at its base"
  [boulder]="a single dark jagged rock boulder with rust-colored and dried-blood stains"
  [wreckage]="a pile of twisted rusted metal wreckage and broken debris"
  [barricade]="a small defensive barricade of stacked sandbags and coiled barbed wire"
  [scrap_pile]="a heap of scrap metal, junk pipes and broken machine parts"
  [bones]="a small heap of bones and bleached skulls on cracked ground"
)
# prop → índices iso_env (DECOR_POOLS: TREE 9-12,17-19 · ROCK 7,14,20 · BUSH 2,4,13 · FLOWER 1,5)
declare -A MAP=(
  [dead_tree]="9 11 17"
  [ruined_pillar]="10 12 18 19"
  [boulder]="7 14 20"
  [wreckage]="2"
  [barricade]="4"
  [scrap_pile]="13"
  [bones]="1 5"
)

for name in dead_tree ruined_pillar boulder wreckage barricade scrap_pile bones; do
  echo "── $name ──"
  for attempt in 1 2 3 4; do
    out=$(node scripts/gen_ai_art.js --prompt "${PROMPTS[$name]}, single object centered on plain solid dark background, top isometric prop" --out "art-inbox/prop_$name.png" --aspect 1:1 2>&1)
    echo "$out" | grep -q "✓" && break
    echo "$out" | grep -q "503" && { sleep 18; continue; } || { echo "$out" | grep '✗'; break; }
  done
  node scripts/process_art.js "art-inbox/prop_$name.png" "/tmp/proc_$name.png" --size 72 >/dev/null
  for idx in ${MAP[$name]}; do
    cp "/tmp/proc_$name.png" "$ENVDIR/medievalEnvironment_$(pad $idx).png"
  done
done
echo "✓ props generados y distribuidos a los slots iso_env"
