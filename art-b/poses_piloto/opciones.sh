#!/bin/bash
# Variantes de escala del warrior para la decision de p-kh (sin generar): A = igualar cabeza, B = igualar torso, C = actual (commiteado, por altura).
# Uso: NODE_PATH=D:/Proyectos/kingdoms-harvest/node_modules bash art-b/poses_piloto/opciones.sh <dir_salida>
S=${1:?dir de salida}; mkdir -p "$S"; R=art-b/poses_piloto/raw/warrior_poses.png; A=client/public/assets/b/heroes
p() { node scripts/process_art_b.js $R "$S/$1.webp" --crop $2 --scale $3 >/dev/null 2>&1 || echo FAIL $1; }
p hit_A 0,0,445,768 1.478;      p hit_B 0,0,445,768 1.526
p skill_A 375,0,385,768 1.111;  p skill_B 375,0,385,768 1.564
p ko_A 650,0,420,768 1.62;      p ko_B 650,0,420,768 1.67
p victory_A 1000,0,376,768 1.473; p victory_B 1000,0,376,768 1.76
for k in hit skill victory ko; do
  R=14 node art-b/poses_piloto/measure_body.js $A/warrior_idle.webp $S/${k}_A.webp $A/warrior_$k.webp $S/${k}_B.webp | tail -3 | while read -r l; do echo "$k $l"; done
done
