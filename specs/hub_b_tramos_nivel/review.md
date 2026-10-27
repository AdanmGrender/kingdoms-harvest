# Review — `hub_b_tramos_nivel` (T11–T13, ronda 1)

- Revisor: reviewer (SDD), task t_37d2fad3, run 64
- Rama: `feature/hub_b_tramos_nivel`, HEAD `c6ad874`
- Ronda: 1 (lente artefacto). No hay `changes_requested` previos.
- Alcance: T10 (puerta, commit `23ca797`) y T11–T13 (commit `c6ad874`), más el diff de la rama contra `feat/art-direction-b`.

## Veredicto

**CHANGES_REQUESTED**

La implementación técnica está bien: tests en verde, la aprobación de arte tiene fecha anterior y el texto de HUB_TEXTURES cumple el spec. Faltan correcciones de evidencia y de higiene del harness antes de aprobar.

## Verificado

- `cd client && npx vitest run --test-timeout=30000` → **21 files, 328 passed**. Coincide con T13.
- Orden R21: `23ca797` (aprobación T10, "Hoja completa") es anterior a `c6ad874` (HUB_TEXTURES 80 entradas). OK.
- Cada URL de `HUB_TEXTURES` (`client/src/game/hub/hubLayout.js`) existe bajo `client/public/`. 51 webp de tramo (`buildings/<id>_medio|_alto|_obra.webp`) presentes. Sin cambios en `server/` ni `shared/`. Sin tocar `art-b/tramos/raw/` ni los webp aprobados.
- `variantKey` (`hubLayout.js:51`): `bajo` mantiene `hubb_bld_<id>`, consistente con el fallback de T4.
- `feature_list.json`: solo `status` pendiente→in_progress y `assignee`. Edición quirúrgica, OK para la fase de implementación.
- Trazabilidad: R1–R44 aparecen en algún `Cubre:` de tasks.md. Cada tarea T1–T13 tiene `Evidencia:` inline.
- `consola.txt`: 0 pageerrors, 0 console.error, 0 http≥400. Las 10 advertencias son de Telegram.WebApp (SDK).
- Las 6 capturas de `evidencia/` tienen md5 distintos entre sí (no son copias).

## Tasks

| Task | Estado | Observación |
|---|---|---|
| T1–T9 | [x] con Evidencia | OK, salvo lo indicado en "Cambios requeridos" 4 |
| T10 | [x] con Evidencia | Aprobación por el owner, no por p-kh (ver Notas) |
| T11 | [x] con Evidencia | 328/328 reproducido |
| T12 | [x] con Evidencia | Sobrecontada: ver Cambios requeridos 2 |
| T13 | [x] con Evidencia | Sobrecontada: ver Cambios requeridos 3 y 4 |

## Cambios requeridos

1. **Test de texto, no de comportamiento, y con ID inexistente.** `client/src/tests/hubLayout.test.js:394` ("R132 — …") lee `docs/art-direction/hub-tramos-nivel.md` y hace `toContain('<id>_medio.webp')` etc. Esto compara texto del documento, no comportamiento. Además `R132` no existe: `requirements.md` llega solo a R44. Reemplazarlo por una comprobación de comportamiento (p. ej. que cada URL de `HUB_TEXTURES` de edificio apunte a un archivo existente en `client/public/`), o eliminarlo. Cambiar el nombre para que no lleve un ID inventado.

2. **Evidencia que no prueba lo que dice.** `scripts/hub_b_tramos_evidence.js`:
   - `:239-242` si no hay muestras de fps devuelve `{ avg: 60, min: 60 }`. Eso fabrica un resultado. Debe fallar, no devolver valores por defecto.
   - `:109-117` captura `logs.requests`, pero nunca se usa. T12 declara "bloqueo de webp" cubierto y el script no lo prueba.
   - `:213` el toque (`mouse.click(245,563)`) no tiene aserción: no comprueba que la escena cambie tras el toque. T12 declara "toque tras el cambio" cubierto.
   - "sin navegación" (R44) tampoco se verifica (no se mide `framenavigated`).
   Corregir una de dos: añadir las aserciones (fallar si no se cumple) o reducir el texto de `Evidencia:` de T12 a lo que el script realmente comprueba. Dejar el fallback de fps fuera en cualquier caso.
   También `:158` tiene `...logs.http.push ? … : []`, que funciona por accidente. Escribirlo de forma explícita.

3. **CHANGELOG escrito por el implementador.** `CHANGELOG.md:11` añade la línea de `hub_b_tramos_nivel`. El harness reserva esa línea al reviewer al aprobar (AGENTS.md §3, `reviewer.md`). Si se mantiene, al aprobar quedaría duplicada. Quitarla; la añado yo al aprobar.

4. **tasks.md desactualizado y R15 sin registrar.**
   - `tasks.md:21-29` (sección `## Bloqueado`) sigue diciendo "T10 pendiente de p-kh" y "Por retomar tras APROBADO: T11–T13". Ya no es verdad. Actualizar o cerrar esa sección.
   - T9 (`tasks.md:13`) y la nota de `:27` dicen "51/51" en el objetivo y en el estado, pero la misma evidencia reporta 2 fallos R15 (`stable_alto` 119 %, `trap_alto` 136 %). Escribir la excepción explícita: "R15 excepción aprobada por el owner, `evidencia/aprobacion_arte.md` § Hoja completa (T10)", con el archivo:línea del R15 que se relaja. Así queda trazable y no parece un 51/51 limpio.

## Notas (no bloquean)

- La puerta T10 la resolvió el owner, no p-kh. El spec y `t_6cbecbd2` piden "puerta de arte de p-kh obligatoria". Aquí lo decidió el owner, dentro de su autoridad, y queda registrado en `aprobacion_arte.md`. Lo dejo asentado para que Central lo tenga presente; no es un defecto de implementación.
- Las 7 imágenes generadas en la web de Gemini pueden variar de estilo respecto del resto. El owner lo aceptó (`aprobacion_arte.md`).
- Gemini: `tasks.md` T9 reporta 93 llamadas acumuladas (8 con 402). Coherente con la regla de "carta blanca" del owner. Sin acción.

## Próximo paso

El implementador corrige los puntos 1–4 en la rama y pide review de nuevo con `kanban_request_review`. El reviewer verificará en ronda 2 (ejecución): vitest, las aserciones nuevas del script de evidencia y la consistencia de tasks.md y CHANGELOG.
