#!/usr/bin/env bash
# gen_chars.sh — genera los 7 NPCs grimdark ORIGINALES con Nano Banana y los
# arma como spritesheets npc_<rol> (frame 32×48, 4 frames) que carga BootScene.
# Reemplaza los placeholders (rectángulos de color) por personajes reales.
#
#   bash scripts/gen_chars.sh
#
# Diseños 100% propios: nada de Space Marines, hombreras enormes, calaveras,
# águilas ni estrella del caos (regla IP docs/art-style.md). Requiere
# GEMINI_API_KEY en server/.env. Ver docs/ai-art-pipeline.md.
set -e
cd "$(dirname "$0")/.."
CHARDIR="client/public/assets/game/characters"
mkdir -p "$CHARDIR"

NEG="ORIGINAL grimdark game character, NOT a space marine, NO large shoulder pauldrons, NO skull icons, NO wings, NO eagles, NO chaos star, full-body single character sprite, front three-quarter view, centered on plain solid black background"

# rol → prompt
declare -A PROMPTS=(
  [farmer]="a gaunt field-serf in a mud-stained hooded burlap smock and cracked leather apron, holding a rusty scythe, weary hunched stance"
  [baker]="a grimy provisioner in a soot-stained apron over a rough tunic, a cloth wrap over the mouth, holding a long iron bread-paddle, dusted with flour"
  [princess]="a pale gothic noble scion in a dark tattered high-collared royal gown, a thin iron circlet and black lace veil, holding a single dead rose, sorrowful regal stance"
  [wizard]="a robed tech-mystic in a deep hood and layers of dark rune-etched cloth, holding a crooked staff topped with a glowing teal crystal, hanging vials and cabling"
  [knight]="a heavy armored sentinel in dark riveted plate armor and a full helm with a narrow visor slit, a long tattered crimson tabard, gripping a heavy two-handed war-blade point-down, stoic guard stance"
  [merchant]="a hooded traveling trader in a heavy layered cloak with a big backpack of wares and hanging trinkets, holding a dim lantern, hunched wary posture"
  [ranger]="a lean scout in a hooded cloak and light leather armor, a scarf over the face, holding a long rifle, a quiver and pouches, alert crouching stance"
)

for role in farmer baker princess wizard knight merchant ranger; do
  echo "── npc_$role ──"
  for attempt in 1 2 3 4; do
    out=$(node scripts/gen_ai_art.js --prompt "${PROMPTS[$role]}, $NEG" --out "art-inbox/char_$role.png" --aspect 1:1 2>&1)
    echo "$out" | grep -q "✓" && break
    echo "$out" | grep -q "503" && { sleep 18; continue; } || { echo "$out" | grep '✗'; break; }
  done
  node scripts/process_art.js "art-inbox/char_$role.png" "/tmp/char_${role}_proc.png" --size 96 --tol 70 >/dev/null
  node scripts/make_char_sheet.js "/tmp/char_${role}_proc.png" "$CHARDIR/npc_$role.png" --fw 32 --fh 48 --frames 4 >/dev/null
  echo "  → $CHARDIR/npc_$role.png"
done
echo "✓ 7 NPCs grimdark generados y armados como npc_<rol>"
