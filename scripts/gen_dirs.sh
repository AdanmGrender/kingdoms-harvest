#!/usr/bin/env bash
# gen_dirs.sh — convierte cada NPC en un sheet DIRECCIONAL (4×3: down/up/side).
# Para cada rol genera 2 tiras nuevas (DOWN=frente, UP=espalda) y reutiliza la
# tira SIDE (perfil) que ya dejó gen_walks.sh (art-inbox/walk_<rol>.png). Luego
# assemble_dirs.js las apila con escala compartida en characters/npc_<rol>.png.
#
#   bash scripts/gen_dirs.sh                 # todos menos ranger (ya hecho)
#   bash scripts/gen_dirs.sh knight          # uno
#
# La descripción idéntica en las 3 direcciones mantiene el mismo diseño.
# Requiere GEMINI_API_KEY en server/.env. Ver docs/ai-art-pipeline.md.
set -e
cd "$(dirname "$0")/.."
CHARDIR="client/public/assets/game/characters"

FRONT="a video game character WALK-CYCLE sprite sheet: the SAME single character in a horizontal row of exactly 4 evenly-spaced frames, seen from the FRONT facing DOWN toward the viewer (front of the body and face area visible), each frame a different walk step with legs alternating, IDENTICAL design and size, feet directly on the flat background with NO pedestal or platform, clear even gaps, plain solid pure black background."
BACK="a video game character WALK-CYCLE sprite sheet: the SAME single character in a horizontal row of exactly 4 evenly-spaced frames, seen from BEHIND facing UP and away from the viewer (back of the head/hood and back visible, no face), each frame a different walk step with legs alternating, IDENTICAL design and size, feet directly on the flat background with NO pedestal or platform, clear even gaps, plain solid pure black background."
NEG="ORIGINAL grimdark design, NOT a space marine, no shoulder pauldrons, no skulls, no eagles, no chaos star"

declare -A DESC=(
  [farmer]="a gaunt field-serf in a mud-stained hooded burlap smock and cracked leather apron, carrying a rusty scythe"
  [baker]="a grimy provisioner in a soot-stained apron over a rough tunic, a cloth wrap over the mouth, carrying a long iron bread-paddle"
  [princess]="a pale gothic noble scion in a dark tattered high-collared long royal gown, a thin iron circlet and black lace veil"
  [wizard]="a robed tech-mystic in a deep hood and layers of dark rune-etched cloth, a crooked staff topped with a glowing teal crystal"
  [knight]="a heavy armored sentinel in dark riveted plate armor and a full helm, a long tattered crimson tabard, a heavy war-blade"
  [merchant]="a hooded traveling trader in a heavy layered cloak with a big backpack of wares, carrying a dim lantern"
  [ranger]="a lean scout in a hooded cloak and light leather armor, a scarf over the face, holding a long rifle, a quiver and pouches"
)

gen() { # $1 prompt  $2 out
  for attempt in 1 2 3 4; do
    out=$(node scripts/gen_ai_art.js --prompt "$1" --out "$2" --aspect 16:9 2>&1)
    echo "$out" | grep -q "✓" && return 0
    echo "$out" | grep -q "503" && { sleep 18; continue; } || { echo "$out" | grep '✗'; return 0; }
  done
}

ROLES="${*:-farmer baker princess wizard knight merchant}"
for role in $ROLES; do
  echo "── dirs npc_$role ──"
  gen "$FRONT Character: ${DESC[$role]}. $NEG" "art-inbox/dir_${role}_down.png"
  gen "$BACK Character: ${DESC[$role]}. $NEG"  "art-inbox/dir_${role}_up.png"
  SIDE="art-inbox/walk_$role.png"
  [ -f "$SIDE" ] || SIDE="art-inbox/walk_${role}_strip.png"
  node scripts/assemble_dirs.js "$CHARDIR/npc_$role.png" \
    --down "art-inbox/dir_${role}_down.png" --up "art-inbox/dir_${role}_up.png" --side "$SIDE" \
    --slices 4 --fw 32 --fh 48 --tol 45 --bottom 1 >/dev/null
  echo "  → $CHARDIR/npc_$role.png (4×3 direccional)"
done
echo "✓ sheets direccionales para: $ROLES"
