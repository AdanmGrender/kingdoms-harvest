# Puerta de arte — key art del menú y fondos de mapa (pantallas_b T11)

- Fecha: 2026-10-30
- Generado por: implementer, vía web gratuita de Gemini (`scripts/gen_art_web.js`, decisión del owner por falta de crédito API).
- Hoja de contacto: `specs/pantallas_b/evidencia/arte/contacto_arte.webp` (key_art | marca | reinos, 3 columnas).
- Capturas con arte: `specs/pantallas_b/evidencia/despues_arte/` (menú, Sistema, Galaxia × 360×740, 360×800, 412×915).
- Manifest y reprocesado: `art-b/menu/manifest.json`, `art-b/menu/process.js` (crudos PNG fuera del repo, en `D:/Proyectos/_ops/art-raw/pantallas_b_menu/`).
- Referencia de estilo enviada: `client/public/assets/b/bg/combat_crypt.webp` (la web solo admite una ref).

## Veredicto p-kh (2026-10-31): `REGENERAR key_art` · `marca` y `reinos` APROBADOS

Revisión a ojo de la hoja de contacto, los tres webp a tamaño completo y las 9 capturas de `despues_arte/`, comparando con `hub/base.webp`. Además medí el verde por píxel (sharp): 0 % de píxeles con G > R+5 y 0 % con tono 75–165° saturado en los tres archivos, igual que `hub/base.webp`.

| Pieza | Texto/letras | Verde | Estilo | Composición | Veredicto |
|---|---|---|---|---|---|
| `map/marca.webp` | Ninguno. Hay anillos, radios, estrellas sueltas y un disco solar. Sin rosa de vientos con letras ni números. | No | Carta grabada en tinta sobre pergamino umber, con viñeta de rayado cruzado. Es coherente con B. | Tranquila y de bajo contraste. Bajo la capa 0,78 queda como textura sutil (6–7 % de píxeles distintos) y no compite con los nodos. | **APROBADO** |
| `map/reinos.webp` | Ninguno. Hay estrellas, trayectos punteados y niebla. | No (el gris de la niebla es neutro/umber; medido) | Grabado con rayado en la niebla y en la viñeta. Es coherente con B. | Lo más cargado (la niebla) está en la mitad inferior, que en el panel cae detrás de los nodos, pero bajo la capa 0,78 queda muy apagado y no se nota. Lee bien. | **APROBADO** |
| `menu/key_art.webp` | Ninguno | No | Tinta con aguada plana. Tiene menos rayado que el hub, pero es de la misma familia. Por sí solo pasaría. | **No cumple.** Ver abajo. | **REGENERAR** |

### Por qué se regenera el key_art

El prompt dejó calmos el tercio superior y el inferior, pero `MainMenu.jsx` centra el bloque en vertical (`flex … justify-center`). En las tres capturas el bloque de título y botones ocupa la franja central:

| Captura | Tagline | Línea «Comandante…/vdev» |
|---|---|---|
| 412×915 | ≈ 29 % | ≈ 71 % |
| 360×800 | ≈ 26 % | ≈ 74 % |
| 360×740 | ≈ 25 % | ≈ 75 % |

El torreón ocupa casi exactamente esa franja: el brasero empieza en ≈ 22 % y la base de los muros llega a ≈ 71 % de la imagen. Con `cover`, en esos tres aspectos la imagen se ajusta por altura, así que esos porcentajes valen tal cual. El resultado:

- el título y los botones tapan el castillo, que queda como un ruido de almenas y cadenas detrás del texto;
- la llama del brasero cae justo detrás de «…SOLO LA COSECHA»;
- las zonas calmas (cielo arriba, escombro abajo) quedan vacías, sin nada encima.

La legibilidad pasa por la capa `ink` 0,7 (R22 medido), pero el key art no se ve: es justo lo contrario de lo pedido. Además, el torreón sale casi intacto, cuando el prompt pedía uno en ruinas.

**Qué cambiar en el prompt** (`art-b/menu/manifest.json`, id `key_art`, mismo aspect 9:16 y ref). El sujeto baja al cuarto inferior y la franja del 22 % al 76 % queda calma:

> title-screen key art for a dark-fantasy kingdom-builder, portrait composition, woodcut engraving with dense ink cross-hatching and muted earthy wash: a ruined gothic bastion keep with broken towers, a collapsed curtain wall and a tall brazier burning on its roof, small and distant, standing on a low rocky ridge along the VERY BOTTOM of the frame — the whole keep, brazier included, fits inside the lowest quarter of the image (nothing of it above 76 % of the height from the top). Everything between 22 % and 76 % of the height is open, calm, dark overcast sky of sepia and umber with only faint smoke and very low contrast, no towers, no birds, no embers there. The top fifth may hold heavier dark clouds. A thin rust-orange glow on the horizon right behind the keep, a few drifting embers only near the brazier. No green anywhere. No text, no letters, no logo, no frame, no border, no figures

Si al regenerar el modelo vuelve a subir el castillo hasta la franja central, hay otra salida, que decide el leader porque toca T9 ya cerrada: mover el bloque del menú (por ejemplo `justify-end` con margen inferior) en vez de regenerar. La recomendación sigue siendo regenerar.

### Observación fuera del alcance de T11 (para el reviewer)

En Sistema y Galaxia, el subtítulo del panel («Extendé tu dominio plaza a plaza», «Cruzá el Velo por los Caminos Velados») cae sobre el marco de latón y la ventana con rejas del fondo del overlay, y casi no se lee. Pasa igual en `despues/` (sin arte), así que no lo causan `marca`/`reinos`. En Galaxia, además, las etiquetas de los nodos muestran solo la primera palabra del nombre («Abismo», «Fragua»), así que el último nodo queda como «El», que no dice nada.

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

## Ronda 2 (2026-10-31) — `key_art` regenerado, pendiente de veredicto de p-kh

- Solo se regeneró `menu/key_art.webp` (1 llamada web, `gen_art_web.js --only key_art --force`, mismo aspect 9:16 y misma ref). `marca` y `reinos` no cambian (re-procesados: bytes idénticos, `git status` sin cambios en ellos). La versión anterior queda en `D:/Proyectos/_ops/art-raw/pantallas_b_menu/key_art_v1.png` (fuera del repo).
- Prompt: el que dejó p-kh arriba, tal cual, ya en `art-b/menu/manifest.json` (id `key_art`).
- Nota de entorno: `msedge` no está en la ruta de Playwright; se lanzó con un wrapper local (fuera del repo) que fuerza `executablePath` de EdgeCore 156. `gen_art_web.js` no se tocó.
- Archivo: `client/public/assets/b/menu/key_art.webp`, 768×1376, **60,6 KB** (≤ 250 KB).
- Hojas para mirar: `evidencia/arte/contacto_arte.webp` (key_art | marca | reinos) y `evidencia/arte/contacto_menu_con_arte.webp` (menú con arte en 360×740 | 360×800 | 412×915). Capturas: `evidencia/despues_arte/*__menu.webp` (reemplazadas; Sistema y Galaxia no cambian).
- **El implementer no tiene visión de imagen**: lo de abajo son mediciones, no sustituyen la mirada de p-kh. Hay que confirmar a ojo: sin texto horneado, sin verde, castillo en ruinas en el cuarto inferior, cielo calmo detrás de título y botones, estilo coherente con B.

### Mediciones (`art-b/menu/perfil_vertical.js` → `evidencia/arte/perfil_vertical_key_art.json`)

Energía de borde (gradiente medio de luminancia) y luminancia por banda del 5 % de alto:

| Franja | v1 (anterior) | v2 (nueva) |
|---|---|---|
| 25–75 % (detrás del bloque del menú): bordes / lum | 15,6 / 60,7 | **0,6 / 86,4** |
| fuera (0–20 % y 80–100 %): bordes / lum | 3,4 / 35,0 | 11,5 / 58,4 |

- Todo el detalle está ahora en 75–100 % (bordes 7–23 por banda); la banda 25–75 % queda lisa (bordes ≤ 2,1 salvo 70–75 %). Píxeles cálidos brillantes (llama, R>180 y R>G+40): 0 % por encima del 75 %, 1,05 % en 75–80 % (la llama arranca en el borde del cuarto inferior, no en la franja del menú).
- Riesgo a mirar: la franja calma es **lisa y algo más clara** (lum 80–104) que la v1 (cielo plano de aguada, casi sin rayado), por lo que puede leerse «vacía»; si p-kh la quiere con rayado denso, hay que pedirlo en otra vuelta.
- **R22** (contraste de texto con la capa `ink` 0,7, por tercio; `contraste_menu.json`): `bone` p95 9,7–11,3; `brass-light` p95 6,9–8,1; `bone-dim` p95 4,9–5,7 y p99 4,6–5,3 → todo ≥ 4,5 incluso en el 1 % más claro.
- Capturas: 3 dispositivos, `errores: []`, `nBotones` 2 (igual que antes), `botonesBajo44` vacío. Media de luminancia de la captura del menú con arte: 44–46 (con v1: ver `comparacion_capturas.json` de bfd37cd).
- Servicios de captura (Vite :5173 y server :3001 propios, con `SKIP_AUTH`) bajados al terminar; no se tocaron :3101 ni :5180.

### Si p-kh dice `REGENERAR` otra vez

Alternativa ya propuesta arriba: mover el bloque del menú (`justify-end` con margen inferior en `MainMenu.jsx`), decisión del leader porque toca T9.
