# Convenciones de código — Kingdoms Harvest

> Homogeneidad extrema: el repo debe parecerse a sí mismo en todas partes.

## Estilo

- **Lenguaje:** JavaScript. Server y `shared/`: Node 24, **CommonJS**
  (`require` / `module.exports`). Cliente: **ESM** + JSX (React 18, Vite).
  Phaser 3.90.
- **Formato:** 2 espacios, punto y coma, comillas simples; línea ≲ 120.
  No hay formatter automático: imitá el archivo que tocás.
- **Imports:** externos primero, después internos relativos; un bloque.
- **Strings visibles al jugador:** español rioplatense con voseo ("Construí",
  "Tocá", "Mandá"), nombres del lore v2 (`docs/lore-glosario.md`).
- **Comentarios y commits:** en español. Commits `tipo(scope): descripción`
  (`feat`, `fix`, `docs`, `test`, `refactor`, `chore`).

## Nombres

| Tipo | Convención | Ejemplo |
|---|---|---|
| Archivos de service/route (server) | camelCase + sufijo | `farmService.js`, `waveRoutes.js` |
| Componentes React | PascalCase `.jsx` | `BastionHub.jsx` |
| Escenas Phaser | PascalCase + `Scene` | `WorldScene.js` |
| Funciones / variables | camelCase | `getSquad`, `activeRun` |
| Constantes / catálogos | UPPER_SNAKE | `BUILDINGS`, `WAVE_ENEMIES` |
| Ids de datos | snake_case, **inmutables** | `farm_plot`, `boss_devorador` |
| Columnas DB | snake_case | `player_id`, `build_complete_at` |
| Eventos EventBridge | `dominio:accion` | `building:addToScene` |
| Assets dirección B | `client/public/assets/b/<tipo>/<id>[_pose].webp` | `heroes/mage_attack.webp` |
| Migraciones | `0NN_descripcion.js` | `035_hub_layout.js` |

## Estructura de archivo

- Cabecera opcional de 1-3 líneas explicando *qué* es el módulo y su contrato
  cuando no es obvio por el nombre.
- Services: un objeto literal exportado (ver plantilla en
  `docs/project-spec.md` §4.1). Routes: plantilla §2.1.

## Verificación (qué cuenta como `Evidencia:`)

| Tipo de cambio | Evidencia mínima |
|---|---|
| Server (service/route/migración/gameTick) | Test Jest en `server/tests/<dominio>.test.js` + `cd server && npx jest --runInBand --forceExit` en verde (citar `Tests: N passed`) |
| Lógica pura de cliente (store, utils, mapeos) | Test Vitest en `client/src/tests/` + `cd client && npx vitest run` |
| Componente React | Test Vitest/Testing Library cuando tenga lógica; si es solo presentación, evidencia visual |
| Escena Phaser / arte / layout | **Evidencia visual**: screenshot(s) Playwright en viewport 412×860 @2x guardados en `specs/<feature>/evidencia/` (webp), con la ruta citada y una línea de qué se verifica en cada uno; consola sin errores (citar). Si hay animación, además fps medidos |
| Assets generados | Hoja de contacto sobre fondo oscuro en `specs/<feature>/evidencia/` + confirmación de revisión (sin cabezas extra, orientación, recorte limpio) |
| Integración de punta a punta | Build del contenedor (`docker compose -f docker-compose.local.yml up -d --build`) + probes HTTP o flujo Playwright contra `:3001` con device-id |

Reglas:

- Los tests se corren completos, no solo el archivo nuevo: no se aceptan
  regresiones. Fallos **preexistentes** están listados en `feature_list.json`
  (`known_failures`); uno nuevo bloquea el cierre.
- La verificación visual se hace con navegador headless con GPU:
  `chromium.launch({ channel: 'chromium', args: ['--use-angle=d3d11', '--enable-gpu'] })`.
- Sesión de prueba sin Telegram: header `x-device-id` (o `localStorage
  kh_device_id`); en dev `SKIP_AUTH` según `docs/project-spec.md` §11.

## Manejo de errores

Ver `docs/architecture.md` §5. Mensajes de error al jugador: cortos, en
español, sin detalles internos.

## Comentarios

Por defecto **no** se escriben. Solo cuando explican un *por qué* no obvio
(invariante de sql.js, workaround documentado, decisión de balance).
