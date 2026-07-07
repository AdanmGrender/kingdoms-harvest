#!/usr/bin/env bash
# gen_animals.sh — genera las 3 bestias de granja grimdark ORIGINALES con Nano
# Banana y las arma como spritesheets 32×32 (4 frames: idle 0-1, walk 2-3) que
# carga BootScene. Reemplaza los placeholders (cuadraditos de 193 bytes).
#
#   bash scripts/gen_animals.sh
#
# Requiere GEMINI_API_KEY en server/.env. Ver docs/ai-art-pipeline.md.
set -e
cd "$(dirname "$0")/.."
ANIMDIR="client/public/assets/game/animals"
mkdir -p "$ANIMDIR"

NEG="ORIGINAL small livestock creature, single animal centered on plain solid black background, 3/4 side view, no text, no watermark"

declare -A PROMPTS=(
  [chicken]="a scrawny grim farm hen with dark ragged feathers and a blood-red comb, mangy, beady red eye"
  [cow]="a gaunt bony farm cow with mangy dark hide and dull crooked horns, ribs showing, weary heavy beast"
  [sheep]="a matted farm sheep with dirty grey-black wool clumped with mud, tired, stocky"
)

for animal in chicken cow sheep; do
  echo "── $animal ──"
  for attempt in 1 2 3 4; do
    out=$(node scripts/gen_ai_art.js --prompt "${PROMPTS[$animal]}, $NEG" --out "art-inbox/animal_$animal.png" --aspect 1:1 2>&1)
    echo "$out" | grep -q "✓" && break
    echo "$out" | grep -q "503" && { sleep 18; continue; } || { echo "$out" | grep '✗'; break; }
  done
  node scripts/process_art.js "art-inbox/animal_$animal.png" "/tmp/animal_${animal}_proc.png" --size 64 --tol 70 >/dev/null
  node scripts/make_char_sheet.js "/tmp/animal_${animal}_proc.png" "$ANIMDIR/$animal.png" --fw 32 --fh 32 --frames 4 --bottom 1 >/dev/null
  echo "  → $ANIMDIR/$animal.png"
done
echo "✓ 3 bestias grimdark generadas y armadas 32×32"
