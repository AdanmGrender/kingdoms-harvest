# Aprobación de arte — combate_b (Etapa B, S1, generación por la web)

## P1 — héroes (T8) · veredicto de p-kh (vía Central, t_b1ce4b83)
- `paladin_idle` — APROBADO. `paladin_attack` — APROBADO (mismo recorte; el webp ya está a q88/alfa 95 como el resto de héroes, 74–82 KB, sin recomprimir más).
- `rogue_idle`, `rogue_attack` — REGENERAR. Regla de prompt copiada literal en `art-b/gr/manifest.json` (`sheet_rogue`): «hooded cutpurse, face half-covered by a cloth scarf or a plain leather half-mask, NO beak, NO plague-doctor mask, NO goggles, no green vials; character stands on nothing — no ground, no floor line, no cast shadow, no hatching under the feet; facing right; keep the grinning caricature face, two curved daggers, patched brown cloak». Más hueco entre idle y attack.
- Refs: gen_art_web.js solo sube la primera ref → se usa `mage_idle.webp` (la de `warrior_idle.webp` queda en el manifest, no se sube).
- Generaciones web: ronda 1 = 2 (sheet_paladin, sheet_rogue).

## P1r2 + P2 — rogue (T8) y enemigos (T9) · veredicto de p-kh (vía Central, t_394181f3)
- APROBADOS (15): `rogue_idle`, `rogue_attack`, `carroneros_idle/hit`, `aullador_idle/hit`, `coloso_idle/hit`, `boss_devorador_idle/hit`, `boss_heraldo_idle/hit`, `sin_rostro_idle/hit` (los 4 brazos son el diseño), `voz_del_velo_idle`. Orientación frontal de coloso y voz_del_velo aceptada como excepción.
- `boss_devorador_hit`: NO regenerar; reprocesado con `--height 720 --margin 8 --quality 77` (8 px transparentes arriba; 687x720, 96 KB; filas 0-11 con alfa 0).
- `voz_del_velo_hit`: REGENERAR (1 generación, `--ref` su idle). Regla literal copiada al manifest: «whole figure tilted 25-30 degrees backwards and turned three-quarter to the LEFT, silhouette clearly different from the reference: veil ripped wide open to one side, two hands thrown up above the head, bell swinging far to the right, candles blown sideways, lower robe flaring out to the right; keep design and colours identical; nothing on the ground; do not repeat the reference pose».

## P3 — voz_del_velo_hit r2 + 5 fondos (T10) · veredicto de p-kh (vía Central, t_2b6ae119)
- TODO APROBADO (6 de 6, 0 regeneraciones). Generaciones web usadas ≈23-24 de 40.
- `enemies/voz_del_velo_hit`: APROBADO (no cumple la regla literal, pero la silueta cambia por completo y el barrido va a la derecha, lejos de los héroes).
- `bg/combat_moor`, `combat_cathedral`, `combat_ashfield` (reintento limpio), `combat_veil_marsh`, `combat_veil_gate`: APROBADOS.
- Nota a cumplir: en la captura del juego (Etapa C, T12) verificar que el portal de `combat_veil_gate` no tape los efectos verdes; si los tapa, oscurecer el fondo por código, sin regenerar.
