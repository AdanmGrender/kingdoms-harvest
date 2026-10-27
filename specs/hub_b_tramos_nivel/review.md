# Review — `hub_b_tramos_nivel` (T11–T13, ronda 4)

- Revisor: reviewer (SDD), task t_37d2fad3, run 70
- Rama: `feature/hub_b_tramos_nivel`, HEAD `f540d9e`
- Ronda: 4 (lente contrato). Previas: `changes_requested` en rondas 1, 2 y 3 (`911b075`, `df80c28`, `a7023a6`).
- Alcance: contra `requirements.md` R1–R44 y `tasks.md`; verificación de las correcciones de las rondas 1–3.

## Veredicto

**APPROVED**

Las tres correcciones de la ronda 3 están aplicadas y verificadas. Cada R1–R44 tiene al menos una task `[x]` con `Evidencia:`. Las excepciones del owner (puerta de arte, R15) están registradas y se aceptan (ver Notas).

## Verificado (ronda 4)

- Corrección ronda 3, punto 1 (R24): `client/src/tests/hubLayout.test.js:404-` lee `docs/art-direction/hub-tramos-nivel.md`, exige 68 webp de edificio en `HUB_TEXTURES`, comprueba archivo y clave de cada variante contra su fila de la tabla, y valida la tabla de cortes contra `buildingTier`/`BUILDING_MAX_LEVEL`. **OK.**
- Corrección ronda 3, punto 2: `evidencia/aprobacion_arte.md:76-77` dice trap_alto 136 % y stable_alto 119 %, que coinciden con `evidencia/tramos_verify.txt:35` y `:48`. El veredicto no cambia. **OK.**
- Corrección ronda 3, punto 3: `evidencia/consola.txt:1` dice "68 webp de edificio" (R41). **OK.**
- Ejecución: `cd client && npx vitest run --test-timeout=30000` → 21 archivos, **330/330**. `npx vitest run src/tests/hubLayout.test.js` → 114/114.
- R11/R12: 68 webp de edificio presentes en `client/public/assets/b/buildings/`. `git diff --diff-filter=MD feat/art-direction-b...HEAD` no modifica webp aprobados ni `art-b/tramos/raw/`.
- R39: `git diff feat/art-direction-b...HEAD -- server shared CHANGELOG.md` sin cambios.
- R21/R22: `23ca797` (aprobación de arte, 2026-10-25 20:12) anterior a `c6ad874` (integración de `HUB_TEXTURES`, 20:58).
- R38 (ronda 3, OK): 1 `POST /api/buildings/upgrade`, sin navegación, capturas `obra_*`. No cambió en `f540d9e`.
- R37, R33, R36, R25 (80 entradas): verificados en rondas anteriores; sin cambios en esta ronda.

## Trazabilidad

| Rango | Estado | Evidencia |
|---|---|---|
| R1–R44 | Cumplido | Cada R cubierto por al menos una task `[x]` en `tasks.md` (44 de 44). |
| R18–R22 | Cumplido con excepción del owner | Veredicto de owner (no de p-kh), registrado con motivo en `aprobacion_arte.md` § "Hoja completa (T10)". |
| R15 | Excepción del owner | `tasks.md` T9 y `aprobacion_arte.md`: trap_alto 136 %, stable_alto 119 %. |

## Tasks

- T1–T13: todas `[x]` con `Evidencia:` inline (15 líneas `Evidencia`).
- `## Bloqueado`: sin bloqueos vigentes.
- `Conocimiento:`: no declarado en la task; no aplica.

## Notas (no bloquean)

- **Puerta de arte resuelta por el owner, no por p-kh** (R18–R22). Central debe confirmarla con el owner al cerrar la feature.
- **Capturas `mejora_*` idénticas a `obra_*`** (mismo tamaño): es lo que pide R44; el nombre confunde, no bloquea.
- **`evidencia/fps_tramos.json`** no registra resolución ni número de edificios en `alto` (R40). Sugerencia para una futura ronda.
- **building_complete por socket** no se emite end-to-end en Playwright; cubierto por el Vitest de R37 (documentado por el implementador).

## Cambios requeridos

Ninguno.
