# Review — `hub_b_recoleccion`

## Veredicto

APPROVED (ronda 2, reviewer). Revisado sobre commit `1bc9970`, rama `feature/hub_b_recoleccion`.

La confirmación visual pendiente de la ronda 1 ya está dada: la puerta de arte `t_8ae611b3` (p-kh, con revisión del owner sobre `evidencia/pickups_contacto.webp` y `evidencia/recoleccion_6_objetos.webp`) quedó aprobada para los 4 pickups (sack, egg_basket, milk_pail, wool_bale). R12 y R13 quedan verificados con esa evidencia.

Caveat aceptado por el owner y declarado en Hallazgos: huevos, leche, lana y zanahoria vuelan al fallback de R21 porque `TopResourceBar` no tiene contador para ellos.

## Trazabilidad

Revisado en rama `feature/hub_b_recoleccion` (ronda 2, commit `1bc9970`), contra `feature/hub_b_escena`. Diff de ronda 2: `aa2c545..1bc9970` (solo assets, scripts, evidencia y docs; sin cambios en client/src, server, shared).

- R1–R6, R9, R24: `selectPickups` y `createPickupController` (`client/src/game/hub/hubPickups.js:25-58`, `:82-108`); cubierto por `hubPickups.test.js`. Verificado: 54/54 tests de `hubPickups.test.js`, `pickupSources.test.jsx`, `gameStore.test.js` en verde.
- R7, R8: `client/src/services/socketService.js:35,49` (loadAnimals / loadPlots). Test en `pickupSources.test.jsx`.
- R10, R11, R14: `HubSceneB.js:487-529` (posición, balanceo, placeholder `hubb_pickup_placeholder` en `:147`). Evidencia Playwright `recoleccion_main.json` (`dentroZonaSegura:true`, `depthBajoFog:true`) y `recoleccion_fallback.json`.
- R13: `art-b/pickups/manifest.json` (4 ítems `kind: "prop"`, sin suelo, STYLE MATCH); 4 webp en `client/public/assets/b/pickups/`. Recorte reverificado en ronda 2: `node scripts/verify_alpha_b.js` → 4/4 esquinas alpha=0, borde 100 % transparente, 1 objeto por ícono, `TODOS OK` (exit 0). Revisión visual humana: puerta `t_8ae611b3` aprobada.
- R12: revisión visual humana dada en `t_8ae611b3` (ver arriba); evidencia Playwright `recoleccion_main.json` y `recoleccion_fallback.json`.
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
- R29: `evidencia/fps_recoleccion.json` avg 171.6 / min 137.2 con 6 objetos (≥ 50). Dato del implementador en `1bc9970`; esta ronda no cambió código de juego.
- R30: `teardown` `HubSceneB.js:663-690`; test `dispose con respuesta tardía` verde.
- R31: `TopResourceBar.jsx:125` `data-resource={r.key}`.
- R32: `cd client && npx vitest run` (reproducido en ronda 2) → Test Files 1 failed | 7 passed (8); Tests 1 failed | 184 passed (185). Único fallo `GameHUD.test.jsx` "Lv5" = known_failure de `feature_list.json:18-20`.
- R33: `evidencia/consola.txt` → pageerrors 0, console.error 0, http≥400 0.

## Tasks

- T1–T15: todas `[x]` con `Evidencia:` concreta. Ninguna en `## Bloqueado`.
- T2 y T3 actualizadas en ronda 2 (FIX de assets) con evidencia nueva: `evidencia/pickups_alpha.txt`, `fps_recoleccion.json` (pickupsVisible 6, pageerrors 0), `recoleccion_6_objetos.webp`.
- Evidencias reproducidas por el reviewer en ronda 2: `scripts/verify_alpha_b.js` (TODOS OK) y `vitest run` (184/185, único fallo known_failure).

## Hallazgos (no bloqueantes)

1. Contadores ausentes para algunos recursos: `TopResourceBar` solo expone `wood, stone, wheat, iron`. Huevos, leche, lana y `carrot` (plot:2 del evidence) no tienen `data-resource`, así que vuelan al fallback de R21 (borde superior). Cumple R21 literalmente; R20 pide ir al contador del recurso. **Aceptado por el owner como comportamiento de esta feature** (central, `t_e66e2106`). Los contadores nuevos corresponden a `ui_kit_b`, que ya toca `TopResourceBar`. Pendiente: `recoleccion_main.json` tiene `destinoFallbackSinContador: null`, así que no queda documentado a qué destino voló el objeto animal.
2. Un objeto ya en vuelo (`disableInteractive`, `HubSceneB.js:558`) deja pasar el tap al edificio de debajo: el tap cae en `entity:selected:building`. R17 habla de objetos, no de vuelos; aceptable, anotado.
3. R14 se verifica solo por Playwright (`recoleccion_fallback.json`); no hay test Vitest de textura faltante. La evidencia pedida por la spec es la captura; no bloquea.

## Bloqueo

Sin bloqueo. (La confirmación visual de los assets se resolvió en la puerta de arte `t_8ae611b3`.)

## Cambios requeridos

Ninguno. Veredicto APPROVED.

