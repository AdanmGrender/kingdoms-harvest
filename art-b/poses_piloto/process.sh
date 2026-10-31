#!/bin/bash
# Procesa las hojas de poses del piloto (crudos en art-b/poses_piloto/raw) -> client/public/assets/b/*
# Uso: NODE_PATH=D:/Proyectos/kingdoms-harvest/node_modules bash art-b/poses_piloto/process.sh
R=art-b/poses_piloto/raw; O=client/public/assets/b
p() { node scripts/process_art_b.js "$@"; }
# --scale (no --height): misma escala en toda la hoja, así el KO queda más bajo que la pose de pie (r2: 0.935 = victory (720 px en el crudo) recortada a ~640 px como warrior_idle; 0.93 = 720/(744·1.04)).
# r3 (veredicto p-kh): warrior reescalado x1.355 (=0.935*1.355) para igualar la altura cabeza-pies del idle (612 px, medida con measure.js); misma escala en la hoja => el KO arrodillado queda con la misma cabeza.
# warrior: 4 poses en una fila (cortes en los valles del perfil de columnas), mira a la derecha
p $R/warrior_poses.png $O/heroes/warrior_hit.webp     --crop 0,0,445,768    --scale 1.267
p $R/warrior_poses.png $O/heroes/warrior_skill.webp   --crop 375,0,385,768  --scale 1.267
p $R/warrior_poses.png $O/heroes/warrior_ko.webp      --crop 650,0,420,768  --scale 1.267
p $R/warrior_poses.png $O/heroes/warrior_victory.webp --crop 1000,0,376,768 --scale 1.267
# bruto: 2 poses, mira a la izquierda
p $R/bruto_poses.png $O/enemies/bruto_attack.webp --crop 0,0,668,768    --scale 0.93
# bruto_ko: r3 aprobada (raw/bruto_ko_r3.png, --scale 0.72 + opciones para conservar la cuchilla caída); no se reprocesa aquí
