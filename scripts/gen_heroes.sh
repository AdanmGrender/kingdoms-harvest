#!/usr/bin/env bash
# gen_heroes.sh — genera los 18 retratos de héroes grimdark ORIGINALES con
# Nano Banana (busto/medio cuerpo) y los integra procesados (fondo
# transparente, 160px) en client/public/assets/game/heroes/<id>.png.
#
#   bash scripts/gen_heroes.sh              # los 18
#   bash scripts/gen_heroes.sh vex nyx      # solo algunos (regeneración)
#
# Regla IP (docs/art-style.md): inspiración 40k pero diseño 100% ORIGINAL —
# nada de águilas bicéfalas, aquila, estrella del caos, purity seals ni
# iconografía de Games Workshop. Requiere GEMINI_API_KEY en server/.env.
# Pipeline: docs/ai-art-pipeline.md.
set -e
cd "$(dirname "$0")/.."
HERODIR="client/public/assets/game/heroes"
mkdir -p "$HERODIR"

NEG="ORIGINAL design, NOT Warhammer, no Games Workshop marks, no double-headed eagles, no aquila, no chaos star, no purity seals, no chapter icons, no text, dramatic grimdark character bust portrait, head and torso only, single character centered on plain solid black background"

# id → prompt (héroes existentes + 8 nuevos; ver shared/gameConfig.js HEROES)
declare -A PROMPTS=(
  # ── héroes existentes ──
  [aria]="bust portrait of a hardened veteran sergeant woman, short cropped hair, weathered face with a thin scar, light crimson combat armor with a chest rig, rifle slung over her shoulder, stern commanding gaze"
  [thorin]="bust portrait of a stern warrior in heavy dark riveted plate armor, thick braided beard, gripping the rim of a battered steel shield, unyielding stance"
  [lyra]="bust portrait of a young psychic woman in a simple plain hooded robe, pale face, eyes glowing with a faint teal light, calm unsettling stare"
  [zara]="bust portrait of a void witch in layered tattered black robes, purple arcane energy crackling between her raised fingers, pale gaunt face, dark hollow eyes"
  [finn]="bust portrait of a wiry explorer scout in a hooded weathered cloak, holding a brass spyglass, satchel straps across the chest, keen alert eyes"
  [elena]="bust portrait of a cold-eyed sniper woman in a long weathered greatcoat, a long scoped rifle resting against her shoulder, gloved hands, focused distant gaze"
  [viktor]="bust portrait of a stalwart armored warden in heavy grey plate armor, gripping the top edge of a massive tower shield, disciplined stern face"
  [seraph]="bust portrait of a war chaplain in ornate engraved dark battle armor, holding a smoking incense censer on a chain, shaved head, grim zealous bare face"
  [shadow]="bust portrait of a female infiltrator in a tight black hood and face mask, only sharp eyes visible, throwing knives strapped across her chest harness"
  [vex]="bust portrait of a swift rogue man with twin curved daggers crossed before his chest, a ragged scarf around his neck, lean face with a cocky grin"
  # ── héroes nuevos (arquetipos propios) ──
  [varok]="bust portrait of a colossal super-soldier in massive bulky crimson powered armor, enormous SMOOTH unmarked shoulder plates with no emblems, full helmet with a glowing teal visor, armored gorget, towering presence"
  [morghal]="bust portrait of a bloated corrupted warrior in rusted corroded green-grey armor, toxic vapors leaking from cracked hoses and broken pipes on his back, festering seams, heavy rebreather grille, no insignia"
  [azyra]="bust portrait of a regal seer sorceress in flowing blue and gold robes, a tall ornate golden headdress, both eyes blazing with white arcane fire, holding an ornate scepter, no emblems"
  [fenn]="bust portrait of a feral berserker warrior with a grey wolf pelt draped over battered dark armor, a huge serrated axe over his shoulder, braided hair and beard, scarred snarling face, wolf-fang necklace"
  [kryx]="bust portrait of a cyborg tech-priest in dark red hooded robes, half of the face replaced with riveted metal plating, a glowing green optic lens eye, two extra skeletal mechanical arms rising behind the shoulders, dangling cables and tubes, no cog emblems"
  [serafina]="bust portrait of a battle vestal warrior woman in ornate black and silver power armor with lit wax candles mounted on the breastplate, a white cloth wimple headdress framing her face, solemn devoted expression, no fleur-de-lis, no wings"
  [gorr]="bust portrait of a gigantic mutant brute, grey mottled skin, crude iron plates riveted directly onto his shoulders and chest, massive jutting lower jaw with broken tusk teeth, tiny furious eyes, hulking hunched posture"
  [nyx]="bust portrait of a slender assassin in a segmented matte black bodysuit, a smooth featureless full-face mask, a thin long needle rifle across her back, silent poised posture"
)

ORDER=(aria thorin lyra zara finn elena viktor seraph shadow vex
       varok morghal azyra fenn kryx serafina gorr nyx)
LIST=("$@")
[ ${#LIST[@]} -eq 0 ] && LIST=("${ORDER[@]}")

for id in "${LIST[@]}"; do
  [ -n "${PROMPTS[$id]}" ] || { echo "✗ héroe desconocido: $id"; continue; }
  echo "── hero_$id ──"
  # 1 intento + máx 2 reintentos (sleep 18 si la API devuelve 503)
  for attempt in 1 2 3; do
    out=$(node scripts/gen_ai_art.js --prompt "${PROMPTS[$id]}, $NEG" --out "art-inbox/hero_$id.png" --aspect 1:1 2>&1)
    echo "$out" | grep -q "✓" && break
    echo "$out" | grep -q "503" && { sleep 18; continue; } || { echo "$out" | grep '✗'; break; }
  done
  if [ -f "art-inbox/hero_$id.png" ]; then
    node scripts/process_art.js "art-inbox/hero_$id.png" "$HERODIR/$id.png" --size 160 --tol 70 \
      || { echo "  ✗ $id: process_art falló"; continue; }
    echo "  → $HERODIR/$id.png"
  else
    echo "  ✗ $id: sin imagen generada (se omite)"
  fi
done
echo "✓ retratos de héroes listos en $HERODIR"
