# Puerta de arte — set de íconos B (ui_kit_b T22)

- Fecha: 2026-10-21
- Autor: p-kh (dirección de arte)
- Revisado: `specs/ui_kit_b/evidencia/iconos_contacto.webp` (79 íconos a 24/32/48 px
  sobre `kh-oak`), commit `f133c44`. Hoja: `client/public/assets/b/ui/icons.webp`
  (1536×1920, celda 192). Además miré celdas sueltas de la hoja a 96 px y a
  32 px ampliadas ×4, para ver detalle.
- Criterio: `docs/art-direction/ui-kit-b.md` §6.1 (reglas), §6.2 (KH único),
  §7.2 (que se reconozca a 32 px sin etiqueta) y §8.

## Veredicto: `REGENERAR` (1.ª revisión; superado por la 2.ª → `APROBADO 79/79`)

Hay que regenerar 2 íconos. Los otros 77 quedan aprobados tal como están
(celda y arte), así que la revisión que viene es solo de esas 2 celdas. Con eso
en verde, este archivo pasa a `APROBADO` y se puede abrir C2 (R43).

| id | Qué falla | Indicación para regenerar |
|---|---|---|
| `blueprint` | Es un pergamino enrollado y atado con cordel. A 32 px no se distingue de `scroll` ni de `quests`, y los tres son rollos crema en diagonal. `blueprint` es un recurso: va junto a `scroll` en `PassPanel` (cabecera y recompensas) y en la lista de venta de `MarketplacePanel`. | Pliego de planos **desplegado y plano**, no enrollado. Vista ¾ leve. Papel hueso con trazado de planta de una torre en tinta sepia: líneas y cotas sin letras ni números. Dos esquinas enrolladas y contorno negro grueso. Un solo objeto: sin compás, sin pluma, sin cordel. Tiene que leerse como una hoja rectangular, no como un rollo. |
| `sun` | El disco viene con una nube delante, y eso son dos objetos (rompe §6.1-1); además se lee como «parcialmente nublado» y no como «de día». Los rayos están sueltos (QA: 8 componentes) y a 28-32 px quedan como motas sueltas alrededor del disco. | Disco solar de latón y hueso **sin nube**. Los rayos son triangulares, cortos y **unidos al disco**, como una corona dentada que forma una sola silueta conexa. Luz desde arriba a la izquierda y canto cálido. Sin cara, sin halo y sin resplandor horneado (el brillo, si hace falta, va en CSS con `kh-ember`). Tiene que contrastar con `moon` (creciente hueso), que está aprobada. |

Presupuesto: una sola llamada de `gen_art_b.js` (hoja 3×3, se usan 2 celdas)
≈ 0,14 USD. Se procesa con `process_icon_sheets.js`, se vuelve a ensamblar y se
regenera la hoja de contacto. Las celdas de los demás íconos no se tocan.

## 2.ª revisión — 2026-10-21 — `APROBADO 79/79`

Revisé `specs/ui_kit_b/evidencia/iconos_regen.webp` (blueprint, scroll, quests y sun
a 24/32/48 px) y las celdas procesadas a 192 px (`art-b/uikit/proc/`), commit `25e3040`.

- `blueprint`: pliego **desplegado y plano**, papel hueso con torre almenada y cotas
  en sepia, sin letras, bordes enrollados, contorno negro, sin cordel, compás ni
  pluma. A 32 px se lee como hoja rectangular y se distingue de `scroll` y `quests`
  (rollos en diagonal). La gotita roja del papel es una mancha, no un segundo objeto.
- `sun`: disco de latón con corona de rayos triangulares cortos **unidos** al
  disco (1 silueta conexa), sin nube, sin cara, sin halo. Contrasta con `moon`.

Puerta T22 cerrada: los 79 íconos están aprobados. Se puede abrir C2 (R43), y la
condición de uso de los edificios sigue vigente (≥ 40 CSS px, siempre con el nombre al lado).

## Lo que señaló Central, confirmado o descartado

- **`gear` es una llave → está bien así, no se regenera.** Es lo que decidió la
  dirección de arte: §6.1 regla 1 («Ajustes = una llave») y §8 («nada de
  engranajes», que son un resto sci-fi). El id `gear` se conserva por el
  contrato de 65 nombres. La llave se lee clara a 24 px.
- **Edificios a 24 px casi ilegibles → es cierto, pero no bloquea.** 24 px
  queda por debajo del mínimo de uso (§6.1 regla 6: 28 CSS px; por debajo, solo
  texto), así que no es criterio de aceptación. A 32 px se leen castle,
  farmhouse, market, tower, tavern, mill, trap, barn, smithy, library y embassy.
  Quedan flojos `barracks` (bloque bajo y ancho), `wall`, `farm_plot` y `mine`,
  y `stable` y `sawmill` se parecen entre sí. Son recortes del arte B del hub,
  ya aprobado: regenerarlos con IA es la alternativa 5 que el diseño
  descartó. **No se regeneran**, pero dejo una condición de uso para C2/C3:
  los íconos de edificio van a **≥ 40 CSS px y siempre con su nombre al lado**
  (paneles de construir y tarjetas), nunca en barras ni rieles a 28-32 px.
  `library` trae la ventana verde del arte del hub; se mantiene así para que
  coincida con el edificio del hub, y no cuenta como un objeto común de §6.1-4.
- **Enemigos legacy muy oscuros sobre roble → es cierto, y queda aceptado por
  Q3.** Además del contraste bajo tienen brillos verde-azulados (`aullador`,
  `coloso`, `devorador`) y un halo (`heraldo`), justo lo que §8 prohíbe en el
  set B. Ningún componente los usa hoy con `SpriteIcon`
  (`CombatInstancePanel` dibuja los PNG de `/assets/game/enemies/`), así que no
  se mezclan con el set B en ningún panel. Se quedan como deuda de `combate_b`,
  sin parches de CSS.

## Dudas del implementer

- **`sun`, rayos sueltos:** son un problema, y además viene con la nube. Va a
  regenerar (tabla de arriba).
- **`kh_token` contra `gold` a 24 px:** se distinguen, coincido con Central.
  `kh_token` es un medallón de bronce, uno solo, con gavilla, corona y una gota
  de lacre rojo que cae; `gold` es una pila de monedas amarillas brillantes.
  Silueta, color y número de piezas son distintos. Cumple §6.2 y R45.
- **Íconos nuevos (alliance, rankings, quests, tech, world, shield, hammer,
  moon): aprobados todos.** Ninguno trae halo, texto, marco, círculo horneado
  ni verde, y todos tienen la luz desde arriba a la izquierda.
  - `alliance`: estandarte rojo en asta, se lee a 32 px.
  - `rankings`: corona de laurel de bronce. Es fina y de bajo contraste a
    24 px, pero a 32 px se lee.
  - `quests`: pergamino con lacre rojo. Se distingue de `scroll` por el sello
    rojo grande; en C3, Misiones usa `quests` y no `scroll`.
  - `tech`: libro de cuero con cierre (Tratados).
  - `world`: globo de latón sobre pie, renacentista y acorde al tono.
  - `shield`: rodela con umbo y aro de latón. El círculo es el objeto en sí,
    no un marco.
  - `hammer`: martillo solo, un único objeto (§6.1-1). Es el ícono de
    Construir.
  - `moon`: creciente hueso, clara.

  Con esto queda respondida la Q5 del diseño: confirmo la lista de motivos de
  §7.2.

## Resto del set (generados y reaprovechados)

Los aprobé tal cual: recursos, cultivos, animales, armas y acciones/UI.
Respetan §6.1: el hierro y el martillo tienen canto iluminado, no hay verde de
la Mácula y no hay marcos. Las parejas que podían confundirse se distinguen:
`gem` (rubí) con `crystal` (esquirla ámbar), `star_currency` (una moneda con
estrella) con `gold` (pila con corona), y `medal` con `reward_bag`.
