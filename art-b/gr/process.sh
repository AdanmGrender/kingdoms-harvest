#!/usr/bin/env bash
# Grimdark renacentista: art-b/gr/raw → client/public/assets/b (correr desde la raíz del repo).
# Héroes salen de HOJAS DE POSE 2752x1536 (idle izq. / ataque der.); coords medidas por columnas vacías.
set -e
N="${NODE:-node}"; R=art-b/gr/raw; O=client/public/assets/b
p() { "$N" scripts/process_art_b.js "$@" </dev/null; }
p $R/sheet_warrior.png $O/heroes/warrior_idle.webp   --crop 0,0,1103,1536 --height 640
p $R/sheet_warrior.png $O/heroes/warrior_attack.webp --crop 1103,0,1649,1536 --height 640 --flip
p $R/sheet_mage.png    $O/heroes/mage_idle.webp      --crop 0,0,1170,1536 --height 640
p $R/sheet_mage.png    $O/heroes/mage_attack.webp    --crop 1170,0,1582,1536 --height 640
p $R/sheet_gunner.png  $O/heroes/ranger_idle.webp    --crop 0,0,1090,1536 --height 640
p $R/sheet_gunner.png  $O/heroes/ranger_attack.webp  --erase 1880,760,872,776 --crop 1000,0,1752,1536 --height 640 --fade-right 0.18
p $R/brute_idle.png    $O/enemies/bruto_idle.webp    --height 720
p $R/brute_hit.png     $O/enemies/bruto_hit.webp     --height 720
p $R/bg_combat.png     $O/bg/combat_crypt.webp       --scene --width 1080
# Kit de UI (coords = componentes conexos medidos sobre ui_kit.png 2048²)
p $R/ui_kit.png $O/ui/panel_frame.webp   --crop 61,71,936,1249 --pad 0 --height 900
p $R/ui_kit.png $O/ui/btn_red.webp       --crop 1084,107,891,365 --pad 0 --height 160
p $R/ui_kit.png $O/ui/btn_stone.webp     --crop 1077,549,904,353 --pad 0 --height 160
p $R/ui_kit.png $O/ui/bar_frame.webp     --crop 811,1436,1145,160 --pad 0 --height 64
p $R/ui_kit.png $O/ui/portrait_ring.webp --crop 93,1365,651,639 --pad 0 --height 256
