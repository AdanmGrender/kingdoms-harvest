# Review — fix_superposiciones_ui (#26, sdd:false)

Revisor: `reviewer` · Ronda 1 (lente artefacto, luego ejecución) · Rama `feature/fix_superposiciones_ui` @ 6c5592d

## Veredicto
**APPROVED**

## Trazabilidad
Feature `sdd:false`: no hay `R<n>` ni `tasks.md`. Mapeo de S1–S5 (`D:\Proyectos\_ops\capturas\2026-10-28-01-11_base\HALLAZGOS.md`) a cambio y evidencia:

| S | Cambio verificado en el diff | Evidencia |
|---|---|---|
| S1 píldora de clima sobre HUD | `StormBanner.jsx:30-47`: `top-10` → `top-[176px]`, `max-w-[calc(100%-10rem)]`, nombre `truncate` | `evidencia/README.md` (S1); test `superposicionesUi.test.jsx` S1 |
| S2 «Objetivo:» desaparece < 400 px | `QuestRail.jsx:18-26`: sin `hidden`, `min-h-11`, `line-clamp-2` | `evidencia/README.md` (S2); test S2 |
| S3 árbol de investigación cortado | `TechTreePanel.jsx:46-52,81,84`; `Panel.jsx:35-37` (`min-w-0 break-words`, `px-1`) | `evidencia/README.md` (S3); test S3 |
| S4 filtros de Logros cortados | `AchievementPanel.jsx:121`: `overflow-x-auto` → `flex-wrap` | `evidencia/README.md` (S4); test S4 |
| S5 íconos/subtítulos Configuración | `SettingsPanel.jsx:129,132,138,173,185`: `moon`, `sun`, `scroll`, `tide`; `line-clamp-2` | `evidencia/README.md` (S5); test S5. Íconos confirmados en la lista de `iconSheet.test.js:32-37` |

Alcance: el diff no toca h-screen/100vh ni safe-area, ni paleta, ni arte nuevo. Sin Gemini. Cumple «Hacer 1».

## Tasks
Sin `tasks.md` (sdd:false). Pasos del card:
- 1 (S1–S5 aditivos): cumplido, ver tabla.
- 2 (evidencia antes/después): `evidencia/` con webp antes/después y README con una línea por S. Las hojas de ``despues`` están en `D:\Proyectos\_ops\capturas\2026-10-28-01-59_fix26_despues`. La captura «antes» de la píldora de clima no se generó (el implementador lo anotó). Aceptado: S1 se midió por DOM y se documentó.
- 3 (tests): `superposicionesUi.test.jsx` 5/5 pasan (ejecutado por el revisor). `iconSheet.test.js` falla en el worktree por `Cannot find module 'sharp'`; con `NODE_PATH=D:/Proyectos/kingdoms-harvest/node_modules` pasa 15/15 (ejecutado). Es entorno, no el diff. No se borró ni salteó ningún test.
- 4 (feature_list id 26): presente, JSON válido. Cambiado a `done` en la aprobación.
- 5 (review request): hecho.

## Ejecución (revisor)
- `npx vitest run src/tests/superposicionesUi.test.jsx` → 5 passed.
- `NODE_PATH=... npx vitest run src/tests/iconSheet.test.js` → 15 passed.
- `known_failures` está vacío (`feature_list.json:18`); la suite completa del implementador (320) no se volvió a correr entera.

## Observaciones no bloqueantes
1. Tests de clases (`superposicionesUi.test.jsx:19-80`): afirman strings de `className`, no layout real. jsdom no calcula posiciones; la verificación real de S1–S4 es la captura. Aceptable para `sdd:false`, pero no es prueba de que el banner ya no se encime. Anotado como límite.
2. `Panel.jsx:35` agrega `px-1` a la cabecera de **todos** los `Panel` con título o `onClose`. Efecto global, no solo de Investigación. Revisar en el barrido visual de F9.
3. `StormBanner.jsx:30` usa `top-[176px]` como valor mágico acoplado a las alturas de TopResourceBar y QuestRail. Registrado en PAQUETE.md (Decisiones).
4. Archivos sin trackear en el worktree, fuera del commit: `client/vite.worker.config.js`, `vite_worker.log`, `vitest.log`. No se commitearon, pero hay que borrarlos antes del merge.
5. Revisión visual de las hojas: no la hice (no puedo ver imágenes con mis herramientas). Pendiente para Central, como pidió el card.

## Cambios requeridos
Ninguno.
