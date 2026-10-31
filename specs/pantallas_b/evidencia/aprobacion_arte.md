# Puerta de arte — key art del menú y fondos de mapa (pantallas_b T11)

- Fecha: 2026-10-30
- Generado por: implementer, vía web gratuita de Gemini (`scripts/gen_art_web.js`, decisión del owner por falta de crédito API).
- Hoja de contacto: `specs/pantallas_b/evidencia/arte/contacto_arte.webp` (key_art | marca | reinos, 3 columnas).
- Capturas con arte: `specs/pantallas_b/evidencia/despues_arte/` (menú, Sistema, Galaxia × 360×740, 360×800, 412×915).
- Manifest y reprocesado: `art-b/menu/manifest.json`, `art-b/menu/process.js` (crudos PNG fuera del repo, en `D:/Proyectos/_ops/art-raw/pantallas_b_menu/`).
- Referencia de estilo enviada: `client/public/assets/b/bg/combat_crypt.webp` (la web solo admite una ref).

## Veredicto: `PENDIENTE` (esperando p-kh)

El implementer no emite el veredicto. La puerta de arte de p-kh es obligatoria aunque el arte venga del modelo web (el estilo puede variar respecto a la API). Criterios para p-kh: `docs/art-direction-b.md` (grimdark renacentista, paleta tierra, sin verde), zonas calmas en el menú para título y botones, mapas de baja intensidad para que el texto lea.

## Archivos

| Archivo | Tamaño | Dimensiones | Aspecto |
|---|---|---|---|
| `client/public/assets/b/menu/key_art.webp` | 111,8 KB | 768×1376 | 9:16 |
| `client/public/assets/b/map/marca.webp` | 105,3 KB | 768×1376 | 9:16 |
| `client/public/assets/b/map/reinos.webp` | 159,5 KB | 768×1376 | 9:16 |

Tope R23/R32: ≤ 250 KB → cumplido (webp q82, sin recompresión extra).

## Prompts textuales (los tres con ref `combat_crypt.webp`, aspect 9:16)

**key_art**
> title-screen key art for a dark-fantasy kingdom-builder, portrait composition: a ruined gothic bastion keep with a tall brazier burning on its roof, seen from below on a rocky rise at dusk, broken towers and a leaning curtain wall around it, a low cold sky of sepia and umber clouds with a thin rust-orange glow on the horizon, drifting embers. The upper third and the lower third are calm, dark and low-contrast (empty sky and dark rubble) so menu buttons and title text can sit on them; the keep is centered in the middle third. No green anywhere. No text, no letters, no logo, no frame, no border, no figures

**marca**
> background texture for a star-system map screen, portrait: an aged dark umber parchment chart engraved in ink, faint concentric orbit rings and thin compass lines, tiny hand-drawn stars and a dim sun disc off-centre, cross-hatched vignette darkening the edges, very low contrast and quiet in the middle so icons and text can be placed over it. Earthy umber, sepia, bone and rust palette, no green. No text, no letters, no numbers, no labels, no frame, no border, no figures, no creatures

**reinos**
> background texture for a map of fallen kingdoms across a dark void, portrait: an aged engraved ink chart of the night sky, scattered tiny stars and faint dotted travel paths, a torn veil of dark smoke-like fog drifting across the lower half, cross-hatched vignette darkening the edges, very low contrast and quiet in the middle so icons and text can be placed over it. Earthy umber, sepia, charcoal, bone and rust palette, no green. No text, no letters, no numbers, no labels, no frame, no border, no figures, no creatures

## Mediciones objetivas (no sustituyen la mirada de p-kh)

- **Mapas (R34)**, peor píxel tras la capa `rgba(20,17,13,.78)` (`evidencia/arte/contraste_mapas.json`): `bone` sobre peor píxel 10,08 (marca) y 9,97 (reinos); `bone-dim` 5,08 y 5,02 (≥ 4,5 en el peor píxel de toda la imagen).
- **Menú (R22)**, tras la capa `ink` 0,7 de `MainMenu.jsx`, por tercio vertical, percentil 95 de luminancia (`evidencia/arte/contraste_menu.json`): `bone` 9,3–12,2; `brass-light` 6,7–8,7; `bone-dim` 4,7–6,1 (p95) y 4,2–4,7 (p99, el 1 % más claro; solo la cima de las llamas/cielo).
- El fondo se pinta de verdad en la app: sonda con Chromium en 412×915, `background-image` del `kh-panel` = capa + `marca.webp` / `reinos.webp`; las tres URLs responden 200 (`evidencia/arte/sonda_fondo_mapas.txt`). Diferencia píxel a píxel contra la captura plana: menú 44–47 % de píxeles distintos; Sistema 6–7 %; Galaxia 9–10 % (`diff_capturas.json`).
- Sin verde en el prompt; no verificado por mirada (el implementer no tiene visión de imagen): **p-kh debe confirmar que no hay texto/letras horneadas, ni verde, y que las zonas calmas del menú caen detrás del título y botones**.

## Si p-kh dice `REGENERAR`

Editar el prompt en `art-b/menu/manifest.json` y correr (el perfil ya tiene sesión; no usar `--login`):
`NODE_PATH=D:/Proyectos/kingdoms-harvest/node_modules node scripts/gen_art_web.js --manifest art-b/menu/manifest.json --only <id> --force`, luego `node art-b/menu/process.js`. No hay que tocar código: `MainMenu` y `useMapBackground` pintan lo que haya en esas rutas.

Nota de entorno: `msedge` no está en la ruta estándar de Playwright en esta máquina; se lanzó con un wrapper local (fuera del repo) que fuerza `executablePath` de EdgeCore 156. No se modificó `gen_art_web.js`.
