# Aprobación de arte — combate_b (Etapa B, S1, generación por la web)

## P1 — héroes (T8) · veredicto de p-kh (vía Central, t_b1ce4b83)
- `paladin_idle` — APROBADO. `paladin_attack` — APROBADO (mismo recorte; el webp ya está a q88/alfa 95 como el resto de héroes, 74–82 KB, sin recomprimir más).
- `rogue_idle`, `rogue_attack` — REGENERAR. Regla de prompt copiada literal en `art-b/gr/manifest.json` (`sheet_rogue`): «hooded cutpurse, face half-covered by a cloth scarf or a plain leather half-mask, NO beak, NO plague-doctor mask, NO goggles, no green vials; character stands on nothing — no ground, no floor line, no cast shadow, no hatching under the feet; facing right; keep the grinning caricature face, two curved daggers, patched brown cloak». Más hueco entre idle y attack.
- Refs: gen_art_web.js solo sube la primera ref → se usa `mage_idle.webp` (la de `warrior_idle.webp` queda en el manifest, no se sube).
- Generaciones web: ronda 1 = 2 (sheet_paladin, sheet_rogue).
