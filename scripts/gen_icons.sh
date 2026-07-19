#!/usr/bin/env bash
# gen_icons.sh — genera el set de íconos UI grimdark (54 piezas) con Nano
# Banana a art-inbox/icon_<nombre>.png y arma el sheet final con
# scripts/assemble_icon_sheet.js → client/public/assets/sprites/grim_icons.png
# (+ client/src/config/grimIconSheet.generated.js).
#
#   bash scripts/gen_icons.sh               # los 54 + assemble
#   bash scripts/gen_icons.sh gold flame    # solo algunos + assemble
#
# Regla IP (docs/art-style.md): inspiración 40k pero diseño 100% ORIGINAL —
# nada de iconografía de Games Workshop. Requiere GEMINI_API_KEY en
# server/.env. Pipeline: docs/ai-art-pipeline.md.
set -e
cd "$(dirname "$0")/.."

NEG="game inventory icon, chunky readable silhouette, thick clear shapes, grimdark style, single subject centered on plain solid black background, no text, ORIGINAL design, NOT Warhammer, no Games Workshop marks, no double-headed eagles, no aquila, no chaos star, no purity seals, no chapter icons"

# nombre → prompt (el orden canónico del sheet vive en assemble_icon_sheet.js)
declare -A PROMPTS=(
  # ── recursos ──
  [gold]="a pile of dirty tarnished gold coins"
  [wood]="a stack of rough wooden planks"
  [stone]="a small pile of grey stone blocks"
  [iron]="a stack of dark iron ingots"
  [wheat]="a bundle of sickly grey-tinged wheat stalks tied with twine"
  [water]="a dented metal water jerrycan"
  [bread]="a coarse dark ration bread loaf"
  [kh_token]="a glowing teal hexagonal coin token with a faceted center"
  [crystal]="a jagged glowing teal crystal shard"
  [relic]="an ancient ornate golden relic casket"
  [blueprint]="a rolled blueprint schematic with pale blue technical lines"
  # ── cultivos / comida ──
  [carrot]="a withered drooping carrot with limp greens"
  [potato]="a few gnarled dirty potatoes"
  [tomato]="a dull bruised red tomato"
  [corn]="an ear of corn with pulled-back husk"
  [pumpkin]="a squat ribbed pumpkin"
  [grape]="a bunch of dark purple grapes"
  [egg]="three pale speckled eggs"
  [milk]="a dented metal jug of milk"
  [wool]="a ball of coarse grey wool yarn"
  # ── animales ──
  [chicken]="a scrawny thin chicken"
  [sheep]="a mud-caked shaggy sheep"
  [cow]="a bony gaunt cow"
  # ── edificios ──
  [castle]="a gothic bastion fortress keep"
  [farmhouse]="a run-down farm hovel with a patched roof"
  [market]="a market stall with a tattered awning"
  [tower]="a sentinel watchtower with a warning light"
  [barracks]="a barracks building with a hanging war banner"
  [tavern]="a grimy cantina with a glowing lantern"
  [mill]="an industrial mill with a smokestack"
  [wall]="a fortified stone wall segment with battlements"
  [trap]="a spiked land mine with a blinking light"
  [stable]="a beast stable with an iron-barred gate"
  [sawmill]="a circular saw blade rig on a workbench"
  [barn]="a reinforced storage depot barn"
  # ── militar ──
  [sword]="a heavy two-handed war sword"
  [bow]="a heavy mechanical crossbow"
  [spear]="a long war spear with a broad blade"
  [ram]="a battering ram with an iron head"
  [horse]="an armored war horse with plated barding"
  # ── UI / misc ──
  [crown]="a jagged iron crown"
  [scroll]="a worn parchment scroll with a wax seal"
  [medal]="a military medal on a striped ribbon"
  [backpack]="a worn leather backpack with buckles"
  [reward_bag]="a bulging loot sack tied with rope"
  [exclamation]="a hazard-striped alert sign with a bold exclamation mark"
  [gear]="a heavy iron gear cog"
  [caravan]="an armored supply wagon with riveted plating"
  [flame]="a burning orange flame"
  [wallet]="a worn leather coin pouch"
  [map]="a campaign map with route markers"
  [heart]="an armor-plated heart with rivets"
  [star]="a five-pointed merit star badge"
  [check]="a completed mission seal stamp with a bold checkmark"
  # ── tienda / premium (hoy emoji en la UI: 💎 ⭐ ⏩) ──
  [gem]="a single large faceted violet-purple gemstone with a bright inner glow and sharp cut facets"
  [star_currency]="a single bright golden five-pointed star coin, glowing, premium currency"
  [speedup]="a clock face fused with an iron gear, with bold motion speed-lines streaking off it to show time rushing forward"
  # ── enemigos de la Marea Disforme (WAVE_ENEMIES) como ícono chico ──
  [enemy_carroneros]="the head of a scrawny mangy scavenger vermin: rat-like carrion beast, patchy fur, long yellow fangs, red beady eyes, snarling"
  [enemy_brutos]="the head and shoulders of a deformed mutant hulk brute: bloated patchwork flesh, rusted iron staples, a lolling jawless head, sickly grey-green hide"
  [enemy_aullador]="a floating void horror head: a ball of writhing tentacles studded with many unblinking eyes and a puckered screaming maw, sickly teal glow"
  [enemy_coloso]="the head and shoulders of an ash-stone golem giant: cracked grey rock, a craggy featureless face, deep fissures glowing with orange embers, venting smoke"
  [enemy_boss_devorador]="a monstrous boss beast head: a ringed maw of many jagged fangs swallowing a streak of light, teal aura, armored plates"
  [enemy_boss_heraldo]="a boss herald head made of crackling electric static: a featureless white-hot head breaking apart into arcing lightning bolts and glitch bands"
  # ── campaña (mapa de operaciones; antes emoji 🌊 💀) ──
  [tide]="a towering dark tidal wave of murky corrupted water curling over, crest laced with sickly teal glow and foam"
  [skull]="a cracked ancient horned beast skull, hollow eye sockets with a faint ember glow"
)

# El orden canónico del sheet vive en assemble_icon_sheet.js (ICONS). Los
# nombres nuevos se AGREGAN AL FINAL para no mover col/row de los 54 viejos.
ORDER=(gold wood stone iron wheat water bread kh_token crystal relic blueprint
       carrot potato tomato corn pumpkin grape egg milk wool
       chicken sheep cow
       castle farmhouse market tower barracks tavern mill wall trap stable sawmill barn
       sword bow spear ram horse
       crown scroll medal backpack reward_bag exclamation gear caravan flame wallet
       map heart star check
       gem star_currency speedup
       enemy_carroneros enemy_brutos enemy_aullador enemy_coloso
       enemy_boss_devorador enemy_boss_heraldo
       tide skull)
LIST=("$@")
[ ${#LIST[@]} -eq 0 ] && LIST=("${ORDER[@]}")

for name in "${LIST[@]}"; do
  [ -n "${PROMPTS[$name]}" ] || { echo "✗ ícono desconocido: $name"; continue; }
  echo "── icon_$name ──"
  # 1 intento + máx 2 reintentos (sleep 18 si la API devuelve 503)
  for attempt in 1 2 3; do
    out=$(node scripts/gen_ai_art.js --prompt "${PROMPTS[$name]}, $NEG" --out "art-inbox/icon_$name.png" --aspect 1:1 2>&1)
    echo "$out" | grep -q "✓" && break
    echo "$out" | grep -q "503" && { sleep 18; continue; } || { echo "$out" | grep '✗'; break; }
  done
  [ -f "art-inbox/icon_$name.png" ] || echo "  ✗ $name: sin imagen generada (se omite)"
done

node scripts/assemble_icon_sheet.js
echo "✓ set de íconos grimdark generado y ensamblado"
