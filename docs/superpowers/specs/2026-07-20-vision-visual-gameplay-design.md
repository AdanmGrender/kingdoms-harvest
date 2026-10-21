# Visión Visual & Game-Feel — Kingdoms Harvest (Design Doc)

> **Tipo:** plan de dirección artística (NO implementación). Fecha: 2026-07-20.
> **Autor:** pase de dirección de arte + game-feel.
> **Feedback del owner:** «el juego se ve un poco mal a nivel visual… el gameplay
> no se parece a los ejemplos» (un iso grimdark bien hecho).
> **Objetivo:** capturar la CALIDAD, COHESIÓN y GÉNERO de esa inspiración con
> diseños 100% ORIGINALES, aterrizado en el pipeline Nano Banana/Gemini + Phaser
> que YA existe. Sin reescribir el motor.

---

## 🔒 Regla de IP (innegociable — el proyecto entero la sostiene)

El juego monetiza cripto real (KH Token → TON). El look es **grimdark 40k-INSPIRADO
pero 100% ORIGINAL**. **CERO marcas de Games Workshop**: nada de águilas
imperiales / bicéfalas / aquila, estrella del caos, sellos de pureza, siluetas de
Space Marine calcadas, Capítulos/Legiones nombrados, ni «Warp/Emperor/Imperium»
como texto literal. Se persigue el SABOR (gótico-industrial, decadencia, calaveras
genéricas, armadura voluminosa, luz puntual dramática) — jamás la propiedad. Esta
regla ya vive en `docs/art-style.md` y `docs/ai-art-pipeline.md`; este documento la
reafirma como restricción de TODO asset nuevo que se genere aquí.

---

## 1. Diagnóstico (citando las capturas)

Las capturas usadas: `cur_world.png`, `cur_hub.png` / `sg_1_hub.png`,
`cur_combat.png`, `sg_2_operations…png`, `sg_3_calendario.png`, `sg_4_pase.png`,
`sg_5_codice.png`, `sg_6_tienda_boost.png`.

### Hallazgo raíz: TRES lenguajes visuales compitiendo

El juego no se ve «mal» por falta de arte — se ve **incoherente** porque mezcla
tres estéticas que no dialogan:

- **(A) Arte IA grimdark rico** — anclas de terreno, 18 retratos de héroe
  (`client/public/assets/game/heroes/*.png`), íconos de packs de gemas, íconos de
  nodo. Es bueno. Es el activo más caro y el que hay que hacer dominar.
- **(B) Emoji** — **40 componentes** usan emoji (`🦸🏰🗺️` en `BottomNavBar.jsx`;
  `💀⚔️🏆☠️✦` en `CombatInstancePanel.jsx`; `💎⭐🎁🤝📊` en shop/pase/calendario).
  Es barato, de otra época/tono, y rompe la inmersión al instante.
- **(C) Chrome Tailwind plano** — cards azul-marino `#16213e`, acento rosa-rojo
  `#e94560`, barras de progreso lisas. Es "mobile genérico", no grimdark. Ojo:
  `#e94560` es un rosa *cuqui*, no el rojo-sangre grimdark `#b32821` de la paleta
  oficial (`docs/art-style.md`).

Todo lo demás abajo es síntoma de esta fractura.

### 1.1 Terreno "partido en 4" y muddy (`cur_world.png`, `cur_hub.png`)

- **Problema:** El piso se ve dividido en un damero de rectángulos y todo tiene el
  mismo verde-gris embarrado sin contraste.
- **Por qué:** `client/src/game/systems/ZoneAnchors.js` ancla **UNA imagen IA
  completa por zona de 8×8 tiles** → en el mapa 32×32 eso es un grid **4×4 de
  costuras rectangulares duras**, con `flipX/flipY` por zona que acentúa el corte.
  El `buildHubAnchor()` (WorldScene.js:204) tapa solo la cruz central del hub, pero
  las zonas de alrededor siguen costurando.
- **Por qué se ve embarrado:** hay un `setTint(0x6b6b73)` en **tres** sitios
  (`ZoneAnchors.js:96`, `WorldScene.js:212`, y el hub) que **oscurece TODO el piso
  a un gris-verde plano**, matando el rango de valor. Es un parche: el comentario en
  el código lo admite — «el terreno IA es muy detallado y en el mismo rango de
  valor que los sprites, así que edificios y personajes se fundían». El tinte
  esconde el síntoma (floor y actores comparten valor) en vez de curarlo.
- **Agravante 1:** los prompts de `scripts/gen_zones.sh` piden pisos de **alto
  detalle y valor medio** ("glowing toxic green sludge", "dark decaying
  vegetation") → el suelo compite con los actores por atención.
- **Agravante 2:** el hub dibuja una **grilla blanca** encima (visible en
  `sg_1_hub.png`) que contradice el terreno orgánico y grita "placeholder".

### 1.2 Top-down vs isométrico — tensión sin resolver

- **Problema:** el owner pide "iso grimdark" y el juego no se le parece.
- **Por qué:** `WorldScene` (top-down) está **ACTIVA** (`config.js` → `ISO_MODE =
  false`), pero **todo el pipeline de arte es isométrico**: el STYLE maestro de
  `scripts/gen_ai_art.js` empieza con "isometric pixel art…", `IsoWorldScene` /
  `IsoScene` son experimentos a medio hacer, y `gen_zones.sh` literalmente **pelea
  contra** el sesgo iso del prompt ("NOT isometric, flat overhead"). Es decir: se
  genera arte con sesgo iso y se renderiza top-down → desajuste estructural. Hay que
  **tomar una posición y alinear todo a ella** (ver §2).

### 1.3 Legibilidad actor vs fondo (el tinte `0x6b6b73`)

- **Problema:** los actores in-world son manchitas (los "farmers" amarillos de
  `cur_world.png` apenas se leen; los NPC Korvath/Vael/Draust son siluetas oscuras
  con etiquetas en una pixel-font distinta a los títulos MedievalSharp).
- **Por qué:** sin separación de VALOR entre piso y actores, la única herramienta
  que quedó fue oscurecer el piso entero → world plano y actores igual de apagados.
  Falta la regla de oro de los juegos oscuros legibles: **piso oscuro/desaturado/
  bajo-detalle + actores claros, saturados y con rim-light**.

### 1.4 Cohesión de arte

- Edificios, terreno, íconos y personajes **no comparten un mismo tratamiento**.
  Hay 18 retratos de héroe ricos, un `grimIconSheet.generated` cableado en
  `spriteMap.getSprite` (resuelve grim primero) — pero **40 componentes siguen
  metiendo emoji** en vez de `SpriteIcon`. La cohesión existe a medias en el código
  y se rompe en la UI.

### 1.5 Panel de combate y overlays planos/emoji vs mundo rico (`cur_combat.png`)

- **El disconnect más grave.** `CombatInstancePanel.jsx` es literalmente **dos
  barras de progreso CSS** (Enemigo rosa, Guarnición) sobre negro, con emoji
  (`💀⚔️🏆☠️✦`). **No usa NINGUNO de los 18 retratos de héroe que el juego ya
  posee.** El activo más rico del proyecto es invisible justo donde el jugador mira
  fijo durante el "gameplay". El mundo promete grimdark; el combate entrega una hoja
  de cálculo.
- Overlays (`sg_3..6`): consistentes entre sí (cards Tailwind) pero se sienten
  "tienda mobile genérica" — títulos MedievalSharp dorados (bien) sobre chrome
  navy plano con emoji `💎` en "Desbloquear Premium (1440 💎)".

### 1.6 Iluminación / atmósfera

- Hay buenos cimientos: `GlowLights.js`, `AmbientSystem.js` (viñeta), el glow teal
  del spawn (centro de `cur_hub.png`). Pero el tinte plano los ahoga. **No hay
  rim-light en actores ni dirección de luz-clave consistente** — el ingrediente #1
  que hace "premium" a un juego oscuro.

### 1.7 UI / iconografía inconsistente

- Emoji + íconos de tamaños/estilos mezclados. Barra de recursos con íconos
  diminutos y embarrados. Dos tipografías pixel distintas (labels NPC vs títulos).
  El acento `#e94560` (rosa) tira toda la paleta hacia lo *cute*.

### 1.8 La brecha "retrato rico ↔ sprite in-world débil"

- 18 retratos 160px de calidad en `HeroPanel`, pero in-world los héroes son sprites
  genéricos minúsculos y en combate **no aparece retrato alguno**. La inversión de
  arte más fuerte del juego no se ve en los dos lugares que más importan: mundo y
  combate.

---

## 2. Dirección artística objetivo (una sola, comprometida)

### North Star: **"Diorama grimdark 2.5D"**

> Cámara y lógica **top-down** (la que YA corre, con hub/campaña/streaming/228
> tests), pero cada ACTOR (edificio, héroe, enemigo, decoración) se trata como un
> **billboard ¾ pintado a mano, con sombra horneada y rim-light**, plantado sobre
> un **piso oscuro, desaturado y de bajo detalle**. Lee como "iso grimdark de
> calidad" **sin** pagar la migración a matemática isométrica.

**Por qué esta y no iso pura:** el owner quiere el *look* iso-grimdark, no la
proyección. La proyección iso es cara (IsoWorldScene está a medias, rehace input/
pathfinding/depth-sort/hit-testing) y de alto riesgo. El look —profundidad,
volumen, luz dramática— se logra con **disciplina de valor + rim-light + sombras
horneadas + billboards ¾**, que es 100% compatible con la escena top-down actual y
con la técnica de "anclas por zona" que ya existe. Se compromete el DIORAMA, se
archiva (no se borra) el experimento iso (§4, Fase 6).

### Los 6 mandamientos (aplican a TODO asset y pantalla)

1. **Disciplina de valor (la regla madre).** Piso: valor ≤ ~30%, desaturado,
   bajo detalle → *retrocede*. Actores: valor medio-alto en las masas de lectura,
   saturación en el acento de facción → *avanzan*. Esto **elimina la necesidad del
   `setTint(0x6b6b73)`**: el contraste lo da el arte, no un parche global.
2. **Rim-light siempre.** Todo actor lleva un borde de luz fría (teal `#4fd8c8`) o
   cálida (naranja vela `#e8933a`) del lado opuesto a la sombra. Es el sello #1 del
   "premium oscuro" (confirmado por la investigación: *rim como seguro de contorno*).
3. **Luz-clave coherente.** Fuente conceptual arriba-izquierda; sombra horneada
   abajo-derecha bajo cada actor. Consistente en terreno, edificios y personajes.
4. **Silueta legible.** Formas simplificadas, contorno de 1px, se lee a 32px en un
   WebView de Telegram. Nada de "ruido realista" (la investigación lo marca como el
   error típico de iso/top-down).
5. **Paleta disciplinada = paleta oficial grimdark** (`docs/art-style.md`): piedra
   `#4a443e`, piedra oscura `#332f2b`, sangre `#b32821`, oro sucio `#d9a441`, teal
   holograma `#4fd8c8`, vela `#e8933a`, cielo tormenta `#4a4550`. **Retirar** el
   rosa `#e94560` y el navy `#16213e` cute de la UI y reemplazarlos por esta paleta.
   Grimdark ≠ todo negro: la investigación insiste en **acentos brillantes** (teal,
   vela, oro) contra la base apagada — eso es lo que da vida.
6. **Cero emoji en superficie de juego.** Todo ícono sale del set grim
   (`grimIconSheet.generated` vía `SpriteIcon`). Emoji solo como `fallback` de
   `SpriteIcon` mientras el arte no exista.

### Cómo se ve cada capa bajo el North Star

| Capa | Antes | Después (diorama grimdark) |
|------|-------|----------------------------|
| Piso | verde-gris medio, alto detalle, tinte plano, costuras 4×4 | oscuro/desaturado/bajo-detalle, sin tinte, costuras disueltas, viñeta de borde |
| Edificios | billboards planos 64px | billboards ¾ con sombra + rim-light, "pisan" el tile |
| Héroes/NPC | manchitas genéricas | ¾ rim-lit, acento de facción, sombra bajo pies |
| Combate | 2 barras + emoji | diorama con retratos reales + enemigo + VFX de impacto |
| UI | cards navy + emoji + rosa | cards piedra/sangre/oro, íconos grim, sin emoji |

---

## 3. Plan por fases — PRIORIZADO por ROI visual

> Regla de esfuerzo: **S** ≈ ½–1 día, **M** ≈ 2–4 días, **L** ≈ 1–2 semanas de
> trabajo enfocado. Todo asset nuevo pasa por el pipeline existente
> (`scripts/gen_ai_art.js` → `art-inbox/` → recorte → `client/public/assets/game/`).

### FASE 0 — Quick wins de contraste (½ día, ROI altísimo) · **S**

Cambios de código puro, sin arte nuevo, que ya suben la percepción:

- **Quitar el parche de tinte plano.** `ZoneAnchors.js:96`, `WorldScene.js:212`:
  reemplazar `setTint(0x6b6b73)` por (a) un tinte MUCHO más sutil o ninguno una vez
  que el arte de piso sea oscuro (Fase 1), y mientras tanto (b) un **multiply +
  viñeta** vía `AmbientSystem` en vez de un flat-tint que aplana. Meta: el piso
  retrocede por VALOR, no por un velo gris.
- **Matar la grilla blanca del hub** (o bajarla a alpha ~0.06 y color piedra) — hoy
  grita "debug".
- **Retematizar la paleta Tailwind** en `tailwind.config.js`: `kingdom-accent`
  `#e94560 → #b32821`; `kingdom-card`/`kingdom-bg` hacia `#332f2b`/`#1a1712`
  piedra. Un solo archivo, propaga a las 40 pantallas.

**Archivos:** `client/src/game/systems/ZoneAnchors.js`,
`client/src/game/scenes/WorldScene.js`, `client/src/game/systems/AmbientSystem.js`,
`client/tailwind.config.js`.

### FASE 1 — Disciplina de valor del PISO + disolver el "partido en 4" (M) · **ROI #1**

El piso toca todas las pantallas con mundo; arreglarlo es el mayor salto.

- **Regenerar las anclas de terreno OSCURAS y de bajo detalle.** Reescribir los
  prompts de `scripts/gen_zones.sh`: forzar "very dark, low value (≤30% luminance),
  desaturated, minimal detail, matte, no bright highlights, no glowing elements".
  El teal/vela/sangre son para ACTORES, no para el piso.
- **Disolver las costuras 4×4.** Dos opciones (elegir en implementación):
  1. **Feather/overlap:** en `ZoneAnchors.buildZoneAnchor`, agrandar cada ancla
     ~12% y darle un borde con alpha-gradient (máscara radial) para que las zonas se
     solapen y fundan en vez de cortar en rectángulo. Barato, solo código.
  2. **Menos zonas, más grandes + decals de unión:** subir `ZONE_TILES` o generar 1
     base grande por bioma y romper repetición con los decals ya existentes
     (`ground_decals`) en las junturas. Más arte, mejor resultado.
- **Añadir viñeta de borde de mundo** (AmbientSystem) para que el ojo caiga al
  centro y el borde del mapa se funda con `backgroundColor #4a4550` (ya está puesto).

**Pipeline:** `scripts/gen_zones.sh` (reprompt), `scripts/downscale.js` (ya existe),
`ZoneAnchors.js` (feather), `WorldScene.buildHubAnchor` (reprompt `zone_hub`).
**Esfuerzo:** M. **Riesgo:** bajo (fallback limpio si falta arte, ya implementado).

### FASE 2 — Rediseño del PANEL DE COMBATE (M) · **ROI #2**

Convierte la pantalla más vacía en el escaparate del juego, **usando arte que ya
existe** (los 18 retratos). Casi sin pipeline nuevo.

- **Traer los retratos de héroe al combate.** `CombatInstancePanel.jsx` debe montar
  los retratos de `state.heroes` (mismos `heroes/<id>.png` de HeroPanel), en fila,
  con barra de energía/rim-light y flash cuando disparan su skill.
- **Dar cara al enemigo.** Generar 1 retrato/silueta grimdark por arquetipo de nodo
  (combat/wave/boss) — reusar el pipeline de héroes (`gen_heroes.sh`) con prompts de
  enemigo original (carroñeros, heraldo putrefacto, devorador de almas — nombres YA
  originales en `gameConfig.CAMPAIGN`).
- **Fondo de diorama.** Un matte oscuro por tipo de nodo (páramo/muralla/marea)
  detrás de las barras — reusar el estilo de `zone_*`/`sky_storm`.
- **VFX de impacto y game-feel.** Shake corto en golpe, "-N" flotante rojo, destello
  al bajar HP, fanfarria visual en victoria. Todo CSS/React + EventBridge; sin
  motor nuevo.
- **Quitar emoji** (`💀⚔️🏆☠️✦`) → `SpriteIcon` con set grim.

**Archivos:** `client/src/components/campaign/CombatInstancePanel.jsx`,
`client/src/components/ui/SpriteIcon.jsx`, `gameConfig.CAMPAIGN` (mapa nodo→retrato
enemigo), pipeline `scripts/gen_heroes.sh` (enemigos). **Esfuerzo:** M.
**Nota:** respetar el auto-avance idle de la spec (Fase 4/§combate) — el diorama es
visual, no cambia la lógica server-authoritative.

### FASE 3 — Erradicar emoji + cohesión de iconografía UI (M) · **ROI #3**

- **Barrido de emoji → set grim.** Los 40 componentes: sustituir cada emoji por
  `SpriteIcon name=… fallback=<emoji>`. El fallback conserva el emoji SOLO hasta que
  exista el ícono grim, así el barrido no rompe nada.
- **Completar el set grim de UI.** `scripts/gen_icons.sh` +
  `assemble_icon_sheet.js` ya producen `grim_icons.png` + manifiesto. Generar los
  íconos que faltan para los overlays nuevos (pase, calendario, códice, boost, gema,
  sweep, nodo, victoria/derrota, tap-skill). Un solo sheet cohesivo.
- **Chrome de panel grimdark.** Clases canónicas (`.game-card`, `.btn-gold`,
  `.btn-primary`, `.progress-*` en `index.css`): borde piedra + filete oro,
  barras con textura sutil en vez de bloques lisos. Ya con la paleta de Fase 0.
- **Unificar tipografía de labels** in-world (NPC) con el sistema (MedievalSharp
  para nombres propios/títulos; sans para cuerpo) — quitar la pixel-font huérfana.

**Archivos:** los 40 `client/src/components/**/*.jsx` (barrido), `SpriteIcon.jsx`,
`client/src/index.css`, `scripts/gen_icons.sh`, `assemble_icon_sheet.js`,
`grimIconSheet.generated.js`. **Esfuerzo:** M (mecánico pero amplio).

### FASE 4 — Actores in-world: edificios + héroes ¾ con rim-light (L)

- **Edificios como billboards ¾ con sombra + rim.** Regenerar los 16 edificios con
  el pipeline (`gen_ai_art.js` presets `throne_room/tower/smithy/…` ya existen):
  añadir al prompt "baked ground shadow, cool teal rim light on upper-left edge,
  plain transparent-ready dark bg". Anclar "pie" al 88% (ya documentado). Subir
  `BUILDING_SIZE` (hoy 64 en `entities/Building.js:11`, la spec de arte dice 96) para
  que respiren.
- **Héroes/NPC in-world con el mismo tratamiento** que los retratos (cerrar la
  brecha §1.8): mini-sprite ¾ rim-lit derivado del retrato, no un blob genérico.
- **Decoración grimdark** (cráneos, escombros, estandartes) como decals/objetos de
  `buildZone` para densidad ambiental — la investigación cita "decal density" como
  palanca de cohesión.

**Pipeline:** `scripts/gen_ai_art.js`, `gen_heroes.sh`, `process_art.js`,
`entities/Building.js`, `entities/NPC.js`. **Esfuerzo:** L. **ROI:** alto pero
después de que el piso (Fase 1) los deje resaltar.

### FASE 5 — Pase de iluminación y atmósfera (M)

- **Rim-light y luz puntual reales-simuladas.** Extender `GlowLights.js`/
  `AmbientSystem.js`: sprites de glow aditivos (vela naranja, holo teal, LED sangre)
  anclados a edificios clave; partículas de brasa/ceniza flotando (ParticleSystem ya
  existe). Niebla/depth-haze por distancia para separar planos.
- **Ciclo día/noche grimdark** reusando el evento `time:updated` (§9.2 CLAUDE.md):
  tormenta púrpura de fondo, relámpagos ocasionales.

**Archivos:** `client/src/game/systems/GlowLights.js`, `AmbientSystem.js`,
`ParticleSystem.js`. **Esfuerzo:** M.

### FASE 6 — Decisión iso, formalizada (S, decisión + doc)

- **Comprometer el "Diorama 2.5D" como oficial** en `docs/art-style.md`; **archivar**
  (no borrar) `IsoWorldScene`/`IsoScene` como experimento congelado detrás de
  `ISO_MODE`/`?iso=1`. Alinear el STYLE maestro de `gen_ai_art.js`: dado que el
  render es top-down, quitar "isometric" del bloque y pedir "¾ view billboard,
  flat-lit ground" — hoy el pipeline pelea contra sí mismo (§1.2).
- Dejar por escrito el criterio para RE-abrir iso (si algún día se quiere): sería un
  proyecto L+ dedicado, no un flag.

**Archivos:** `docs/art-style.md`, `scripts/gen_ai_art.js` (STYLE), `config.js`
(comentario). **Esfuerzo:** S.

### Orden recomendado (mayor ROI primero)

```
Fase 0 (½d) → Fase 1 (piso) → Fase 2 (combate) → Fase 3 (emoji/UI)
           → Fase 4 (actores) → Fase 5 (luz) → Fase 6 (decisión iso)
```

Fases 0–3 son el 80% de la percepción "premium" y se apoyan casi todas en arte y
sistemas que YA existen.

---

## 4. Qué necesita del owner

1. **Imágenes de referencia → `art-inbox/references/`.** La carpeta ya está creada
   (con `.gitkeep`). Que el owner deje ahí SUS ejemplos exactos del look objetivo
   (los iso grimdark que tiene en mente). Con eso se hace un *pase de afinación*:
   ajustar prompts (paleta exacta, nivel de detalle, densidad de decals) para clavar
   el target concreto en vez de un grimdark genérico. **Recordatorio de IP:** si las
   refs traen marcas GW, se usan solo para tono/composición, jamás para copiar
   siluetas/símbolos.
2. **`GEMINI_API_KEY` en `server/.env`** activa y con **billing** — la generación de
   imágenes de Nano Banana **no está en la capa gratuita** (~$0.04/imagen, lo avisa
   `gen_ai_art.js`). Presupuesto estimado del arte de este plan: ~200–300 imágenes
   (terreno×7-10 reintentos, 16 edificios, ~8 enemigos, set de íconos, fondos de
   combate) → orden de **$15–30 en generación**, más iteraciones. Confirmar techo de
   gasto.
3. **Decisión explícita de perspectiva:** aprobar el "Diorama 2.5D" como dirección
   oficial (§2) para poder alinear el pipeline y archivar el experimento iso.
4. **Prioridad de negocio:** confirmar que Fases 0–3 (contraste + combate + emoji)
   van primero — son las que responden directo al "se ve mal / no se parece a los
   ejemplos" con el menor costo.

---

## 5. Riesgos

- **IP (el riesgo que puede matar el proyecto).** Cada asset generado debe pasar el
  filtro anti-GW (águilas, marines, chaos star, purity seals, nombres literales).
  El owner referencia 40k constantemente: hay que traducir SABOR→original en cada
  prompt y revisar cada salida en `art-inbox/` antes de integrar. Es proceso, no un
  chequeo único.
- **Migración top-down↔iso.** Comprometer iso pura sería L+ (input, pathfinding,
  depth-sort, hit-testing, re-arte de todo el pack) y pondría en riesgo los 228
  tests y los sistemas de hub/campaña/streaming ya estables. El "Diorama 2.5D"
  evita ese costo; el riesgo es de EXPECTATIVA (dejar claro al owner que no será
  proyección iso literal, sino su *look*).
- **Deriva de coherencia IA.** Nano Banana varía entre corridas; sin fijar seeds/
  paleta y sin un pase de afinación con las refs del owner, los assets pueden no
  casar entre sí. Mitigación: generar por lotes con el MISMO bloque de estilo y
  revisar en conjunto, no de a uno.
- **Barrido de emoji amplio (40 archivos).** Riesgo de regresión mecánica; mitigado
  por el patrón `SpriteIcon fallback=<emoji>` (no rompe si falta el ícono) y por
  hacerlo pantalla por pantalla con captura antes/después
  (`.claude/skills/run-kingdoms-harvest`).
- **Costo de generación acumulado** si se itera mucho el terreno (los reintentos de
  `gen_zones.sh` ya hacen 4 intentos/slot). Acotar con revisión humana entre lotes.

---

## Apéndice — Anclas de archivo (para quien implemente)

| Tema | Archivo(s) |
|------|-----------|
| Tinte plano del piso | `client/src/game/systems/ZoneAnchors.js:96`, `client/src/game/scenes/WorldScene.js:212` |
| Costuras 4×4 / zonas | `client/src/game/systems/ZoneAnchors.js` (`ZONE_TILES=8`), `WorldScene.buildZone/buildHubAnchor` |
| Combate plano | `client/src/components/campaign/CombatInstancePanel.jsx` |
| Emoji nav | `client/src/components/hud/BottomNavBar.jsx` (`🦸🏰🗺️`) |
| Emoji (40 archivos) | `client/src/components/**/*.jsx` |
| Resolución de íconos | `client/src/utils/spriteMap.js`, `client/src/config/grimIconSheet.generated.js` |
| Paleta UI | `client/tailwind.config.js`, `client/src/index.css` |
| Pipeline IA | `scripts/gen_ai_art.js` (STYLE + presets), `gen_zones.sh`, `gen_heroes.sh`, `gen_icons.sh`, `assemble_icon_sheet.js`, `downscale.js`, `process_art.js` |
| Tamaño de edificio | `client/src/game/entities/Building.js:11` (`BUILDING_SIZE=64`) |
| Retratos de héroe (activos ricos) | `client/public/assets/game/heroes/*.png` (18) |
| Flag iso | `client/src/game/config.js` (`ISO_MODE`), `IsoWorldScene.js`, `IsoScene.js` |
| Regla de IP | `docs/art-style.md`, `docs/ai-art-pipeline.md` |

**Benchmarks de CALIDAD (citar, NO copiar):** *Warhammer 40k: Tacticus* (unidades
limpias y legibles sobre pisos que retroceden), *Grimguard Tactics* (iso grimdark
mobile), *Grim Soul* (top-down grimdark con disciplina de valor). Se estudian por
*principios* (contraste piso/actor, rim-light, densidad de decals, cohesión de
iconografía), nunca por sus marcas.
