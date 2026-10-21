# Review — `hub_b_recoleccion`

## Veredicto

PENDIENTE (escalado a needs_input). Funcionalmente todo verifica; falta la confirmación visual de los assets (R13, R12), que el reviewer no puede hacer (no inspecciona imágenes). No se aprueba hasta que un humano revise `evidencia/pickups_contacto.webp` y las capturas.

## Trazabilidad

Revisado en rama `feature/hub_b_recoleccion` (commit da07d41), contra `feature/hub_b_escena`.

- R1–R6, R9, R24: `selectPickups` y `createPickupController` (`client/src/game/hub/hubPickups.js:25-58`, `:82-108`); cubierto por `hubPickups.test.js`. Verificado: 54/54 tests de `hubPickups.test.js`, `pickupSources.test.jsx`, `gameStore.test.js` en verde.
- R7, R8: `client/src/services/socketService.js:35,49` (loadAnimals / loadPlots). Test en `pickupSources.test.jsx`.
- R10, R11, R12, R14: `HubSceneB.js:487-529` (posición, balanceo, placeholder `hubb_pickup_placeholder` en `:147`). Evidencia Playwright `recoleccion_main.json` (`dentroZonaSegura:true`, `depthBajoFog:true`) y `recoleccion_fallback.json`.
- R13: `art-b/pickups/manifest.json` (4 ítems, STYLE MATCH); 4 webp en `client/public/assets/b/pickups/`. Revisión visual: NO verificada (ver Bloqueo).
- R15, R16, R19, R23: `hubPickups.js:110-134`; tests de doble tap, rechazo y `null`. Evidencia de red en `recoleccion_main.json` (1 POST a `/api/farm/harvest {plotId:1}`; 1 POST a `/animals/collect`).
- R17: `HubSceneB.js:582-585` (objeto antes que edificio, return sin `entity:selected`). Evidencia `entityEventsPorEseTap: 0`.
- R18: `hubPickups.js:70-72`, `PICKUP_MIN_HIT=88`; test `pickupHitSize`.
- R20: `PICKUP_FLY_MS=600` (`hubPickups.js:12`), `flyPickup` `HubSceneB.js:549-566`; vuelo medido 607 ms.
- R21: `cssToWorld` sin punto → borde superior (`hubPickups.js:74-80`); test verde.
- R22: `gameStore.js:457` y `:503` (`refreshResources`); `gameStore.test.js` verde. Contador antes/después 30→34 en `recoleccion_main.json`.
- R25: `HubSceneB.js:593` sin cambios en la rama de edificio.
- R26: `git diff feature/hub_b_escena...HEAD -- server shared` = vacío.
- R27: `grep CROPS|ANIMALS|yield` en `hubPickups.js` y `HubSceneB.js` solo muestra un comentario (`hubPickups.js:14`).
- R28: `git diff ... -- client | grep '^+' | grep -c 'emit('` = 0.
- R29: `evidencia/fps_recoleccion.json` avg 171.6 / min 137.2 con 6 objetos (≥ 50).
- R30: `teardown` `HubSceneB.js:663-690`; test `dispose con respuesta tardía` verde.
- R31: `TopResourceBar.jsx:125` `data-resource={r.key}`.
- R32: `cd client && npx vitest run` → Test Files 1 failed | 7 passed (8); Tests 1 failed | 184 passed (185). Único fallo `GameHUD.test.jsx` "Lv5" = known_failure preexistente.
- R33: `evidencia/consola.txt` → pageerrors 0, console.error 0, http≥400 0.

## Tasks

- T1–T15: todas `[x]` con `Evidencia:` concreta. Ninguna en `## Bloqueado`.
- Evidencias reproducidas por el reviewer: vitest focal (54 passed) y suite completa (184/185, known_failure).

## Hallazgos (no bloqueantes)

1. Contadores ausentes para algunos recursos: `TopResourceBar` solo expone `wood, stone, wheat, iron`. Huevos, leche, lana y `carrot` (plot:2 del evidence) no tienen `data-resource`, así que vuelan al fallback de R21 (borde superior). Cumple R21 literalmente; R20 pide ir al contador del recurso. Caveat a declarar al owner. `recoleccion_main.json` tiene `destinoFallbackSinContador: null`, así que no queda documentado a qué destino voló el objeto animal.
2. Un objeto ya en vuelo (`disableInteractive`, `HubSceneB.js:558`) deja pasar el tap al edificio de debajo: el tap cae en `entity:selected:building`. R17 habla de objetos, no de vuelos; aceptable, pero anotarlo.
3. R14 se verifica solo por Playwright (`recoleccion_fallback.json`); no hay test Vitest de textura faltante. La evidencia pedida por la spec es la captura, así que no bloquea.

## Bloqueo

Falta la confirmación de revisión de los assets (`docs/conventions.md` §Verificación: "Assets generados ... + confirmación de revisión"). El implementador lo declara explícitamente pendiente (T3). Requiere a una persona que mire `specs/hub_b_recoleccion/evidencia/pickups_contacto.webp` (legibilidad a ~42 px, estilo `hub/base`, sin cabezas extra, recorte limpio) y las capturas `recoleccion_objetos.webp` / `recoleccion_6_objetos.webp`. Si el dueño acepta, se aprueba; si no, se regeneran los assets con `scripts/gen_art_b.js`.

## Cambios requeridos

Ninguno de código. Para aprobar: (a) confirmación visual humana de los 4 pickups y capturas; (b) decidir si los huevos/leche/lana/zanahoria tienen contador o si el fallback de R21 queda como comportamiento aceptado.
