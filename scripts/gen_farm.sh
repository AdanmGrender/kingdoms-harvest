#!/usr/bin/env bash
# gen_farm.sh — genera el arte de la GRANJA (el corazón del juego) y arma
# client/public/assets/game/tilesets/farm_tiles.png (spritesheet 32×32, 8 col).
#
# Estrategia: UNA generación por cultivo con las 4 etapas en una grilla 2×2
# (misma imagen → coherencia de diseño/paleta entre etapas, igual que
# gen_walks.sh), + 2 generaciones para la tierra seca/regada. Después
# scripts/assemble_farm_tiles.js corta y arma la grilla de 8 columnas.
#
#   bash scripts/gen_farm.sh              # tierra + los 7 cultivos + assemble
#   bash scripts/gen_farm.sh wheat grape  # solo algunos + assemble
#   bash scripts/gen_farm.sh soil         # solo las 2 tierras + assemble
#
# Layout EXIGIDO por client/src/game/entities/CropPlot.js (no cambiar):
#   0=tierra seca 1=tierra regada, luego 4 etapas por cultivo en el orden
#   wheat carrot potato tomato corn pumpkin grape.
#
# Regla IP (docs/art-style.md): grimdark 40k-INSPIRADO pero 100% ORIGINAL.
# Requiere GEMINI_API_KEY en server/.env. Pipeline: docs/ai-art-pipeline.md.
set -e
cd "$(dirname "$0")/.."

NEG="ORIGINAL grimdark design, NOT Warhammer, no Games Workshop marks, no double-headed eagles, no aquila, no chaos star, no purity seals, no chapter icons, no text, no letters, no numbers, no labels, no watermark, no border, no frame"

# Vista y encuadre comunes: tile de terreno visto CENITALMENTE, a sangre.
VIEW="top-down overhead view straight from above (bird's eye, 90 degrees), the soil fills the entire frame edge to edge with no margin, no horizon, no sky, no background scenery"
SOIL="dark ploughed grimdark farmland soil, straight furrow rows, ash-grey brown earth (#4a443e stone-grey, #332f2b dark earth), scattered small stones, grit and dead roots, gritty painted texture"

# Grilla 2×2: 4 etapas del MISMO cultivo, orden de lectura.
GRID="a 2x2 grid of exactly 4 square farm tiles showing the growth stages of ONE crop, reading order: TOP-LEFT = a single tiny freshly planted sprout barely poking out of the soil, TOP-RIGHT = a small young plant, BOTTOM-LEFT = a medium half-grown plant, BOTTOM-RIGHT = the fully grown plant READY TO HARVEST (biggest, most colorful, heavy with ripe produce, filling most of its tile). In EVERY tile the plant is CENTERED in the middle of its own tile. The SAME $SOIL fills every tile as background. Flat even lighting, no vignette, no dark corners. All 4 tiles packed tightly edge to edge, no gaps, no separator lines, no borders, no captions. $VIEW"

declare -A CROPS=(
  [wheat]="'Synth-Grain': gaunt pale grey-gold wheat stalks with drooping bearded heads, thin and sickly"
  [carrot]="'Blight-Root': mutated carrots, rust-orange roots pushing out of the dirt with dark feathery fern tops"
  [potato]="'Ash-Tuber': lumpy pale grey potato tubers with dull olive-green leafy bushes"
  [tomato]="'Blood-Fruit': deep blood-red (#b32821) bulbous swollen fruit on dark veined vines"
  [corn]="'Iron-Maize': tall stiff stalks with dull metallic amber-yellow cobs and grey-green blades"
  [pumpkin]="'Void-Gourd': a huge bulbous ribbed gourd, burnt orange (#e8933a) with black ribs, on a sprawling coarse vine"
  [grape]="'Warp-Vine': heavy clusters of dark violet-purple grapes with a faint sickly teal (#4fd8c8) glow, on gnarled twisted vines"
)

ORDER=(wheat carrot potato tomato corn pumpkin grape)
LIST=("$@")
[ ${#LIST[@]} -eq 0 ] && LIST=(soil "${ORDER[@]}")

# gen <nombre-archivo> <prompt>
gen() {
  local out="art-inbox/$1.png"; shift
  local prompt="$1"
  # 1 intento + 2 reintentos. Reintenta si la API dio 503 (sobrecarga) o si no
  # devolvió imagen (el modelo a veces contesta texto) — ambos son transitorios.
  for attempt in 1 2 3; do
    res=$(node scripts/gen_ai_art.js --prompt "$prompt, $NEG" --out "$out" --aspect 1:1 2>&1)
    echo "$res" | grep -q "✓" && return 0
    echo "$res" | grep -qE "503|no devolvió imagen" && { echo "  ↻ reintento $attempt"; sleep 18; continue; }
    echo "$res" | grep '✗'; return 1
  done
  echo "  ✗ $out: la API no devolvió imagen tras 3 intentos"
  return 1
}

for item in "${LIST[@]}"; do
  case "$item" in
    soil)
      echo "── tierra seca (frame 0) ──"
      gen farm_soil_dry "a single square tile of DRY CRACKED empty farmland: $SOIL, dusty and cracked with hairline fissures, NO plants at all, completely bare earth. $VIEW" || true
      echo "── tierra regada (frame 1) ──"
      gen farm_soil_wet "a single square tile of FRESHLY WATERED empty farmland: $SOIL but soaked dark and damp, wet muddy sheen, small puddles in the furrows, NO plants at all, completely bare earth. $VIEW" || true
      ;;
    *)
      [ -n "${CROPS[$item]}" ] || { echo "✗ cultivo desconocido: $item"; continue; }
      echo "── $item (4 etapas) ──"
      gen "farm_$item" "$GRID The crop is ${CROPS[$item]}." || true
      ;;
  esac
done

node scripts/assemble_farm_tiles.js
echo "✓ farm_tiles.png armado"
