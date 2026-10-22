# Review — `ui_kit_b` · Etapa A (T1–T8)

Revisado: rama `feature/ui_kit_b`, commit `aae5a22` (diff contra `ab85126`). Tarea `t_c345f95c`, revisión de etapa (no de feature).

## Veredicto

**APPROVED — solo etapa A.** La feature `ui_kit_b` sigue `in_progress`: no se toca `feature_list.json` ni `CHANGELOG.md`. Etapas B (T9–T17) y C (T18–T34) siguen pendientes por diseño.

Condición abierta, no bloquea A: **R13 (veredicto de dígitos)** sigue `PENDIENTE` (Q2, p-kh). Bloquea T14 (etapa B), no el cierre de A. Ver Trazabilidad.

## Trazabilidad (R1–R16)

| R | Evidencia verificada | Estado |
|---|---|---|
| R1 | `grep` de `googleapis\|gstatic` en `client/index.html`, `client/src`, `client/tailwind.config.js` → solo aparece dentro del propio barrido de `client/src/tests/fontsConfig.test.js:55`. `index.html` usa `/fonts/fonts.css`. | OK |
| R2 | `client/index.html:9` `<link rel="stylesheet" href="/fonts/fonts.css" />`; `specs/ui_kit_b/evidencia/prod_fuentes.json` `fontsCheck` true en las 3 familias. | OK |
| R3 | `client/public/fonts/fonts.css`: exactamente 4 `@font-face` (Alegreya Sans SC 700, IM Fell English SC 400, IM Fell English 400 italic y normal); cada `url()` existe en `client/public/fonts/`. | OK |
| R4 | Grep de `MedievalSharp\|Cinzel\|Alegreya Sans(?! SC)` en `client/src`, `index.html`, tailwind y fonts.css → vacío fuera de los tests. `grep fontFamily.*medieval` en `components/` → vacío. | OK |
| R5 | `ls client/public/fonts`: 4 woff2 + `fonts.css` + `README.md`. `README.md` lista solo IM Fell y Alegreya Sans SC (OFL). | OK |
| R6 | `client/tailwind.config.js:4-17` `const kh` con los 13 hex; coinciden con `fontsConfig.test.js` (KH). | OK |
| R7 | `client/tailwind.config.js:20,37-42`: `display`, `body`, `numeric` con `serif` de respaldo, `medieval` alias de `display`. | OK |
| R8 | `client/src/styles/index.css:12-15`: `IM Fell English`, 15px, `#14110d`, `#e6dcc3`; sin `Segoe UI`. | OK |
| R9 | 38 archivos de `components/**` migrados a `font-display`. Ver nota de regresión visual abajo. | OK |
| R10 | `client/src/game/fonts.js:5` `UI_FONT`; importado en `BootScene`, `NPC`, `Building`, `ParticleSystem`, `IsoWorldScene`. | OK |
| R11 | `client/src/game/fonts.js:11-25` `loadUiFonts`; `BootScene.js` crea los textos dentro de `loadUiFonts().then(...)`. `fonts.test.js` 5/5. | OK |
| R12 | `fonts.js`: timeout 3000 ms con `Promise.race`, `.catch(() => {})`, nunca rechaza. Cubierto por `fonts.test.js`. | OK |
| R13 | `evidencia/digitos.md` + `digitos_im_fell.webp` + `digitos_numeric.webp` presentes; sin desborde 172/172. **Veredicto: PENDIENTE** (Q2 de p-kh). | PARCIAL (no bloquea A) |
| R14 | Depende del veredicto de R13. Etapa B. | N/A en A |
| R15 | `tailwind.config.js:28-35` `kingdom.*` → `kh.*`; clases `kingdom-*` intactas. `npm run build` OK. | OK |
| R16 | `prod_fuentes.json`: `fuentesExternas: []`, `cspViolaciones: []`; `consola_prod.txt` pageerrors 0, console.error 0. Caveat en "Observaciones". | OK (con caveat) |

Tasks: T1–T8 todas `[x]` con `Evidencia:` inline. T9–T34 `[ ]`, esperado para revisión de etapa A. `## Bloqueado` vacío.

## Verificación ejecutada (reproducida por el revisor)

- `cd client && npx vitest run`: 11 files, 208 passed.
- `cd client && npm run build`: OK (solo aviso de chunk > 500 kB, preexistente).
- `cd server && npx jest --runInBand --forceExit`: 25 suites, 388 passed en la corrida 2 y 3. **La corrida 1 tuvo 1 fallo (1 of 388)**, no reproducido después. `git diff ab85126 aae5a22 -- server shared` vacío, así que es flakiness. Ver Cambios requeridos (no bloqueante).

## Diff contra architecture y conventions (archivo:línea)

- Regla 8 de `architecture.md` (tipografía empaquetada, sin Google Fonts): cumplida (`index.html:9`, `fonts.css`).
- Regla 3 (Phaser ↔ React solo por EventBridge): `fonts.js` es un módulo puro; no crea dependencias Phaser↔React.
- Convenciones de comentarios en español y commit `feat(ui_kit_b)`: cumplidas.
- `BootScene.js`: el primer texto se crea tras `loadUiFonts`; el `progress` queda protegido con `if (percentText)`. Correcto.
- Lógica de cliente pura: sin cambios de store, services ni server (`git diff --stat` vacío en `server`, `shared`).

## Observaciones (no bloqueantes)

1. `client/src/components/hud/TopResourceBar.jsx:99`: quedó `style={{ maxWidth: '70px' }} >` con espacio antes del `>`. Estilo menor; corregir en la etapa B al tocar el archivo.
2. R16 / T8: la prueba de prod no usó el server real con `NODE_ENV=production` (rechaza `SKIP_AUTH`). Se sirvió `client/dist` con la CSP copiada de `server/src/index.js` y proxy a un server dev. Aceptable como evidencia de etapa A, pero la CSP real no se verificó contra el server de producción. Hay que cerrarlo en T17 o en T34.
3. `client/src/tests/fontsConfig.test.js`: los tests de R1/R4 leen archivos (barrido de fuentes). Lo exige R1 del spec. Es aceptable.
4. `client/src/components/**`: 38 migraciones a mano/script de `fontFamily` a `font-display`. Riesgo visual pequeño; la captura `hub_antes` vs `despues` (T33) es el control.
5. `jest` flaky: 1 fallo en la primera corrida. Vigilar en T17/T34. Si reaparece, abrir entrada en `known_failures`, no ignorarlo.

## Cambios requeridos

Ninguno para cerrar la etapa A.

Antes de T14 (etapa B), obligatorio:
- R13: registrar el veredicto de p-kh/owner (`im-fell` o `font-numeric`) en `specs/ui_kit_b/evidencia/digitos.md`. Central debe confirmar que la tarea `[KH][arte]` existe y está linkada como padre de `t_c345f95c`. El campo `parents` de la tarea solo muestra `t_64749793`, así que el link no consta.

Para B/C:
- Corregir el espacio sobrante de `TopResourceBar.jsx:99` al tocar el archivo.
- Cerrar T8/R16 contra el server real o dejar constancia explícita.
- Si jest vuelve a fallar, registrar el test en `known_failures` con evidencia.

## Nota de proceso

La revisión es de etapa. No se marcó `done` en `feature_list.json` ni se añadió línea al `CHANGELOG.md`, porque la feature no está terminada. El cierre final de `ui_kit_b` (B y C) pasará por una revisión nueva.
