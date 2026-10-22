# Aprobación de arte — hub_b_tramos_nivel

## Prueba (barn)

- Fecha: 2026-10-22
- Autor: p-kh
- Hoja: `specs/hub_b_tramos_nivel/evidencia/tramos_prueba.webp` (de izquierda a derecha: bajo existente, medio, alto, obra),
  revisada entera y cada webp por separado a tamaño real (`client/public/assets/b/buildings/barn_{medio,alto,obra}.webp`).
- Chequeos automáticos: `evidencia/tramos_prueba_verify.txt` (R13–R17: 3/3 OK, 78 KB en total). Pasar el script no alcanza:
  la puerta es R18/R19.

### Veredicto: `REGENERAR alto`

| Variante | Veredicto | Por qué |
|---|---|---|
| `medio` | APROBADO | El mismo granero que el bajo: misma silueta de dos aguas con el anexo a la izquierda, mismo portón doble abierto con sacos, misma puerta del henil. Se lee como mejora (zócalos y pilares de piedra, flejes de hierro, tejado de tejas completo, anexo cerrado) y a 412 px se distingue del bajo. Paleta B, sin verde ni texto. |
| `obra` | APROBADO | La silueta del bajo se reconoce enseguida. Muestra andamios, escaleras, lonas, cabios a la vista en medio tejado, polea, piedra apilada y tablones al pie. "Piedra a medio poner" está como bloques apilados y no como muro a medio levantar; para el barn alcanza, que es de madera. Sin verde ni texto. |
| `alto` | REGENERAR | Ver abajo. |

Por qué se regenera `alto` (respuesta a lo que preguntó Central):

1. **No se reconoce como el mismo granero (R18).** Perdió lo que lo identifica: el portón doble abierto con los sacos se
   cambió por una puerta de casa angosta con un brasero; la fachada tiene entramado, escudos y ventanas encendidas, y se lee
   como casa gremial o capilla, no como granero. Además el anexo de la izquierda se volvió un cuerpo aparte.
2. **Silueta más angosta.** Aspecto al 85 % del bajo, justo en el límite de R15. Como `process.sh` escala a la misma altura,
   cada punto que se pierde de aspecto es huella que se pierde: en el hub el granero "adelgaza" al subir de nivel. El prompt
   lo provocó al pedir "tall heraldic banners" e "imposing": la IA lo resuelve haciéndolo más alto.
3. **Techo verde (R19).** El musgo verde oliva cubre todo el faldón. Es apagado, pero es la mancha de color más grande del
   sprite y viola "verde **solo** para magia o corrupción (la Mácula), nunca en objetos comunes"
   (`docs/art-direction/guia-manual-arte.md`, checklist; `docs/art-direction-b.md` §1). Si se repite en los 17 `alto`, el
   pueblo en su mejor momento parecería tomado por la Mácula, que es lo contrario de lo que tiene que comunicar.

Indicación para regenerar `tier_barn_alto` (cambiar el texto de "Version:" en `art-b/tramos/manifest.json`):

> Version: TOP-LEVEL upgrade. The SAME barn as the first reference, rebuilt rich and solid, NOT a house or a hall: keep the
> wide gabled body, the lean-to annex on the left, the big double barn doors wide open in the same place showing grain sacks
> inside, and the hayloft door above with a hoist beam. Upgrade by materials, not by shape: dressed stone lower walls and
> corner piers, heavy dark carved timber frame, iron and tarnished-brass fittings, a sound roof of slate-grey and rust-umber
> tiles, a lantern glowing candle orange by the doors. Keep it as wide and low as the reference: no towers, no tall banners,
> no extra height. No green anywhere: no moss, no lichen, no ivy.

Después de regenerar: `process.sh barn`, `verify_tiers_b.js barn`, hoja nueva y segunda revisión solo de la celda `alto`
(R23). `medio` y `obra` no se tocan.

### Reglas de prompt para los 17 edificios

Salen de esta prueba y valen para las 48 restantes (y para la nueva `alto` del barn):

1. **Mejorar con materiales, no con forma.** `medio` y `alto` conservan la silueta, la huella y el **rasgo funcional que
   identifica al bajo** (granero: portón doble abierto con sacos y puerta del henil; molino: aspas; herrería: fragua y
   chimenea; etc.), en el mismo lugar. Cada prompt de `medio`/`alto` nombra ese rasgo de forma explícita ("keep the …").
2. **Progresión de tramo:** bajo = madera gastada, precaria → medio = madera + zócalos de piedra, flejes de hierro, tejado
   entero, a lo sumo un anexo → alto = piedra labrada abajo, madera tallada oscura, herrajes de hierro/latón deslucido, una
   luz naranja vela. El `medio` aprobado del barn es la referencia del salto que se espera.
3. **Nada que lo haga más alto ni más angosto:** sacar "tall heraldic banners", "imposing", "majestic", torres o pináculos de
   los prompts de `alto`; en su lugar, "as wide and low as the reference". Revisar de cerca cualquier `medio`/`alto` con
   aspecto por debajo del 92 % del bajo aunque pase el ±15 % de R15: suele ser síntoma de silueta perdida.
4. **Cero verde en el prefijo común de los 51 prompts:** agregar al "STYLE MATCH" "no green anywhere: no moss, no lichen,
   no ivy, no green glow"; los tejados en gris pizarra, umbra, óxido u ocre.
5. **Heráldica:** como mucho, un estandarte o escudo chico y plano contra la pared, sin emblema reconocible (R19). Nunca como
   elemento principal de la fachada.
6. **Obra** (el barn la resolvió bien): la silueta del bajo, con andamios y escaleras alrededor, lonas, cabios a la vista en
   parte del tejado, polea, bloques de piedra y tablones apilados al pie. En edificios de piedra (torre, muralla, sala del
   trono, mina…) pedir además "a stretch of wall half laid, stones missing in a stepped edge", que en el barn quedó flojo.
