#!/usr/bin/env bash
# gen_walks.sh — genera para cada NPC una TIRA de 4 poses del MISMO personaje
# (una sola generación → diseño consistente, vence la maldición del "cambia de
# cara") y la arma como spritesheet de caminar npc_<rol> (32×48, 4 frames).
# Reemplaza los sprites estáticos por unos con ciclo de caminado real.
#
#   bash scripts/gen_walks.sh          # los 7
#   bash scripts/gen_walks.sh ranger   # uno solo
#
# Requiere GEMINI_API_KEY en server/.env. Ver docs/ai-art-pipeline.md.
set -e
cd "$(dirname "$0")/.."
CHARDIR="client/public/assets/game/characters"

SHEET="a video game character WALK-CYCLE sprite sheet: the SAME single character repeated in a horizontal row of exactly 4 evenly-spaced frames, side profile facing right, each frame a different mid-stride walk pose (legs contact, passing, contact, passing), IDENTICAL character design and IDENTICAL size in every frame. The feet rest DIRECTLY on the flat plain background — NO stone base, NO pedestal, NO platform, NO tile under the feet. Clear even gaps between the 4 frames, plain solid pure black background everywhere."
NEG="ORIGINAL grimdark design, NOT a space marine, no shoulder pauldrons, no skulls, no eagles, no chaos star"

declare -A DESC=(
  [farmer]="a gaunt field-serf in a mud-stained hooded burlap smock and cracked leather apron, carrying a rusty scythe over the shoulder"
  [baker]="a grimy provisioner in a soot-stained apron over a rough tunic, a cloth wrap over the mouth, carrying a long iron bread-paddle"
  [princess]="a pale gothic noble scion in a dark tattered high-collared long royal gown, a thin iron circlet and black lace veil, walking with a mournful gait"
  [wizard]="a robed tech-mystic in a deep hood and layers of dark rune-etched cloth, leaning on a crooked staff topped with a glowing teal crystal"
  [knight]="a heavy armored sentinel in dark riveted plate armor and a full helm with a narrow visor slit, a long tattered crimson tabard, carrying a heavy war-blade"
  [merchant]="a hooded traveling trader in a heavy layered cloak with a big backpack of wares and hanging trinkets, carrying a dim lantern"
  [ranger]="a lean scout in a hooded cloak and light leather armor, a scarf over the face, holding a long rifle, a quiver and pouches"
)

ROLES="${*:-farmer baker princess wizard knight merchant ranger}"
for role in $ROLES; do
  echo "── walk npc_$role ──"
  for attempt in 1 2 3 4; do
    out=$(node scripts/gen_ai_art.js --prompt "$SHEET Character: ${DESC[$role]}. $NEG" --out "art-inbox/walk_$role.png" --aspect 16:9 2>&1)
    echo "$out" | grep -q "✓" && break
    echo "$out" | grep -q "503" && { sleep 18; continue; } || { echo "$out" | grep '✗'; break; }
  done
  node scripts/assemble_walk.js "art-inbox/walk_$role.png" "$CHARDIR/npc_$role.png" --slices 4 --fw 32 --fh 48 --tol 45 --bottom 1 >/dev/null
  echo "  → $CHARDIR/npc_$role.png"
done
echo "✓ walk cycles armados para: $ROLES"
