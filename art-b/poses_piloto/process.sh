#!/bin/bash
# Procesa las hojas de poses del piloto (crudos en art-b/poses_piloto/raw) -> client/public/assets/b/*
# Uso: NODE_PATH=D:/Proyectos/kingdoms-harvest/node_modules bash art-b/poses_piloto/process.sh
R=art-b/poses_piloto/raw; O=client/public/assets/b
p() { node scripts/process_art_b.js "$@"; }
# --scale (no --height): misma escala en toda la hoja, así el KO queda más bajo que la pose de pie (0.977 = 640/(630·1.04); 1.03 = 720/(672·1.04)).
# warrior: 4 poses en una fila (cortes en los valles del perfil de columnas), mira a la derecha
p $R/warrior_poses.png $O/heroes/warrior_hit.webp     --crop 0,0,400,768    --scale 0.977
p $R/warrior_poses.png $O/heroes/warrior_skill.webp   --crop 300,0,450,768  --scale 0.977
p $R/warrior_poses.png $O/heroes/warrior_ko.webp      --crop 690,0,340,768  --scale 0.977
p $R/warrior_poses.png $O/heroes/warrior_victory.webp --crop 990,0,386,768 --scale 0.977
# bruto: 2 poses, mira a la izquierda
p $R/bruto_poses.png $O/enemies/bruto_attack.webp --crop 0,0,680,768    --scale 1.03
p $R/bruto_poses.png $O/enemies/bruto_ko.webp     --crop 680,0,696,768  --scale 1.03
