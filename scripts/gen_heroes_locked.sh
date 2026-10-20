#!/usr/bin/env bash
# Regenera retratos de héroe anclados al estilo grimdark (anchor_soldier).
# Uso: bash gen_heroes_locked.sh <id1> <id2> ...
set -u
cd "/d/Proyectos/kingdoms-harvest" || exit 1
ANCHOR="art-inbox/anchors/anchor_soldier.png"
mkdir -p art-inbox/heroes
BUST="grimdark character bust portrait, head and shoulders, facing the viewer, dark atmospheric background, painterly pixel-art, single character, centered"

declare -A P
P[aria]="a weary veteran woman sergeant, cropped dark hair, a jaw scar, battered scavenged steel pauldrons, holding a chipped short combat blade, dim candlelit gloom"
P[thorin]="a hulking shield-bearer in thick riveted iron plate, a full slit-visor helm, dirty-gold trim, the edge of an immense tower shield"
P[lyra]="a gaunt young psyker acolyte in a grey hood, faint teal light leaking from her eyes, nervous"
P[zara]="a void witch in tattered black and violet robes, hollow eyes pouring teal warp-light, cracked floating shards, a bone circlet"
P[finn]="a wiry scout in a patchwork leather cloak, hood down, one scarred eye, a long battered rifle strapped over the shoulder"
P[elena]="a cold-eyed woman sniper in a dark hooded coat, a cheekbone scar, a single glowing scope-lens on a long rifle held upright"
P[viktor]="a young zealot guardian in a dented steel breastplate, a short dark cape, gripping the haft of a heavy maul, grim faith"
P[seraph]="a grim war-priest wearing a smooth featureless dark-iron faceplate with narrow eye-slits (NOT a skull, no skull shape), a plain heavy grey hooded robe over simple dark mail, holding a hanging brass lantern-censer on a chain with drifting incense smoke, candlelit gloom"
P[shadow]="a hooded infiltrator, dark cloth wraps covering the face, only sharp eyes visible, twin curved daggers crossed, shadow-wreathed"
P[vex]="a swift duelist in light dark-leather armor, a lower-face half-mask, twin short blades, a wind-blown cloak, smirking eyes"
P[varok]="a brutal champion in massive scarred plate, a bare snarling scarred face, blunt spiked pauldrons, a giant cleaver over the shoulder"
P[morghal]="a rotting plague warrior in corroded pitted plate, bloated cracked flesh, a sickly green pox-glow, a rusted axe, drifting flies"
P[azyra]="a blind void seer, eyes bound with cloth marked by glowing teal sigils, faint floating star-charts, a dark hooded robe"
P[fenn]="a feral scarred hunter in a grey wolf-pelt cloak, a bone-tooth necklace, a curved skinning knife, a snarl, cold fog"
P[kryx]="a tech-adept, half-mechanical face with one glowing red optic lens, a rust-red hood over exposed cabling and thin mechanical tendrils"
P[serafina]="a war-vestal in ornate pale plate with dark cloth, a ring of candlelight behind her, gripping a two-handed blade, serene fury"
P[gorr]="a hulking demolisher, crude bolted-on iron plates, a bare muscular scarred torso, a huge wrecking hammer on the shoulder, roaring"
P[nyx]="a legendary assassin woman in a sleek black bodysuit and half-cowl, glowing teal eye-slits, twin needle-blades, wisps of shadow"

for id in "$@"; do
  desc="${P[$id]:-}"
  if [ -z "$desc" ]; then echo "✗ sin prompt para $id"; continue; fi
  echo "=== $id ==="
  node scripts/gen_ai_art.js --prompt "$desc, ${BUST}" --aspect "1:1" \
    --out "art-inbox/heroes/${id}.png" --ref "$ANCHOR" \
    && node scripts/process_art.js "art-inbox/heroes/${id}.png" \
         "client/public/assets/game/heroes/${id}.png" --size 256 --tol 0 \
    && echo "✓ $id listo" || echo "✗ $id falló"
done
