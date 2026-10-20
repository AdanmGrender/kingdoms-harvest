# AGENTS.md — Mapa de navegación para agentes de IA

> Punto de entrada para cualquier agente en este repositorio. Es un **mapa**,
> no una biblia: leé solo lo que necesites cuando lo necesites.

## 1. Antes de empezar (obligatorio)

1. Leé `feature_list.json`. La feature objetivo es la que nombre el owner o la
   de tu `assignee`. Toda feature `"sdd": true` pasa por SDD (`docs/specs.md`).
2. Leé `docs/specs.md` antes de tocar cualquier spec.

## 2. Mapa del repositorio

| Archivo / carpeta | Qué contiene | Cuándo leerlo |
|---|---|---|
| `feature_list.json` | Backlog con `status`, `assignee` y `known_failures` | Siempre, al empezar |
| `specs/<feature>/` | `requirements.md` + `design.md` + `tasks.md` + `review.md` + `evidencia/` | Antes de implementar |
| `CHANGELOG.md` | Features terminadas | Al cerrar una feature |
| `docs/architecture.md` | Capas, flujo de datos, antipatrones | Antes de implementar o revisar |
| `docs/conventions.md` | Estilo, nombres, **qué cuenta como evidencia** | Antes de escribir código |
| `docs/specs.md` | Proceso SDD: EARS, puerta humana | Antes de redactar o leer un spec |
| `docs/project-spec.md` | Contratos de dominio: API, DB (sql.js), servicios, economía KH, seguridad, EventBridge | Si tocás server, dinero o Phaser↔React |
| `docs/art-direction-b.md` | Contrato visual grimdark renacentista + fases | Arte, UI, escenas |
| `docs/lore.md`, `docs/lore-glosario.md` | Canon v2 y nombres v1→v2 | Cualquier texto visible |
| `.claude/agents/` | `leader`, `spec_author`, `implementer`, `reviewer` | Si orquestás |
| `client/src/` | React (chrome) + Phaser (escenas) + Zustand + axios | Implementar cliente |
| `server/src/` | Express: `routes/` → `services/` → `config/database.js` | Implementar server |
| `shared/` | `gameConfig.js`, `tokenConfig.js` | Balance, catálogos, textos |
| `server/tests/`, `client/src/tests/` | Jest y Vitest | Verificar |
| `spikes/` | Prototipos descartables (`001-combat-b`) | Referencia visual |
| `art-b/`, `scripts/gen_art_b.js`, `scripts/process_art_b.js` | Pipeline de arte IA | Features con arte |
| `.superpowers/` | Specs históricas pre-harness (sin versionar) | Solo contexto |

## 3. Reglas duras (no negociables)

- Una sola feature a la vez por sesión/agente; no toques otras `in_progress`.
- No tomes ni reasignes una feature con `assignee` ajeno sin coordinarlo.
- Nada se declara hecho sin `Evidencia:` inline en `specs/<feature>/tasks.md`.
- No saltes la fase de spec ni la puerta de aprobación humana.
- Al cerrar (`done`): línea en `CHANGELOG.md` bajo `## [Unreleased]`.
- Cada feature en `feature/<name>` desde `feat/art-direction-b`.
- Respetá las invariantes del producto de `CLAUDE.md`.
- Si no sabés algo, buscá en `docs/` antes de inventarlo.

## 4. Flujo de trabajo (SDD)

```
pending → [spec_author] → spec_ready → ⏸ OWNER → in_progress → [implementer → reviewer] → done
```

## 5. Cierre de sesión

1. Feature acabada → `done` + `CHANGELOG.md`.
2. Suites en verde (`cd server && npx jest --runInBand --forceExit`,
   `cd client && npx vitest run`); solo se toleran `known_failures`.
3. Sin temporales, debug ni TODOs sin contexto; nada de `.webm`/`.rar`/crudos 2K.

## 6. Si te bloqueás

`status: "blocked"` en `feature_list.json`, razón en `## Bloqueado` de
`specs/<feature>/tasks.md`, y parás. No inventes workarounds.
