# Review — `hub_b_tramos_nivel` (T11–T13, ronda 3)

- Revisor: reviewer (SDD), task t_37d2fad3, run 68
- Rama: `feature/hub_b_tramos_nivel`, HEAD `d8a5180`
- Ronda: 3 (lente contrato). Previas: ronda 1 `changes_requested` (run 64, `911b075`); ronda 2 `changes_requested` (run 66, `df80c28`).
- Alcance: contra `requirements.md` R1–R44 y `tasks.md`; verificación de las correcciones de las rondas 1 y 2.

## Veredicto

**CHANGES_REQUESTED**

R38 ya cumple su spec y las correcciones de las rondas 1 y 2 están aplicadas. Quedan tres defectos concretos: falta el test que exige R24, y dos evidencias tienen cifras o conteos que no coinciden con la salida real.

## Verificado (ronda 3, contrato y ejecución)

- `cd client && npx vitest run --test-timeout=30000` → **21 files, 328 passed** (ejecutado de nuevo).
- Corrección ronda 2 (R38): `requirements.md:189-190` pide `POST /api/buildings/upgrade` único, sin navegación, y `obra_antes/durante/despues`. Verificado en `scripts/hub_b_tramos_evidence.js`: `upgradePosts.length === 1` (`:259`), `buildingDbId === BARN_DB_ID` (`:260`), textura `hubb_bld_barn_obra` durante (`:261`) y `_medio` después (`:268`). Sin navegación: `framenavigated` (`:126`) y aserción `:367`. Capturas `evidencia/obra_{antes,durante,despues}.webp` presentes. `consola.txt`: 1 POST, bajo→obra→medio. **OK.**
- Corrección ronda 1 (`hubLayout.test.js`): R132 eliminado; test de existencia en disco en `hubLayout.test.js:396-400`. **OK.**
- Corrección ronda 1 (`scripts/hub_b_tramos_evidence.js`): sin fallback de fps; aserciones de toque, bloqueo de webp y sin navegación (`:259-269`, `:310-315`, `:359-370`). **OK.**
- `CHANGELOG.md`: sin diff contra `feat/art-direction-b`. **OK.**
- `tasks.md` `## Bloqueado` al día; T9 registra la excepción R15 (119 % / 136 %). **OK.**
- R12: ninguno de los 17 `<id>.webp` base modificado (`git diff --stat 2f048a1 -- client/public/assets/b/buildings/`). **OK.**
- R11: 68 webp de edificio en `client/public/assets/b/buildings/` (51 de variante + 17 base). **OK.** Máximo 99 KB por archivo (R17).
- R39: `git diff --stat 2f048a1...HEAD -- server shared` vacío; 0 `EventBridge.emit(` nuevos. **OK.**
- R33: `grep CONSTRUCTION_TINT` sin resultados; el `setAlpha(0.75)` de `HubSceneB.js:649` es la niebla (`fog`), no el edificio. **OK.**
- R37: `socketService.js:21` llama `loadBuildings()` antes del aviso; `buildingTiers.test.js:17-24` lo cubre. **OK.**
- R36: `HubSceneB.js:648` usa `hubb_bld_${buildingId}`. **OK.**
- R22/R21: `23ca797` (aprobación, 2026-10-25) anterior a `c6ad874` (`HUB_TEXTURES` nuevo). **OK.**
- R2/R6/R3–R5: tabla `CORTES` (`hubLayout.test.js:452-487`) y espejo contra `shared/gameConfig.js` (`:466-468`). La tabla de `docs/art-direction/hub-tramos-nivel.md:33-37` coincide con los cortes de R2. **OK.**
- R25: `hubLayout.test.js:378-388` aserta 4 + 17·4 + 8 = 80 entradas, claves únicas y URLs válidas. **OK.**
- `feature_list.json`: solo `status: in_progress` / `assignee: implementer` (cambio del implementador). No se toca hasta aprobar.

## Trazabilidad

| R | Estado | Evidencia |
|---|---|---|
| R1–R23, R25–R44 | Cumplido | Ver Verificado. R38 cerrado en ronda 3. |
| **R24** | **Incompleto** | El spec exige un Vitest que lea el `.md` (`requirements.md:131-132`). No existe ningún test que lea `docs/art-direction/hub-tramos-nivel.md` (`grep -rn "tramos-nivel\|art-direction" client/src/tests/` sin resultados). Ver Cambio 1. |
| R18–R20 | Cumplido con excepción de owner | Veredicto de owner, no de p-kh (ver Notas). |

## Tasks

- T1–T13: todas `[x]` con `Evidencia:` inline. Ninguna en `## Bloqueado`.

## Cambios requeridos

1. **R24 sin test** (`requirements.md:131-132`). Añadir en `client/src/tests/hubLayout.test.js` un test que lea `docs/art-direction/hub-tramos-nivel.md` (con `fs`, como `:396-400`) y compruebe que cada fila de `HUB_TEXTURES` de edificio (`hubLayout.js:135+`, `hubb_bld_<id>[_variante]` → `/assets/b/buildings/<id>[_variante].webp`) aparece en la tabla del documento (`docs/art-direction/hub-tramos-nivel.md:12-15`). Debe cubrir los 68 webp de edificio. Luego `npx vitest run src/tests/hubLayout.test.js` en verde.

2. **Cifras de la puerta de arte no coinciden con el verificador** (`specs/hub_b_tramos_nivel/evidencia/aprobacion_arte.md:76-77`). Dice `tier_trap_alto` 133 % y `tier_stable_alto` 118 %. La salida real de `evidencia/tramos_verify.txt:35` y `:48` da **stable_alto 119 %** y **trap_alto 136 %**, que son las cifras de `tasks.md` T9. Corregir las dos cifras en `aprobacion_arte.md` para que coincidan con `tramos_verify.txt`. No cambiar el veredicto.

3. **Cabecera de consola inconsistente con R41** (`specs/hub_b_tramos_nivel/evidencia/consola.txt:1`). Dice "con los **80** webp de edificios". R41 y el conteo son de **68** webp de edificio (80 es el total de `HUB_TEXTURES`). Corregir a "68 webp de edificios".

## Notas (no bloquean)

- **Puerta de arte resuelta por el owner, no por p-kh.** R18, R19, R20 y R22 piden veredicto de p-kh (`requirements.md:108,112,116,123`). `aprobacion_arte.md` § "Hoja completa (T10)" registra que el owner aprobó por el chat con Central, con el motivo (cupo semanal al 96 %). Es una excepción del owner, que tiene autoridad sobre su propia decisión de diseño. Se acepta, pero Central debe confirmarla con el owner al cerrar la feature.
- **Capturas `mejora_*` idénticas a `obra_*`** (mismo tamaño de archivo, `330098` y `331126` bytes). Es correcto: R44 pide el tramo viejo y el nuevo de la misma sesión, y `obra_antes` es el estado previo al clic. El nombre queda confuso; no bloquea.
- **`fps_tramos.json`** no registra resolución ni número de edificios en tramo `alto`. R40 pide "412×860 @2x, 20 s, 17 edificios en alto". El script lo hace (`scripts/hub_b_tramos_evidence.js`), pero el JSON no lo documenta. Sugerencia para la siguiente ronda, no bloqueante.
- `aprobacion_arte.md` y `tasks.md` T9 mencionan la excepción R15 del owner: el veredicto de owner de la hoja (`APROBADO`, dudosos aceptados) es el mismo registro. Mantener las dos referencias coherentes al corregir el cambio 2.

## Próximo paso

El implementador resuelve los cambios 1–3 y pide review con `kanban_request_review`. El reviewer verificará en ronda 4 (ejecución): `vitest` completo, el test nuevo de R24 en rojo si se rompe la tabla, y la cifra corregida en `aprobacion_arte.md` contra `tramos_verify.txt`.
