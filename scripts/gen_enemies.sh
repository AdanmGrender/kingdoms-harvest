#!/usr/bin/env bash
# gen_enemies.sh — retratos/sprites de los enemigos de la Marea Disforme
# (shared/gameConfig.js → WAVE_ENEMIES, hoy dibujados con emoji) hacia
# client/public/assets/game/enemies/<id>.png (96px, fondo transparente).
#
#   bash scripts/gen_enemies.sh                 # los 6
#   bash scripts/gen_enemies.sh aullador coloso # solo algunos
#
# Los ids DEBEN coincidir con WAVE_ENEMIES: carroneros, brutos, aullador,
# coloso, boss_devorador, boss_heraldo. Este script NO toca gameConfig.js.
#
# Regla IP (docs/art-style.md): grimdark 40k-INSPIRADO pero 100% ORIGINAL.
# Requiere GEMINI_API_KEY en server/.env. Pipeline: docs/ai-art-pipeline.md.
set -e
cd "$(dirname "$0")/.."
OUTDIR="client/public/assets/game/enemies"
mkdir -p "$OUTDIR"

# El modelo tiende a plantar a las criaturas sobre una peana/plataforma iso: se
# niega explícitamente (igual que en gen_walks.sh) o el recorte a 96px se come
# medio sprite con el pedestal.
FRAME="a single monster creature centered in frame, full body, facing the viewer, menacing pose, dramatic rim lighting, painted grimdark game art, chunky readable silhouette that reads clearly when shrunk to a small icon, on a plain solid pure black background with nothing else. The creature stands directly on the plain background — NO stone base, NO pedestal, NO platform, NO diorama, NO ground tile under its feet"
NEG="ORIGINAL creature design, NOT Warhammer, no Games Workshop marks, not a tyranid, not an ork, not a space marine, no double-headed eagles, no aquila, no chaos star, no purity seals, no chapter icons, no text, no letters, no watermark, no logo, no border, no frame"

declare -A DESC=(
  [carroneros]="a seething swarm pack of scrawny scavenger vermin: rat-like carrion beasts with mangy patchy fur, exposed ribs, long yellow fangs, red beady eyes and whip-like tails, several of them clumped together into one snarling mass, filthy grey-brown"
  [brutos]="a deformed mutant hulk brute: a towering slab of stitched patchwork flesh, mismatched uneven arms (one bloated and huge, one withered), rusted iron staples and chains sunk into its skin, a lolling jawless head, sickly grey-green (#5a7a35) hide streaked with dried blood"
  [aullador]="a floating void horror: a levitating mass of writhing tentacles studded with dozens of unblinking eyes of all sizes, a puckered screaming maw, wreathed in a sickly glowing teal (#4fd8c8) aura and drifting wisps, no legs, hovering"
  [coloso]="a colossal ash golem: a hulking cracked giant built from fused grey stone and compacted ash, a craggy featureless head, deep fissures across its body glowing with orange (#e8933a) embers and smoke venting from the cracks, massive slab fists"
  [boss_devorador]="a colossal apocalyptic behemoth BOSS, far bigger and more imposing than any other creature: a mountainous armored beast whose body splits open into MULTIPLE ringed fanged maws that are visibly swallowing streaks of light, the light bending and draining into its jaws, a menacing teal (#4fd8c8) aura, immense and terrifying"
  [boss_heraldo]="a towering gaunt BOSS herald of static: a tall slender humanoid figure made entirely of crackling electric energy and television static, its silhouette breaking apart into arcing lightning bolts and glitching bands, a featureless white-hot head, a storm of sparks and dark clouds around it, imposing"
)

ORDER=(carroneros brutos aullador coloso boss_devorador boss_heraldo)
LIST=("$@")
[ ${#LIST[@]} -eq 0 ] && LIST=("${ORDER[@]}")

for id in "${LIST[@]}"; do
  [ -n "${DESC[$id]}" ] || { echo "✗ enemigo desconocido: $id"; continue; }
  echo "── enemy_$id ──"
  # Reintenta en 503 (sobrecarga) y cuando el modelo contesta texto en vez de
  # imagen — ambos transitorios. Errores reales (cuota, key) cortan al toque.
  for attempt in 1 2 3; do
    res=$(node scripts/gen_ai_art.js --prompt "$FRAME. The creature: ${DESC[$id]}. $NEG" --out "art-inbox/enemy_$id.png" --aspect 1:1 2>&1)
    echo "$res" | grep -q "✓" && break
    echo "$res" | grep -qE "503|no devolvió imagen" && { echo "  ↻ reintento $attempt"; sleep 18; continue; }
    echo "$res" | grep '✗'; break
  done
  if [ -f "art-inbox/enemy_$id.png" ]; then
    node scripts/process_art.js "art-inbox/enemy_$id.png" "$OUTDIR/$id.png" --size 96 --tol 70
  else
    echo "  ✗ $id: sin imagen generada (se omite)"
  fi
done
echo "✓ enemigos de la Marea Disforme en $OUTDIR/"
