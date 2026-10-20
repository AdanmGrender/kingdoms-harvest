# Spec Driven Development (SDD)

> Flujo Kiro-style: requirements → design → tasks → code.
> El código no se escribe hasta que el spec está aprobado por un humano.

## Estructura

Cada feature nueva (`"sdd": true` en `feature_list.json`) tiene una carpeta
dedicada en cuanto deja `pending`:

```
specs/<feature-name>/
├── requirements.md   # QUÉ se necesita (EARS notation)
├── design.md         # CÓMO se construirá (decisiones técnicas)
└── tasks.md          # PASOS concretos a implementar
```

El `feature-name` coincide con el campo `name` de `feature_list.json`.

## Estados de una feature

| Estado         | Significado                                                            |
|----------------|-------------------------------------------------------------------------|
| `pending`      | Sin spec. El `spec_author` es el primero en actuar.                     |
| `spec_ready`   | Spec redactado. Esperando aprobación humana. NO se toca código.         |
| `in_progress`  | Spec aprobado. `implementer` trabajando.                                |
| `done`         | Evidencia de verificación en orden, `reviewer` aprobó, sesión cerrada.  |
| `blocked`      | Atascado. Razón en sección `## Bloqueado` de `specs/<feature>/tasks.md`. |

## Reclamo de feature (`assignee`)

Cada feature en `feature_list.json` tiene un campo `assignee` (string o
`null`). Un dev/agente toma una feature `pending` editando `assignee` a su
nombre/handle antes de lanzar `spec_author`. No tomes ni reasignes una
feature con `assignee` no-null distinto al tuyo sin coordinarlo primero con
esa persona. Cómo cada quien gestiona su avance interno mientras trabaja
una feature (notas propias, su propio agente, herramientas externas) queda
fuera del alcance de este kit — no se prescribe ni se audita.

## La puerta de aprobación humana

El flujo automático se detiene **una vez**: cuando el `spec_author` termina
sus tres archivos, marca la feature como `spec_ready` y para. El humano
lee `specs/<feature>/` y dice "aprobado" (o pide cambios).

Solo entonces el `leader` transiciona `spec_ready → in_progress` y lanza
el `implementer`.

```
pending → [spec_author] → spec_ready → ⏸ HUMANO → in_progress → [implementer → reviewer] → done
```

## requirements.md — EARS estricto

Las requirements se redactan en **EARS** (Easy Approach to Requirements
Syntax). Cada requirement es un párrafo numerado con uno de estos cinco
patrones:

| Patrón         | Plantilla                                                    |
|----------------|----------------------------------------------------------------|
| **Ubicuo**     | `El sistema DEBE <acción>.`                                  |
| **Evento**     | `CUANDO <disparador>, el sistema DEBE <acción>.`             |
| **Estado**     | `MIENTRAS <estado>, el sistema DEBE <acción>.`               |
| **Opcional**   | `DONDE <feature opcional>, el sistema DEBE <acción>.`        |
| **No deseado** | `SI <evento no deseado> ENTONCES el sistema DEBE <acción>.`  |

Reglas duras:

- Cada requirement tiene un id estable: `R1`, `R2`, ...
- Cada requirement DEBE ser verificable con evidencia concreta (test,
  comando reproducible, inspección documentada — lo que use tu proyecto).
- No mezcles varios `DEBE` en un mismo requirement. Si hay más de uno, parte.
- No uses verbos blandos ("podría", "puede", "soporta"). Solo `DEBE` / `NO DEBE`.

Ejemplo (genérico — sustituye por tu dominio):

```markdown
## R1
CUANDO el usuario ejecuta `<comando>`, el sistema DEBE <efecto observable>.

## R2
SI <entrada inválida> ENTONCES el sistema DEBE <manejo del error>.
```

## design.md — decisiones técnicas

Captura **antes** de tocar código:

- Qué archivos se crean / modifican.
- Qué firmas nuevas aparecen (funciones, clases, endpoints, comandos).
- Qué excepciones o casos de error se reutilizan o se añaden.
- Qué alternativa se descartó y por qué (mínimo una).

NO es ingeniería desde primeros principios — apóyate en
`docs/architecture.md` y `docs/conventions.md`. El `design.md` documenta los
puntos donde tu feature roza la frontera de esas reglas.

## tasks.md — checklist ejecutable

Pasos discretos en orden, cada uno con checkbox. Cada task referencia al
menos un `R<n>` que cubre. Al completarla, el `implementer` marca `[x]` y
añade su evidencia de verificación **inline**, en la misma línea:

```markdown
- [ ] T1 — <cambio concreto>. Cubre: R1, R3.
- [ ] T2 — <cambio concreto>. Cubre: R2.
- [ ] T3 — <verificación de R1>. Cubre: R1.
```

pasa a:

```markdown
- [x] T1 — <cambio concreto>. Cubre: R1, R3. Evidencia: <test/comando+output/verificación manual>.
- [x] T2 — <cambio concreto>. Cubre: R2. Evidencia: <...>.
- [x] T3 — <verificación de R1>. Cubre: R1. Evidencia: <...>.
```

El `reviewer` rechaza si queda alguna `[ ]` sin justificación documentada,
o alguna `[x]` sin `Evidencia:`.

## Trazabilidad (regla dura)

- Cada `R<n>` debe tener al menos una evidencia de verificación concreta,
  documentada inline en la task correspondiente de `specs/<name>/tasks.md`
  (campo `Evidencia:`). No se usa ningún archivo aparte para esto.
- El `reviewer` comprueba esta correspondencia leyendo
  `specs/<name>/{requirements.md, tasks.md}` y rechaza si falta cobertura
  para algún `R<n>`, o escribe el veredicto en `specs/<name>/review.md`
  (ver formato en `.claude/agents/reviewer.md`).

## Cuándo NO aplica SDD

Las features con `"sdd": false` o sin el campo `sdd` NO tienen spec. SDD
solo se aplica a las features que lo marcan explícitamente.
