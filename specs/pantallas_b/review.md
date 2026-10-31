# Review — pantallas_b (rama `feature/pantallas_b`, commit revisado 4721ab5)

## Veredicto
**APPROVED** (ronda 1, lente artefacto + verificación de ejecución).

## Trazabilidad
- 48/48 requisitos (R1–R48) aparecen en el campo `Cubre:` de al menos una task `[x]`.
- Tasks: T1–T12 todas `[x]` con `Evidencia:`; 0 `[ ]`; `## Bloqueado` = «Ninguno».
- Puerta de arte T11: `evidencia/aprobacion_arte.md` con `APROBADO` para `marca` y `reinos` (ronda 1) y `key_art` (ronda 2, commit 59569d4). `key_art.webp` 62 020 B, `marca` 107 802 B, `reinos` 163 354 B (≤ 250 KB, trackeados).
- R23/R32 y R24/R33 (fallback plano) cubiertos: `MainMenu.jsx` (`artOk` + `ink`), `useMapBackground.js` (`oak` + capa 0,78).

## Verificación reproducida (reviewer)
- `client`: `npx vitest run` → 27 files, **474 passed** (coincide con el handoff).
- Focalizados: `pantallasB.test.jsx`, `kitComponents`, `kitStyles`, `fixTextosUi`, `OverlayManager` → 96 passed.
- `npm run build` → `✓ built in 9.06s`.
- `git diff feat/art-direction-b...feature/pantallas_b -- server shared client/src/game` → vacío (sin cambios de lógica ni de server).
- Ningún `Evidencia:` depende solo del handoff: el barrido de tests y el build se corrieron aquí.

## Tasks
Todas `[x]` con evidencia. Sin justificaciones pendientes.

## Revisión de código (archivo:línea, diff contra base)
Sin defectos bloqueantes. Observaciones no bloqueantes:
1. `client/src/styles/index.css:277-294` (`.kh-tab`, `.kh-tab--active`): hex literales (`#2a2119`, `#4a4a48`, `#a89c84`, `#d9b77a`, `#e6dcc3`, `#3d3024`) que duplican los tokens de `components/ui/kitPieces.js:8-19`. Coinciden con KH, pero el kit usa tokens. Próxima pasada: `var(--kh-…)` o constantes KH.
2. `client/src/components/overlay/TechTreePanel.jsx` (`game-card` con `borderColor: '#d9b77a'`): hex de token. Mismo criterio que (1).
3. `SettingsPanel.jsx` (`Section` `:150`, `Row` `:166`, `VolumeRow` `:182`) y `StarMap.jsx:121`: `text-[10px]`/`text-[11px]` se conservan. R28/R30 solo exigen ≥ 12 px en estados vacíos y en HeroPanel; no bloquea.
4. `OperationsMap` `✕` 35.6×32 px (`evidencia/comparacion.md`): excepción documentada por R14 (fuera de alcance §1/Q4). Aceptada.
5. `feature_list.json`: el reviewer pasa `pantallas_b` de `in_progress` a `done`; el `assignee` `spec-author` se conserva tal como estaba en base.

## Observación fuera de alcance (no bloquea; sugerencia de seguimiento)
- Etiquetas de nodo de Galaxia/Sistema truncadas a la primera palabra: `StarMap.jsx:122` `nd.name.split(' ')[0]`. **Preexistente** en base (`git show feat/art-direction-b:…StarMap.jsx:116`), no lo introdujo esta feature. Recomendable abrir una feature o fix aparte.
- Subtítulos del panel de Sistema/Galaxia sobre el marco: preexistente según el veredicto de p-kh (`specs/pantallas_b/evidencia/aprobacion_arte.md`).

## Cambios requeridos
Ninguno.
