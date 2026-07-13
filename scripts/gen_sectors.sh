#!/usr/bin/env bash
# gen_sectors.sh — arte de SECTORES / ESCENARIOS del meta-juego (hoy CSS+emoji):
#   fondos full-bleed (16:9)  → client/public/assets/game/ambient/
#     system_bg.png  mapa estelar del sistema
#     galaxy_bg.png  vista de galaxia con tormenta disforme
#     wave_bg.png    telón de la defensa por oleadas (Marea Disforme)
#   planetas (sujeto único, 128px) → client/public/assets/game/planets/
#     planet_1..4.png  ceniza / forja / tóxico / helado muerto
#
#   bash scripts/gen_sectors.sh              # todo
#   bash scripts/gen_sectors.sh wave_bg      # una pieza
#
# Los fondos van por downscale.js (arte a sangre: NO se les quita el fondo).
# Los planetas van por process_art.js (fondo negro → transparente + recorte).
#
# Regla IP (docs/art-style.md): grimdark 40k-INSPIRADO pero 100% ORIGINAL.
# Requiere GEMINI_API_KEY en server/.env. Pipeline: docs/ai-art-pipeline.md.
set -e
cd "$(dirname "$0")/.."
AMB="client/public/assets/game/ambient"
PLA="client/public/assets/game/planets"
mkdir -p "$AMB" "$PLA"

NEG="ORIGINAL design, NOT Warhammer, no Games Workshop marks, no double-headed eagles, no aquila, no chaos star, no purity seals, no chapter icons, no text, no letters, no numbers, no labels, no watermark, no logo, no UI, no border, no frame"
BG_NEG="painted matte background art for a game screen, wide panoramic, atmospheric, no characters in the foreground, $NEG"
# Misma pelea que SPACE_NEG: sin esto el STYLE ("gothic industrial fortress")
# devuelve un pedazo de terreno iso con un castillo, no un planeta.
PL_NEG="This is an ASTRONOMY view from deep space: ONE complete round PLANET SPHERE — a perfect ball — floating alone, centered, the whole globe fitting inside the frame as a circle, seen from far orbit. Its features are ONLY fine surface texture painted on the curved sphere. NOT a building, NOT a fortress, NOT a castle, NO isometric architecture, NO towers, NO structures standing on it, NO diorama, NO chunk of terrain, NO landscape. Dramatic side lighting with a dark crescent terminator shadow, painted grimdark game art, readable as a small icon, on a plain solid pure black background with nothing else, no stars, no orbit rings, $NEG"

# ⚠️ El bloque STYLE de gen_ai_art.js dice "dark gothic industrial FORTRESS
# style" y le mete una fortaleza iso gigante a CUALQUIER prompt. Las dos vistas
# espaciales tienen que pelearlo explícitamente (misma táctica que el preset
# `sky`), o salen con un castillo flotando en el vacío. wave_bg SÍ quiere
# arquitectura, así que no lleva la negativa.
SPACE_NEG="This is a pure ASTRONOMY view of empty outer space: NOT a building, NOT a fortress, NOT a castle, NO architecture, NO towers, NO walls, NO structures of any kind, NO isometric buildings, nothing man-made in the frame, no foreground objects"

declare -A BGS=(
  [system_bg]="a dark star-system map seen from deep space: several small dark planets of different sizes scattered across an otherwise empty starfield, faint thin elliptical orbit lines curving between them, a brooding purple-grey grimdark nebula (#4a4550) bleeding across the background, drifting dust, cold and desolate, mostly dark empty space. $SPACE_NEG"
  [galaxy_bg]="a whole spiral galaxy seen from very far away in deep space, filling the frame: sweeping spiral arms of dim starlight, a sickly violet-purple warp storm tearing through one side of the spiral like a bruise in reality, scattered pinpoints of light, deep black void, ominous and vast. $SPACE_NEG"
  [wave_bg]="the inner courtyard of a besieged gothic fortress bastion seen from INSIDE the walls, looking out: a massive cracked stone rampart wall spanning the frame, torches and orange embers drifting, and beyond the wall a distant horde of shadowy silhouetted creatures massing in thick fog, red glow on the horizon, ash falling, hopeless siege atmosphere"
)

declare -A PLANETS=(
  [planet_1]="an ash world: a dead grey planet blanketed in ash storms and volcanic scars, dull charcoal surface with faint smouldering orange cracks"
  [planet_2]="a forge world: an industrial planet whose whole crust is welded machinery, glowing molten orange (#e8933a) foundry veins, smokestacks and smog belts wrapping it"
  [planet_3]="a toxic world: a sickly green planet, churning acid-green (#5a7a35) cloud bands, poisonous seas, a faint venomous haze"
  [planet_4]="a dead frozen world: a pale blue-white ice planet, cracked glacial surface, frozen dead oceans, cold and lifeless"
)

gen() { # gen <out-inbox-name> <prompt> <aspect>
  local out="art-inbox/$1.png"
  # Reintenta en 503 y cuando el modelo contesta texto en vez de imagen.
  for attempt in 1 2 3; do
    res=$(node scripts/gen_ai_art.js --prompt "$2" --out "$out" --aspect "$3" 2>&1)
    echo "$res" | grep -q "✓" && return 0
    echo "$res" | grep -qE "503|no devolvió imagen" && { echo "  ↻ reintento $attempt"; sleep 18; continue; }
    echo "$res" | grep '✗'; return 1
  done
  return 1
}

ORDER=(system_bg galaxy_bg wave_bg planet_1 planet_2 planet_3 planet_4)
LIST=("$@")
[ ${#LIST[@]} -eq 0 ] && LIST=("${ORDER[@]}")

for id in "${LIST[@]}"; do
  if [ -n "${BGS[$id]}" ]; then
    echo "── $id (fondo 16:9) ──"
    if gen "sector_$id" "${BGS[$id]}, $BG_NEG" "16:9"; then
      node scripts/downscale.js "art-inbox/sector_$id.png" "$AMB/$id.png" --width 960
    fi
  elif [ -n "${PLANETS[$id]}" ]; then
    echo "── $id (planeta) ──"
    if gen "sector_$id" "${PLANETS[$id]}. $PL_NEG" "1:1"; then
      node scripts/process_art.js "art-inbox/sector_$id.png" "$PLA/$id.png" --size 128 --tol 70
    fi
  else
    echo "✗ pieza desconocida: $id"
  fi
done
echo "✓ sectores/escenarios generados"
