#!/usr/bin/env bash
# gen_structs.sh — genera estructuras grimdark del mundo con Nano Banana y las
# distribuye a los slots iso_struct que usa el generador (STRUCT_POOLS en
# client/src/game/maps/IsoMapGenerator.js), reemplazando los placeholders.
# Arte ORIGINAL (prompts genéricos, sin marcas de terceros).
#
#   bash scripts/gen_structs.sh   (requiere GEMINI_API_KEY en server/.env)
set -e
cd "$(dirname "$0")/.."
DIR="client/public/assets/kenney-medieval/PNG/Default size/Structure"
pad() { printf "%02d" "$1"; }

declare -A PROMPTS=(
  [vent_tower]="a ruined industrial vent tower with a broken rotor and rusted smokestacks venting faint smoke"
  [sentry_tower]="a broken stone sentry watchtower, cracked and leaning, with a dead searchlight and blood stains"
  [ruined_shrine]="a ruined gothic shrine building with a collapsed spire and broken arched stained-glass windows"
  [rubble_a]="a collapsed stone building reduced to rubble, broken walls and scattered debris"
  [rubble_b]="a heap of shattered masonry with a single standing broken stone archway"
  [habblock_a]="an abandoned gothic hab-block tenement, boarded windows, partly collapsed roof"
  [habblock_b]="a derelict multi-story dwelling with a caved-in roof and rusted balconies"
  [bunker]="a wrecked reinforced storage bunker with a blast-scarred armored door"
)
# STRUCT_POOLS: WINDMILL 11,12 · WATCHTOWER 5,13 · CHURCH 14,15 · RUINS 8,18,19 · HOUSE 1,3,4,6,7 · BARN 2,10
declare -A MAP=(
  [vent_tower]="11 12"
  [sentry_tower]="5 13"
  [ruined_shrine]="14 15"
  [rubble_a]="8 18"
  [rubble_b]="19"
  [habblock_a]="1 3 6"
  [habblock_b]="4 7"
  [bunker]="2 10"
)

for name in vent_tower sentry_tower ruined_shrine rubble_a rubble_b habblock_a habblock_b bunker; do
  echo "── $name ──"
  for attempt in 1 2 3 4; do
    out=$(node scripts/gen_ai_art.js --prompt "${PROMPTS[$name]}, single structure centered on plain solid dark background, top isometric" --out "art-inbox/struct_$name.png" --aspect 1:1 2>&1)
    echo "$out" | grep -q "✓" && break
    echo "$out" | grep -q "503" && { sleep 18; continue; } || { echo "$out" | grep '✗'; break; }
  done
  node scripts/process_art.js "art-inbox/struct_$name.png" "/tmp/st_$name.png" --size 96 >/dev/null
  for idx in ${MAP[$name]}; do
    cp "/tmp/st_$name.png" "$DIR/medievalStructure_$(pad $idx).png"
  done
done
echo "✓ estructuras generadas y distribuidas a los slots iso_struct"
