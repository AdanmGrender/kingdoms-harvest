# Pipeline de Arte IA → Juego

> Flujo: **generar con IA → recortar/limpiar en Pixelorama → exportar PNG al
> path exacto → el juego lo muestra sin tocar código.** Paleta oficial:
> `docs/palette/kh-grimdark.gpl` (ya cargada en Pixelorama como "KH Grimdark").

## Bloque de estilo maestro (pegar al inicio de CADA prompt)

```text
isometric pixel art, dark gothic industrial fortress style, 2:1 isometric
view, deep dramatic shadows, rust and dried blood stains on stone, muted
grimdark palette (#4a443e stone, #332f2b dark stone, #b32821 blood red,
#d9a441 dirty gold, #4fd8c8 hologram teal, #e8933a candle orange, #4a4550
storm sky), single subject centered, plain solid dark background, no text,
no watermark, no logos
```

**⚠️ Regla de IP (el juego paga cripto real):** nada de águilas imperiales
bicéfalas, siluetas exactas de Space Marines, ni razas reconocibles de
Games Workshop. Calaveras, gótico-industrial y armaduras voluminosas
genéricas: SÍ. Si la IA genera un águila GW, se edita en Pixelorama.

## Tabla de assets (batch 1, en orden de impacto)

| # | Asset | Prompt específico (añadir al bloque maestro) | Canvas final | Path destino |
|---|-------|----------------------------------------------|--------------|--------------|
| 1 | Cielo tormenta | "stormy purple-grey sky over a ruined wasteland horizon, distant gothic ruins silhouettes, smoke columns, floating embers, wide panoramic" | 1024×512 | `client/public/assets/game/ambient/sky_storm.png` |
| 2 | Decals de suelo | "sprite sheet of 8 small ground stains: rust patches, dried blood pools, stone cracks, scattered bullet casings, on TRANSPARENT background, top-down flat" | 512×32 (8 frames de 64×32) | `client/public/assets/game/iso/decals.png` |
| 3 | Bastión de Mando | "command bastion building with glowing teal hologram table on a stone dais, banners, skulls on the walls" | 128×128 | `client/public/assets/game/buildings/throne_room.png` |
| 4 | Torreta Centinela | "automated twin-barrel sentry turret on a fortified stone tower, red warning light" | 128×128 | `client/public/assets/game/buildings/tower.png` |
| 5 | Fundición | "tech-shrine foundry with glowing red coolant tubes, chimneys, anvil" | 128×128 | `client/public/assets/game/buildings/smithy.png` |
| 6 | Terreno iso | "sprite sheet of 7 isometric diamond floor tiles 2:1 ratio: dark grass, grass, light grass, dirt road, cracked stone, toxic water, irradiated sand" | 448×32 (7 frames de 64×32) | `client/public/assets/game/iso/iso_terrain.png` |
| 7 | Trooper walk | "red armored heavy trooper with rifle, walking animation frames, 5 directions: front, front-right, right, back-right, back" | 128×240 (5 filas × 4 frames de 32×48) | `client/public/assets/game/iso/chars/trooper_walk.png` |

Los otros 14 edificios usan el mismo patrón que #3-5: un sujeto, 128×128, a
`buildings/<id>.png`. IDs y descripción temática: ver `shared/gameConfig.js`
BUILDINGS (name/effect ya están re-tematizados grimdark).

## Proceso en Pixelorama (por asset)

1. **Abrir** la imagen generada (`File → Open`).
2. **Escalar** al canvas final: `Image → Scale Image` → interpolación
   **Nearest** (¡nunca bilinear — emborrona el pixel art!).
3. **Limpiar el fondo**: varita mágica sobre el fondo sólido → Delete →
   verificar transparencia (cuadros grises).
4. **Retocar** con la paleta *KH Grimdark* (panel Palettes) — corregir colores
   fuera de paleta, borrar marcas raras de la IA.
5. **Exportar**: `File → Export` → PNG → **sobrescribir el path destino
   exacto** de la tabla.
6. Verificar en el juego: `node .claude/skills/run-kingdoms-harvest/driver.mjs`
   → abrir el screenshot.

## Sheets de animación (frames en grilla)

La IA nunca entrega el layout del juego (5 filas de dirección × N frames).
Para eso está el cortador:

```bash
# Corta una imagen IA en grilla y re-arma el sheet con frames de tamaño exacto
node scripts/slice_sheet.js entrada.png --grid 4x5 --frame 32x48 \
  --out client/public/assets/game/iso/chars/trooper_walk.png
```

- `--grid CxR` — columnas×filas de la imagen DE ENTRADA (cómo vienen los
  frames en la imagen IA).
- `--frame WxH` — tamaño final de cada frame (se escala nearest).
- El sheet de salida queda `C` columnas × `R` filas con frames de `WxH`.
- Layout del juego (docs/iso-art-architecture.md §2): fila 0=S, 1=SE, 2=E,
  3=NE, 4=N — el lado oeste lo hace el motor con flipX.

## Reglas de oro

- **Un PNG por slot, mismo path, mismo tamaño** — el juego no se toca.
- Los placeholders se regeneran con `node scripts/gen_placeholders.js` — si un
  arte queda mal, regenerar el placeholder lo "des-instala" al instante.
- Guardar los `.pxo` (proyecto con capas) FUERA de `assets/game/` — ahí solo
  van PNG finales.
- Anclas: edificios "pisan" en el 88% de su altura; personajes en el 100%
  (pies en el borde inferior del frame).
