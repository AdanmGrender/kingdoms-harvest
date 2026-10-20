# Arquitectura — Qué significa "hacer un buen trabajo" en Kingdoms Harvest

> Los revisores evalúan código contra este archivo. Si no está acá (o en
> `docs/project-spec.md`, que tiene los contratos detallados), no es requisito.

## Principios

1. **Capas.**

   ```
   shared/                 — catálogos y constantes de juego (gameConfig, tokenConfig). Sin IO.
   server/src/routes/      — HTTP: telegramAuth + validate() + try/catch → service. Sin lógica de negocio.
   server/src/services/    — lógica de negocio. Lanza Error('mensaje legible'). Única capa que escribe DB.
   server/src/config/database.js — query builder sobre sql.js (único acceso a DB).
   server/src/game/gameTick.js   — cron: subsistemas con try/catch independiente (producción idle, tormentas, tributo).
   client/src/services/    — clientes axios por dominio (sin estado).
   client/src/store/       — Zustand (gameStore): estado del jugador, llamadas a services, overlays.
   client/src/components/  — React = "chrome": HUD, paneles, botones, textos.
   client/src/game/        — Phaser = escenas (hub, combate, mundo), entidades, FX.
   client/src/game/EventBridge.js — único canal Phaser ↔ React.
   ```

   No introducir capas nuevas sin razón documentada en el `design.md` de la feature.

2. **Server-authoritative.** Recursos, producción, combate, recompensas y
   tiempos los calcula el server. El cliente **reproduce** resultados (p. ej. la
   escena de combate anima los deltas que devuelve `stepInstance`); nunca decide.

3. **Phaser ↔ React solo por EventBridge.** Phaser no importa componentes
   React; React no importa clases Phaser. Todo listener registrado en un
   `useEffect` devuelve su cleanup. Eventos nuevos se documentan en
   `docs/project-spec.md` §9.2.

4. **Dependencias externas.** Se permiten las ya presentes en los
   `package.json`. Una dependencia nueva de runtime (cliente o server) se
   justifica en el `design.md` con alternativa descartada; las de tooling
   (scripts de arte, tests) pueden ir a `devDependencies` de la raíz.

5. **Manejo de errores.** Services: `throw new Error('mensaje para el
   jugador')`. Routes: `res.status(400).json({ error: safeErrorMessage(e) })`.
   Cliente: errores de API → `addNotification(msg, 'error')`; nunca pantalla en
   blanco. Escenas Phaser: un asset que falta degrada (placeholder), no rompe.

6. **Estado.** Estado del jugador en el server; en el cliente vive en
   `gameStore` (Zustand). Las escenas Phaser leen del store/registry vía
   EventBridge y no guardan estado de negocio propio.

7. **Persistencia / IO.** Solo vía query builder; operaciones con dinero o
   recursos en `db.transaction` con decrementos atómicos (`decrementIfEnough`).
   Invariantes de sql.js en `docs/project-spec.md` §3.2. Cambios de schema →
   migración numerada `server/migrations/0NN_*.js`.

8. **Arte y presentación (dirección B).** Todo asset nuevo cumple
   `docs/art-direction-b.md`: grimdark renacentista, webp en
   `client/public/assets/b/`, generado y procesado con `scripts/gen_art_b.js` /
   `process_art_b.js`, revisado a ojo antes de integrarse. Textos visibles con
   los nombres de `docs/lore-glosario.md`. Tipografía IM Fell English
   empaquetada (sin Google Fonts: la CSP lo bloquea y la APK debe andar offline).

9. **Rendimiento móvil.** Objetivo ≥ 50 fps en el emulador `vault`. FX caros
   (bloom, partículas) con niveles de calidad. Imágenes en webp, fondos ≤ 1080 px
   de ancho.

## Flujo de datos

```
gameTick (cada 60 s) ──► produce recursos / tormentas / tributo ──► DB
                                                                     ▲
jugador ─► React (chrome) ─► gameStore ─► services axios ─► /api/* ─► route ─► service ─► database.js
             ▲     │                                                    │
             │     └─ EventBridge ─► escena Phaser (anima el estado)    │
             └──────────────── respuesta JSON / socket.io ◄─────────────┘
```

Ritual idle de cada sesión: volver → reporte offline (tope 12 h) → recoger →
gastar en edificios/héroes → 1-2 instancias de combate → salir.

## Qué NO hacer

- Lógica de negocio o números de balance en el cliente (cliente = vista).
- Multiplicar o regalar KH desde cualquier feature no especificada en
  `docs/project-spec.md` §7 (dinero real).
- Renombrar ids de datos (recursos, edificios, héroes, nodos): solo textos.
- Usar nombres, facciones, símbolos o artistas de franquicias ajenas.
- Emojis como íconos en UI nueva de la dirección B.
- Importar React desde Phaser o Phaser desde React.
- `sql.js` directo, SQL concatenado, o llamar `saveToDisk()` a mano.
- Commitear `.env`, crudos de arte 2K, videos o archivos comprimidos.
