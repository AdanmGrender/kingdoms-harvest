#!/usr/bin/env bash
# Reprocesa todo art-b/raw → client/public/assets/b (dirección B). Correr desde la raíz del repo.
set -e
N="${NODE:-node}"; R=art-b/raw; O=client/public/assets/b
p() { "$N" scripts/process_art_b.js "$@" </dev/null; }
p $R/anchor_warrior_v1.png $O/heroes/warrior_idle.webp --height 640
p $R/warrior_attack.png    $O/heroes/warrior_attack.webp --height 640
p $R/mage_idle.png         $O/heroes/mage_idle.webp --height 640
p $R/mage_attack.png       $O/heroes/mage_attack.webp --height 640
p $R/ranger_idle.png       $O/heroes/ranger_idle.webp --height 640
p $R/ranger_attack.png     $O/heroes/ranger_attack.webp --height 640
p $R/bruto_idle.png        $O/enemies/bruto_idle.webp --height 720
p $R/bruto_hit.png         $O/enemies/bruto_hit.webp --height 720
p $R/bg_combat_crypt.png   $O/bg/combat_crypt.webp --scene --width 1080
# UI kit (coords de componentes medidas sobre ui_kit.png 2048²)
p $R/ui_kit.png client/public/assets/b/ui/panel_frame.webp   --crop 127,114,921,1336 --pad 0
p $R/ui_kit.png client/public/assets/b/ui/btn_red.webp       --crop 1141,122,772,289 --pad 0 --height 160
p $R/ui_kit.png client/public/assets/b/ui/btn_stone.webp     --crop 1142,429,771,289 --pad 0 --height 160
p $R/ui_kit.png client/public/assets/b/ui/portrait_ring.webp --crop 1190,742,683,718 --pad 0 --height 256
