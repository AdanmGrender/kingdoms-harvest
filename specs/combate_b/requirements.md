# Requirements — `combate_b` (feature 7, B2)

> Base: rama `feature/combate_b` @`46d156d` (incluye F13 `combate_motor_v2`, F14 `combate_pasivas_estados`, F9 `pantallas_b`, #24). Brief del explorer: `_conocimiento/kingdoms-harvest/briefs/combate_b.md`.
> Alcance: **solo `client/`** (escena Phaser de combate, adaptador, mapa de arte, HUD React, arte B). `server/` y `shared/` NO se tocan.
> "Escena" = `CombatScene` (Phaser). "HUD" = lo que React dibuja encima (`CombatInstancePanel.jsx`). "Evento" = entrada de `state.events[]` (contrato: `specs/combate_motor_v2/design.md` §5; kinds F14 en `specs/combate_pasivas_estados/`). "Ronda" = una respuesta de `POST /campaign/step`.
> Las preguntas abiertas Q1–Q12 están en `design.md` §15; los R que dependen de una respuesta lo indican con `[Qn]` y fijan la **recomendación** del spec-author (el owner puede cambiarla en el gate).
> Etapas (cada una cabe en ~1 h de worker, ver `tasks.md`): **A** escena funcional con arte existente (0 USD) · **B** arte nuevo (costo, decisión del owner) · **C** calidad, fps, retiro de referencias viejas y verificación.

## A. Server-authoritative y no destrucción

## R1
El sistema NO DEBE modificar archivos bajo `server/` ni `shared/`.
- Verificación: `git diff --name-only 46d156d..HEAD -- server shared` vacío.

## R2
El sistema NO DEBE cambiar el valor de `COMBAT.engineVersion` (queda en `1`; pasar a `2` es decisión del owner en commit propio, Q2).
- Verificación: `git diff 46d156d..HEAD -- shared/gameConfig.js` vacío.

## R3
La escena NO DEBE calcular daño, HP, azar de combate ni resultado: toda cifra que dibuja sale de `event.value`, `event.hp` o del `state` recibido.
- Verificación: test de barrido sobre `client/src/game/combat/**` sin `COMBAT`, `HERO_PASSIVE_FX`, `COMBAT_FX`, `mitigate`, `defK`, `critMult` ni imports de `shared/`; test del planificador: para una lista de eventos de prueba, cada número flotante planificado es igual al `value` del evento que lo origina.

## R4
El cliente DEBE comunicarse con el servidor solo mediante `enterNode` y `stepInstance` existentes (`{type:'advance'}` o `{type:'skill', slot}`), sin endpoints, cabeceras ni campos nuevos.
- Verificación: `git diff 46d156d..HEAD -- client/src/store/gameStore.js` vacío (o solo comentarios); barrido de `api.` / `axios` en `client/src/game/combat/**` y `CombatStage.jsx` = 0.

## R5
El resultado del combate (`victory`/`defeat`) DEBE tomarse de `data.result` de la respuesta y del evento `end`; la escena NO DEBE deducirlo de los HP.
- Verificación: test de panel: con `stepInstance` → `{result:'defeat'}` y HP de enemigo en 0 en el estado, el `ResultBanner` es de derrota.

## B. Reproducción de eventos

## R6
Con `state.events` presente, la escena DEBE reproducir exactamente `state.events.slice(roundLog.eventRange[0], roundLog.eventRange[1])` en orden creciente de `t`.
- Verificación: test del planificador con fixture de 3 rondas (`eventRange` consecutivos): la secuencia de `t` reproducida por ronda coincide con el slice.

## R7
La escena DEBE tener un beat definido para cada uno de los 8 `kind` del contrato (`hit`, `skill`, `death`, `end`, `status`, `dot`, `heal`, `passive`).
- Verificación: test que recorre los 8 kinds y comprueba que `planRound` devuelve ≥ 1 beat con `kind` de origen y duración > 0 para cada uno.

## R8
La escena NO DEBE lanzar excepción ante un `kind` desconocido, un campo extra, un `hit` sin `hp`, un actor/objetivo inexistente o un evento sin `extra`; los ignora o degrada con un `console.warn` (una vez por causa).
- Verificación: test con eventos malformados (`{kind:'zzz'}`, `{kind:'hit', actor:'h9', target:'e7'}`, `{kind:'hit', value:5}`) → `planRound` no lanza y devuelve beats solo para los válidos.

## R9
Un `hit` con `value 0` DEBE mostrarse como «Esquiva» (si hay `passive` con `fx:'dodge'` en la misma ronda sobre el mismo `target`) o sin número de daño, y NO DEBE mostrar el texto "0".
- Verificación: test del planificador con la pareja `passive/dodge` + `hit value 0` → un beat de texto «Esquiva» y ningún beat de número "0".

## R10
Un `skill` de tipo `shield` DEBE dibujarse como efecto de escuadra completa sin objetivo enemigo; uno de tipo `damage` o `execute` DEBE dibujarse contra el `target` del evento.
- Verificación: test del planificador: `skillType:'shield'` (`target:null`) → beat con `scope:'squad'`; `damage` → beat con `targetId` igual al `target`.

## R11
Un `death` DEBE hacer que la unidad caiga y quede fuera de la formación activa (héroe: queda caído y atenuado; enemigo: se desvanece), y la victoria NO DEBE anunciarse antes del evento `end`.
- Verificación: test del planificador: el beat de `end` es siempre el último de la ronda y posterior a todo `death`; test de panel: el `ResultBanner` no existe hasta que la escena emite `combat:round-done` (R19).

## R12
Un `status` DEBE mostrar un marcador por tipo (`stun`, `burn`, `poison`, `defDown`, `atkDown`, `shield`, `immune`) al aplicarse o refrescarse, retirarlo con `op:'expire'`, mostrar «Inmune» con `op:'blocked'` y «Aturdido» con `op:'skip'`.
- Verificación: test del planificador: por cada `(status, op)` de la tabla de `design.md` §4 se obtiene el beat esperado (marcador `add`/`remove`/texto); los 7 tipos tienen color y etiqueta distintos.

## R13
Un `dot` DEBE dibujar un número con color por `status` (`burn`, `poison`) distinto del color del daño directo; un `heal` DEBE dibujar un número de curación y un destello; un `passive` DEBE dibujar una señal por `fx` (`charge`, `crit`, `extraHit`, `dodge`), con `crit` más intensa que un `hit` normal.
- Verificación: test del planificador: colores distintos entre `hit`, `dot/burn`, `dot/poison`, `heal`; `passive/crit` produce un beat con `intensity` mayor que el `hit`.

## R14
La escena NO DEBE reproducir dos veces la misma ronda: un evento con `t` ≤ al último `t` reproducido se descarta.
- Verificación: test: `enqueueRound` dos veces con el mismo `eventRange` → los beats de la segunda llamada son 0.

## R15
Al terminar de reproducir una ronda, la escena DEBE fijar el HP, el estado vivo/caído y el escudo de cada unidad a los valores del `state` recibido, de modo que un evento perdido no deje la escena desincronizada.
- Verificación: test: ronda con eventos truncados (se omite un `hit`) + `state` autoritativo → `reconcile(state)` devuelve las barras de la escena iguales al `state`.

## R16
La reproducción de una ronda DEBE durar como máximo `ROUND_BUDGET_MS` (2500 ms), comprimiendo el tiempo de los beats si hace falta, con factor mínimo 0,35.
- Verificación: test del planificador con 4, 12 y 40 eventos → duración total ≤ 2500 ms y factor ≥ 0,35; con 2 eventos el factor es 1.

## R17
El HUD NO DEBE enviar el siguiente `advance` hasta que la escena haya terminado de reproducir la ronda anterior (más una pausa de 300 ms), y un toque de habilidad dado durante la reproducción DEBE ejecutarse al quedar la escena ociosa.
- Verificación: test de panel con escena simulada: mientras `playing` el timer de auto-avance no llama a `stepInstance`; un `skill` pedido durante `playing` se llama exactamente una vez tras `combat:round-done`.

## R18
Un toque en el lienzo durante la reproducción DEBE completar la ronda en curso en ≤ 300 ms.
- Verificación: test del controlador: `skip()` pone el factor de tiempo en el valor de salto y la cola termina con la duración restante ≤ 300 ms.

## R19
El `ResultBanner` DEBE aparecer (a) cuando la escena emite `combat:round-done` de la ronda con `result`, (b) a los 4000 ms de recibir el resultado si la escena no responde, o (c) de inmediato si la escena no está disponible (falló la inicialización de Phaser/WebGL o no hay `<canvas>`, como en jsdom).
- Verificación: test de panel con escena simulada que (a) emite round-done → banner; (b) no emite → banner a los 4000 ms con timers falsos; (c) sin escena (`CombatStage` en modo `unavailable`) → banner en el mismo tick, que es el caso de los tests T8 de `pantallasB.test.jsx` sin tocarlos (R40).

## C. Runs v1 y `engineVersion`

## R20
Si `state.events` no existe (run con `state.engine` ausente o `1`), la escena DEBE derivar eventos sintéticos (`synthetic:true`; solo `hit`, `skill`, `death`, `end`) de los deltas de HP entre dos estados consecutivos y reproducirlos por la misma ruta que los reales.
- Verificación: test del adaptador: estados v1 de dos rondas (enemigo -40, héroe slot 2 -15, enemigo muerto) → eventos `hit(e0)`, `hit(h2)`, `death`, `end` con `synthetic:true` y `t` crecientes; `planRound` los acepta sin cambios.

## R21
Con `state.events` presente y `eventsVersion === 1`, la escena NO DEBE usar el adaptador v1.
- Verificación: test: `selectEventSource(state, prev)` devuelve `'events'` para un estado v2 y `'adapter'` para uno v1.

## R22
Si `state.events` existe pero `eventsVersion` es distinto de `1`, la escena DEBE degradar al adaptador v1 con un `console.warn` y NO DEBE lanzar excepción.
- Verificación: test: `eventsVersion: 2` → `'adapter'` y un único warn.

## R23
Con engine v1 la escena NO DEBE mostrar marcadores de estado ni señales de pasiva (no hay eventos que las originen).
- Verificación: test del adaptador: ningún beat de `status`/`dot`/`heal`/`passive` en la salida para una secuencia v1.

## D. Escuadra, enemigos y formación

## R24
La escena DEBE dibujar de 1 a 5 héroes en dos filas (slots 1–3 al frente, 4–5 atrás) sin que se solapen las cajas de las unidades, y un héroe con `heroId: null` (Guarnición) DEBE usar el arte de la clase `warrior`.
- Verificación: test de `computeFormation(heroes, enemies)`: para n = 1…5 héroes y m = 1…4 enemigos, ningún par de cajas se intersecta y todas caen dentro de 824×1720; `heroId:null` → clave de arte `warrior`.

## R25
La escena DEBE dibujar de 1 a 4 enemigos en grupo escalonado cuando `state.enemies` tenga más de uno, y uno solo (de `state.enemies[0]` o `state.enemy`) en caso contrario.
- Verificación: test de formación con fixtures de 1 y 4 enemigos; test: estado v1 (solo `enemy`) → 1 unidad enemiga con id `e0`.

## R26
El sistema NO DEBE definir `enemies[]` en `CAMPAIGN` ni cambiar vida/daño de ningún nodo; la escena solo SOPORTA grupos (oleadas con datos = otra feature, Q5).
- Verificación: cubierto por R1; test de formación con 4 enemigos usa solo fixtures.

## R27
El sistema DEBE conservar los topes de tamaño del enemigo de F9: 0,29 del alto del marco para enemigos normales y 0,36 para jefes, expresados como fracción del alto lógico del lienzo.
- Verificación: test de `combatLayout`: `ENEMY_HEIGHT_FRAC` = `{ normal: 0.29, boss: 0.36 }` y la altura de la caja del enemigo = fracción × 1720; las dos filas `CombatInstancePanel` de `CAPS` en `pantallasB.test.jsx` se reemplazan por esta comprobación (R44).

## E. Arte B y mapa de arte

## R28
Durante un combate completo la escena y el HUD NO DEBEN solicitar ningún recurso bajo `/assets/game/`.
- Verificación: Playwright con captura de red a lo largo de un combate `a1n3` completo → 0 peticiones a `/assets/game/`; evidencia en `specs/combate_b/evidencia/red.json`.

## R29
Los archivos de combate nuevos o modificados NO DEBEN contener la cadena `assets/game/`.
- Verificación: test de barrido sobre `CombatInstancePanel.jsx`, `CombatStage.jsx` y `client/src/game/combat/**` = 0 coincidencias.

## R30
El mapa de arte DEBE resolver los 18 `heroId` de `HEROES` y los 13 nodos `combat/wave/boss` de `CAMPAIGN` a una clave de arte de enemigo y de fondo, con fallback explícito (héroe → arte de su clase → `warrior`; enemigo → `bruto`; fondo → `crypt`), sin lanzar excepción y sin devolver nunca una ruta bajo `/assets/game/`.
- Verificación: test exhaustivo sobre los 18 héroes y los 13 nodos; test de ids desconocidos (`'zzz'`, `null`, `undefined`) → fallback.

## R31
Si una textura no carga, la escena DEBE dibujar un marcador gráfico generado (silueta de la unidad) con un `console.warn` y el combate DEBE continuar.
- Verificación: test del cargador con textura simulada fallida → clave de placeholder y un warn; el combate sigue (la escena sigue aceptando rondas).

## R32
La escena DEBE cargar solo las texturas de la escuadra, los enemigos y el fondo del nodo en curso, y liberarlas al cerrar el combate.
- Verificación: test de `collectAssetKeys(state, node)`: para 3 héroes + 1 enemigo devuelve ≤ 3×2 + 2 + 1 claves; al destruir el juego `game.destroy(true)` se invoca (R38).

## R33 [Q3, Q4]
El arte nuevo de la Etapa B DEBE ser webp con héroes de 640 px de alto, enemigos de 720 px de alto, fondos de ≤ 1080 px de ancho, con peso ≤ 80 KB por hoja de héroe, ≤ 100 KB por imagen de enemigo y ≤ 250 KB por fondo.
- Verificación: `evidencia/arte/medidas.json` generado por script con dimensiones y bytes de cada archivo nuevo; ninguno excede el tope.

## R34 [Q3]
Cada lote de arte (héroes, enemigos, fondos) DEBE tener una hoja de contacto sobre fondo oscuro aprobada por p-kh antes de commitearse, con veredicto en `evidencia/aprobacion_arte.md`.
- Verificación: `evidencia/aprobacion_arte.md` con veredicto `APROBADO` por lote, prompts textuales y hoja de contacto en `evidencia/arte/`.

## R35
El arte nuevo NO DEBE copiar ni derivar de propiedad intelectual de terceros (prompts y refs originales de KH, `art-b/gr/refs/` solo como ancla de estilo propio).
- Verificación: `aprobacion_arte.md` registra la lista de refs usadas (todas bajo `art-b/`) y la revisión de p-kh de "sin parecido a IP ajena".

## F. Montaje, viewport (#24) y kit B

## R36
El lienzo de combate DEBE vivir en un contenedor cuyo alto sea `var(--kh-frame-h)` y escalar en modo FIT desde un espacio lógico de 824×1720.
- Verificación: test de render de `CombatStage` (Phaser simulado): el contenedor tiene `height: var(--kh-frame-h)`; test de config: `scale.mode === FIT`, `width 824`, `height 1720`.

## R37
Los archivos de combate nuevos o modificados NO DEBEN usar unidades `vh/dvh/svh/vw`, `h-screen`/`w-screen` ni `window.innerHeight/innerWidth`.
- Verificación: el barrido `RE_VIEWPORT` de `pantallasB.test.jsx` sigue en verde y se extiende a `CombatStage.jsx` y `game/combat/**`, más un barrido de `innerHeight|innerWidth`.

## R38
El sistema DEBE destruir el `Phaser.Game` de combate (`destroy(true)`) y retirar sus listeners de `EventBridge` al cerrar o desmontar el panel, y DEBE haber a lo sumo un `<canvas>` de combate en el DOM.
- Verificación: test: montar y desmontar `CombatStage` (Phaser simulado) → `destroy` llamado una vez, `EventBridge.listenerCount` de cada uno de `combat:open`, `combat:close`, `combat:round-done` = 0, `querySelectorAll('canvas').length` ≤ 1 al montar dos veces seguidas.

## R39 [Q1]
El hub (`HubSceneB`) NO DEBE renderizar mientras el combate está abierto y DEBE reanudarse al cerrarlo.
- Verificación: test de `PhaserGame`: al recibir `combat:open` se llama `game.loop.sleep()` y al recibir `combat:close` `game.loop.wake()`; medición en `evidencia/fps.json` de fps del combate con el hub abierto detrás.

## R40
El HUD React DEBE conservar: título con nodo y ronda, barra de vida de cada enemigo (R54), fila de héroes con barra de energía y toque para habilidad (solo con `energy >= energyMax` y vivo), botón «Avanzar ronda», cierre `.kh-close` y `ResultBanner` con los textos «¡Victoria!», «Derrota» y «Volver».
- Verificación: los tests T8 de `pantallasB.test.jsx` (`describe('pantallasB T8 — resultados')`) siguen en verde sin cambios de aserción; test nuevo del botón de habilidad.

## R41
El HUD DEBE conservar la fanfarria de victoria (`EmberField` solo con `result === 'victory'`) y el velo de derrota (`data-defeat-veil` solo con `defeat`), y NO DEBE conservar el diorama, el sprite de enemigo ni la fila de retratos viejos.
- Verificación: tests T8 existentes; barrido: `CombatInstancePanel.jsx` sin `dioramas`, sin `enemies/`, sin `heroes/<id>.png`.

## R42
Los retratos del HUD NO DEBEN usar `/assets/game/heroes/` y DEBEN usar arte B o un ícono del kit B (`SpriteIcon`) como fallback [Q6].
- Verificación: cubierto por R29; test de render de la fila de héroes con 3 héroes + Guarnición → ningún `src`/`backgroundImage` contiene `/assets/game/`.

## R43
Todo elemento interactivo del HUD DEBE tener área táctil ≥ 44×44 px.
- Verificación: `evidencia/despues/reporte.json` (medición de bbox como en `specs/pantallas_b` T10) con `botonesBajo44: []` en el panel de combate a 360×740, 360×800 y 412×915.

## R44
Las dos filas de `CAPS` de `client/src/tests/pantallasB.test.jsx` referidas a `CombatInstancePanel.jsx` (`0.36`, `0.29`) DEBEN sustituirse por la comprobación de R27, y el resto de ese archivo NO DEBE modificarse.
- Verificación: `git diff 46d156d..HEAD -- client/src/tests/pantallasB.test.jsx` solo muestra esas dos entradas y el nuevo `describe` de combate.

## R45
El HUD NO DEBE contener emojis, `✕`/`✓` ni los colores/hex que barren los tests de F9.
- Verificación: los barridos `AA` de `pantallasB.test.jsx` (que incluyen `CombatInstancePanel.jsx`) siguen en verde.

## G. Calidad y rendimiento

## R46
La escena DEBE ofrecer tres niveles de calidad `low`, `medium`, `high` con presupuestos definidos en `design.md` §10 (luces, bloom, vignette, partículas vivas máximas) y `low` NO DEBE usar `postFX` ni `PointLight`.
- Verificación: test de `combatQuality`: tabla de los 3 niveles; `low` → `{ postFX:false, lights:0, bloom:false }`.

## R47
El nivel por defecto DEBE ser `medium`, persistido en `localStorage['kh_combat_quality']`; un valor ausente o inválido DEBE resolver a `medium` y una cámara sin `postFX` NO DEBE producir excepción.
- Verificación: test de `resolveQuality()` con `null`, `'zzz'`, `'low'`, `'high'`, y con `localStorage` que lanza; test de escena simulada con `cameras.main.postFX` indefinido.

## R48
Un combate completo con calidad `medium` DEBE sostener ≥ 50 fps (promedio de `game.loop.actualFps` muestreado cada 500 ms) con p5 ≥ 40, y la medición DEBE quedar registrada.
- Verificación: `evidencia/fps.json` con dispositivo, calidad, n de muestras, promedio y p5 de un combate `a1n3` completo; Q9 define el dispositivo (emulador `kh_pixel7` y escritorio).

## R49
Un combate completo NO DEBE producir errores de consola ni `pageerror`.
- Verificación: Playwright con `page.on('console'|'pageerror')` en un combate `a1n3` completo → `errores: []` en `evidencia/despues/reporte.json`.

## H. Verificación y cierre

## R50
Un combate real de campaña (`a1n3`) DEBE poder jugarse entero con la escena nueva hasta el `ResultBanner`, con motor v1 (valor actual) y con motor v2 (activado solo en el entorno de prueba local, sin commitear el cambio).
- Verificación: `evidencia/combate_v1.md` y `evidencia/combate_v2.md` con capturas por ronda, el resultado y los `console` limpios; con v2 se ven al menos un `status` o `passive` si el escuadrón los dispara.

## R51
El sistema NO DEBE agregar dependencias (`client/package.json`, `server/package.json` y lockfiles sin cambios).
- Verificación: `git diff --name-only 46d156d..HEAD -- '*package.json' '*package-lock.json'` vacío.

## R52
El sistema NO DEBE borrar ningún archivo de `client/public/assets/game/` (`HeroPanel.jsx:62` y `WaveDefensePanel.jsx:130` siguen usándolo) ni `assets/sprites/enemy_icons_legacy.png` (`iconSheet.test.js:132-142`).
- Verificación: `git diff --diff-filter=D --name-only 46d156d..HEAD` no lista nada bajo `client/public/assets/game/` ni `client/public/assets/sprites/`.

## R53
Las suites completas del servidor y del cliente DEBEN pasar y el build del cliente DEBE completar sin errores.
- Verificación: `cd server && npx jest --runInBand --forceExit` y `cd client && npx vitest run`, citando `Tests: N passed` de cada una; el N de la línea base se mide al inicio de T1 (se registra en `tasks.md`) y el N final no puede tener fallos nuevos; `cd client && npm run build` sin errores.

## R54 [owner 2026-10-31]
El HUD DEBE mostrar una barra de vida por cada enemigo del combate, no solo la del principal. Fuente: `state.enemies[]` (v2) o, si no existe, `[state.enemy]` (v1), en el orden en que llegan. Cada fila lleva el nombre del enemigo (o «Enemigo N» si no trae nombre) y su barra (`hp/maxHp`, piso 0); un enemigo con `hp <= 0` se ve atenuado y su barra en 0, sin desaparecer. Con 1 enemigo el HUD se ve como hoy. Con 4 enemigos el bloque no tapa la fila de héroes ni el botón «Avanzar ronda» en 412×860 y en aspecto > 2.1.
- Verificación: test nuevo en `combatPanel` con estado de 1, 3 y 4 enemigos (cuenta de barras con `aria-label` «Vida de <nombre>», valores, atenuado del muerto); fallback v1 con solo `state.enemy`; los tests de R40 siguen verdes; capturas de T11 con 3+ enemigos.
