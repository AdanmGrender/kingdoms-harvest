#!/usr/bin/env bash
# gen_zones.sh — genera las ANCLAS DE TERRENO por bioma (técnica de generación
# por zonas) con Nano Banana y las coloca en los slots que carga BootScene
# (zone_<familia>_<n>). El piso del mundo top-down se compone anclando a cada
# zona una de estas imágenes según su bioma dominante (systems/ZoneAnchors.js).
#
#   bash scripts/gen_zones.sh
#
# Arte ORIGINAL (prompts genéricos, sin marcas de terceros). Full-bleed →
# downscale a 512px, sin quitar fondo. Requiere GEMINI_API_KEY en server/.env.
set -e
cd "$(dirname "$0")/.."
OUTDIR="client/public/assets/game/zones"
mkdir -p "$OUTDIR"

# Forzamos vista cenital plana (el STYLE maestro tira a "isométrico/fortaleza";
# lo peleamos con lenguaje específico de textura de piso sin objetos).
FLAT="flat overhead top-down orthographic ground texture, seamless, fills the entire frame edge to edge, NOT isometric, NO buildings, NO structures, NO horizon, NO characters, just the ground surface"

# slot → prompt
declare -A PROMPTS=(
  [grass_0]="blighted toxic wasteland floor: dead grey-green withered grass over cracked black soil, patches of glowing toxic green sludge, scattered ash and rot"
  [grass_1]="rotting mire floor: dark decaying vegetation and moss, mud, puddles of oily green water, scattered bone fragments and dead roots"
  [dirt_0]="cracked ash wasteland floor: dry grey-brown cracked earth, small rubble and pebbles, rust-colored dust drifts"
  [dirt_1]="scorched battlefield dirt floor: burnt black soil, shallow craters, dried dark blood stains, bits of rusted scrap debris"
  [sand_0]="irradiated dust flats floor: pale bleached sand and grit, faint rust patches, wind-blown ash ripples"
  [snow_0]="ash-fouled frozen ground floor: dirty grey snow over frozen mud, black soot streaks, thin ice cracks"
  [ice_0]="cracked black ice floor: dark frozen sheet with jagged pale fracture lines and frozen grit"
)

for slot in grass_0 grass_1 dirt_0 dirt_1 sand_0 snow_0 ice_0; do
  echo "── zone_$slot ──"
  for attempt in 1 2 3 4; do
    out=$(node scripts/gen_ai_art.js --prompt "${PROMPTS[$slot]}, $FLAT" --out "art-inbox/zone_$slot.png" --aspect 1:1 2>&1)
    echo "$out" | grep -q "✓" && break
    echo "$out" | grep -q "503" && { sleep 18; continue; } || { echo "$out" | grep '✗'; break; }
  done
  node scripts/downscale.js "art-inbox/zone_$slot.png" "$OUTDIR/zone_$slot.png" --width 512 >/dev/null
  echo "  → $OUTDIR/zone_$slot.png"
done

# Ancla ÚNICA del hub (WorldScene.buildHubAnchor): una sola imagen 3:2 a 1024px
# que cubre el viewport fijo del Bastión y tapa la cruz entre 4 zonas.
echo "── zone_hub ──"
node scripts/gen_ai_art.js --prompt "flat overhead top-down orthographic ground texture, seamless, fills the entire frame edge to edge, NOT isometric, NO buildings, NO structures, NO horizon, NO characters, just the ground surface: bastion courtyard grounds in a grimdark wasteland — center is hard-packed dark trampled earth with faint worn flagstones and cart ruts, edges transition to cracked ash soil with sparse rubble, scattered soot stains and faint ember specks, muted desaturated palette" --out "art-inbox/zone_hub.png" --aspect 3:2
node scripts/downscale.js "art-inbox/zone_hub.png" "$OUTDIR/zone_hub.png" --width 1024 >/dev/null
echo "  → $OUTDIR/zone_hub.png"
echo "✓ anclas de terreno generadas en $OUTDIR"
