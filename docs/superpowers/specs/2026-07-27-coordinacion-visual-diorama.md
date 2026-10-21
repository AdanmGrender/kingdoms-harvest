# Coordinación visual — Diorama iso grimdark (style-locked) — Plan

> **Fecha:** 2026-07-27 · **Estado:** anclas + pipeline PROBADOS (5 tipos de
> asset cohesivos desde 2 anclas). Este doc coordina el juego ENTERO al estilo
> de referencia. Reemplaza el enfoque top-down muddy.

## 0. Decisión (tomada con el owner, con pruebas en mano)

- **Fuente de arte:** pipeline IA **style-locked** — `gen_ai_art.js --ref <ancla>`
  (image→image de Nano Banana). Da arte PROPIO y cohesivo. Probado.
- **Presentación:** el juego se muestra como **dioramas isométricos** (como las
  referencias: WH40k Mechanicus / mission-diorama), NO como el mundo top-down.
  Cada pantalla = un diorama de fondo + HUD encima.
- **IP (innegociable):** 100% ORIGINAL. Cero marcas de Games Workshop (águilas/
  aquila, estrella del caos, sellos, siluetas de marine, nombres de facción).
  Las referencias del owner ERAN IP de GW → NO se usan como `--ref`; las anclas
  son ORIGINALES generadas y curadas. Cada asset pasa el filtro anti-GW.

## 1. Contrato de coordinación (lo que hace que TODO encaje)

Todo asset se genera/proces a a este contrato único:

| Eje | Valor |
|-----|-------|
| Proyección | isométrica 2:1, vista top-¾ |
| Estilo | painterly pixel-art detallado (el de las anclas) |
| Paleta | piedra `#4a443e`/`#332f2b`, sangre `#b32821`, oro sucio `#d9a441`, teal `#4fd8c8`, vela `#e8933a`, cielo tormenta `#4a4550` |
| Luz | clave arriba-izquierda, rim-light frío/cálido, sombra horneada abajo-derecha |
| Fondo | dioramas: placa-diamante autocontenida sobre fondo oscuro liso · actores: fondo transparente + sombra de contacto |
| Escala | referencia: un soldado ≈ 1/6 de la altura de la torre-keep (normalizar en process) |

## 2. Anclas de estilo (el "norte", ya generadas)

`art-inbox/anchors/` (versionadas por ser la fundación, no regenerables idénticas):
- `anchor_soldier.png` — ancla de PERSONAJES/unidades.
- `anchor_ruin.png` — ancla de ESTRUCTURAS.
- (`diorama_scene.png`, `diorama_hub.png`, `enemy_bruto.png` — pruebas de cohesión.)

Regla (investigación): rotar 2-3 anclas que comparten estética / distinta
composición para no sobreajustar. Se generan más anclas si aparece deriva.

## 3. Manifiesto de assets (finito — el modelo diorama pide POCOS)

> El fondo-por-pantalla necesita MUCHOS menos assets que un mundo de tiles.

**A. Dioramas de fondo de combate** (por tipo de nodo · `dioramas/`):
`battle_ruins` (combat) · `battle_tide` (wave, asedio/marea) · `boss_arena`
(boss) · variantes acto 2 (`ashen_*`). ≈ **6**.

**B. Diorama(s) del hub** (`dioramas/hub_bastion`): 1 base + posible variante
noche/tormenta. ≈ **2**.

**C. Enemigos** (WAVE_ENEMIES + campaña, billboard ¾ + sombra · `enemies/`):
carroñeros · brutos ✓ · aullador · coloso · devorador (boss) · heraldo (boss)
· 2 de acto 2. ≈ **8**.

**D. Unidades / héroes** (`heroes/`): regenerar ancladas las clases usadas en
combate (guerrero/mago/ranger/paladín/pícaro) + los héroes destacados; los 18
retratos viejos se re-anclan por tandas. ≈ **10**.

**E. Frames de UI** (`ui/`): marco de panel 9-slice (piedra/metal), botón, card,
barra. ≈ **6** (o CSS puro si el 9-slice complica). Mata el navy+emoji.

**Total ~30 "hero" assets** × curación ≈ 60-100 generaciones → **~$3-15**
(mucho menos que un mundo de tiles). Cada uno: `gen_ai_art --ref` + `process_art`.

## 4. Pipeline por asset

1. `node scripts/gen_ai_art.js --aspect 1:1 --ref art-inbox/anchors/anchor_*.png --prompt "<sujeto> ..." --out art-inbox/<cat>/<id>.png`
2. Revisar (filtro anti-GW + estilo). Regenerar si hace falta.
3. `process_art.js` (fondo transparente para actores, normalizar escala/sombra).
4. Copiar a `client/public/assets/game/<cat>/<id>.png` (gitignoreado salvo los
   pocos foundational).
5. Integrar (ver §5).

## 5. Integración por TANDAS (revisables, mayor impacto primero)

- **T1 — Fondos de combate por nodo.** `CombatInstancePanel` elige el diorama
  según `node.type`/acto (mapa `type→bg`). PROBADO con `battle_ruins`.
- **T2 — Hub diorama.** `BastionHub` muestra el diorama (PROBADO). Final: variar
  por progreso/estado. Jubila el WorldScene top-down como default.
- **T3 — Enemigos anclados.** Sprite del enemigo en `CombatInstancePanel` + panel
  de Marea Disforme (reemplaza el bestiario actual).
- **T4 — Reskin de UI.** Frames/botones/paneles al estilo (o CSS en la paleta):
  mata el navy y los emoji que ahora chocan con los dioramas. Alto ROI percibido.
- **T5 — Héroes/unidades anclados.** Regenerar retratos por el pipeline anclado;
  UI de escuadra + combate con las unidades nuevas.

Cada tanda: generar → mirar screenshots → commitear → siguiente. Sin gasto a ciegas.

## 6. Riesgos

- **IP** (mata el proyecto): filtro anti-GW en CADA asset antes de integrar.
- **Deriva de estilo**: si un batch se aleja, sumar/rotar anclas.
- **Peso**: dioramas ~1-1.5MB; downscale a lo que el WebView necesita.
- **Costo de generación** (facturado): tope por tanda, se revisa entre medio.
- **Estático vs interactivo**: el hub-diorama es una lámina; si se quiere base
  editable con edificios del jugador, es composición de sprites (T5+, más caro).
  Para idle, la lámina por-estado alcanza y es lo más lindo/barato.
