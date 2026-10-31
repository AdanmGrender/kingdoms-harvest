#!/bin/bash
# Procesa las hojas de poses del piloto (crudos en art-b/poses_piloto/raw) -> client/public/assets/b/*
# Uso: NODE_PATH=D:/Proyectos/kingdoms-harvest/node_modules bash art-b/poses_piloto/process.sh
R=art-b/poses_piloto/raw; O=client/public/assets/b
p() { node scripts/process_art_b.js "$@"; }
# --scale (no --height): misma escala en toda la hoja, así el KO queda más bajo que la pose de pie (r2: 0.935 = victory (720 px en el crudo) recortada a ~640 px como warrior_idle; 0.93 = 720/(744·1.04)).
# warrior: 4 poses en una fila (cortes en los valles del perfil de columnas), mira a la derecha
p $R/warrior_poses.png $O/heroes/warrior_hit.webp     --crop 0,0,445,768    --scale 0.935
p $R/warrior_poses.png $O/heroes/warrior_skill.webp   --crop 375,0,385,768  --scale 0.935
p $R/warrior_poses.png $O/heroes/warrior_ko.webp      --crop 650,0,420,768  --scale 0.935
p $R/warrior_poses.png $O/heroes/warrior_victory.webp --crop 1000,0,376,768 --scale 0.935
# bruto: 2 poses, mira a la izquierda
p $R/bruto_poses.png $O/enemies/bruto_attack.webp --crop 0,0,668,768    --scale 0.93
p $R/bruto_poses.png $O/enemies/bruto_ko.webp     --crop 668,0,708,768  --scale 0.93
