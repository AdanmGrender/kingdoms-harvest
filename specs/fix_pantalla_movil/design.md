# fix_pantalla_movil — Design

Solo cliente. Sin server, sin arte, sin textos nuevos. Todo aditivo (R-ND1).

## 1. Diagnóstico (del brief; lo no verificado se verifica en T1)

- **P1**: la raíz de la app es `relative w-screen h-screen` (`App.jsx:226`), o sea `100vh` = alto *grande* del viewport (con la barra de URL escondida). Con la barra visible, el visible real es menor y todo lo anclado a `bottom-0` del contenedor raíz queda debajo: `BottomNavBar` (`absolute bottom-0`, `BottomNavBar.jsx:28`) y los paneles de `OverlayManager` (`absolute inset-0`, `:126`). `BastionHub` usa `fixed inset-0`, que sí sigue el viewport visible; por eso la fila de Operaciones (`pb-[84px]`) se ve y la botonera no.
- **P2**: no hay `viewport-fit=cover` ni `env(safe-area-inset-*)` en `client/src`.
- **P3**: no hay tope de aspecto. El hub es *cover* sobre 824×1720 (aspecto 2.087), así que más alto de ≈2.09 solo recorta los costados del arte.
- **P4**: `ShopPanel.jsx:60-64` (`maxHeight: 78vh`) y `:87` (`calc(78vh - 56px)`). El 56 supone un encabezado que no está medido; y `vh` es el alto grande.
- **P5**: un solo montaje en prod; candidato dominante = doble efecto de StrictMode en dev. Sin verificar.

## 2. Decisión de arquitectura: un marco CSS + tokens

Un `AppFrame` envuelve la app en `main.jsx`; toda la geometría sale de variables CSS en `:root`. Nada de lógica de tamaño en cada componente.

```
<div class="kh-shell">          ← ancho 100vw, alto var(--kh-app-h), fondo #14110d (las bandas)
  <div class="kh-frame">        ← top: var(--kh-band); alto var(--kh-frame-h); contain: layout; overflow hidden
    <App />                     ← sus raíces pasan de "w-screen h-screen" a "w-full h-full"
  </div>
</div>
```

### 2.1 Tokens (bloque nuevo al final de `client/src/styles/index.css`)

```css
:root {
  --kh-max-aspect: 2.1;                       /* espejo de MAX_ASPECT (viewport.js) */
  --kh-app-h: 100vh;                          /* fallback */
  --kh-frame-h: min(var(--kh-app-h), calc(100vw * var(--kh-max-aspect)));
  --kh-band: calc((var(--kh-app-h) - var(--kh-frame-h)) / 2);
  --kh-safe-top:    max(0px, calc(env(safe-area-inset-top, 0px)    - var(--kh-band)));
  --kh-safe-bottom: max(0px, calc(env(safe-area-inset-bottom, 0px) - var(--kh-band)));
  --kh-safe-left:   env(safe-area-inset-left, 0px);
  --kh-safe-right:  env(safe-area-inset-right, 0px);
}
@supports (height: 100dvh) { :root { --kh-app-h: 100dvh; } }
.kh-shell { position: relative; width: 100vw; height: var(--kh-app-h); overflow: hidden; background: #14110d; }
.kh-frame { position: absolute; left: 0; right: 0; top: var(--kh-band); height: var(--kh-frame-h); overflow: hidden; contain: layout; }
```

- Los `var()` dentro de otros `var()` se resuelven en `:root`; el override inline de JS (`--kh-app-h`, §2.2) lo recalcula todo.
- Desktop (1280×720): `--kh-frame-h = min(720, 2688) = 720`, `--kh-band = 0`, safe = 0 → idéntico a hoy (R15, R18).
- `contain: layout` convierte al marco en el bloque contenedor de los descendientes `position: fixed` (OperationsMap, Calendar, Codex, Guild, Pass, Prestige, Seasonal, Withdrawal, NotificationPrefs, OfflineReport, CombatInstance, `BastionHub`): `inset-0` pasa a ser el marco, no el viewport (R19). Sin bandas, marco = viewport: igual que hoy. Es el punto de riesgo de esta feature → se verifica con capturas de cada overlay `fixed` (T9).
- `body { min-height: 100vh }` (`index.css:17`) pasa a `min-height: var(--kh-app-h)` para que el documento no sea más alto que lo visible.

### 2.2 `client/src/utils/viewport.js` (nuevo)

```js
export const MAX_ASPECT = 2.1;           // espejo de --kh-max-aspect (test)
export function computeAppHeight({ tgInitData, tgStableHeight, innerHeight, supportsDvh })  // → number | null
export function installViewportVars({ win = window, doc = document } = {})                 // → () => void (cleanup)
```

`computeAppHeight` (pura, R3 R5 R-ND7):
1. `tgInitData` truthy y `tgStableHeight > 0` → `Math.round(Math.min(tgStableHeight, innerHeight || Infinity))`.
2. `!supportsDvh` y `innerHeight > 0` → `Math.round(innerHeight)`.
3. Si no → `null` (se deja el valor CSS `100dvh`).

`installViewportVars`: calcula con `computeAppHeight` leyendo `win.Telegram?.WebApp` y `win.CSS?.supports?.('height', '100dvh')`; `doc.documentElement.style.setProperty('--kh-app-h', `${h}px`)` o `removeProperty` si `null`. Se engancha a `resize`, `orientationchange` y `tg.onEvent('viewportChanged', fn)` (si existe). Devuelve el cleanup. Se llama una vez en `main.jsx` antes de `createRoot` (no vive en un efecto de React, así que StrictMode no la duplica).

Por qué `viewportStableHeight` y no `viewportHeight`: el estable no salta mientras el usuario arrastra la hoja del Mini App, así que evita redimensionar el canvas a mitad de gesto. Se toma el mínimo con `innerHeight` por si Telegram reporta un valor viejo.

### 2.3 `client/src/components/ui/AppFrame.jsx` (nuevo)

```jsx
export default function AppFrame({ children }) {
  return <div className="kh-shell"><div className="kh-frame">{children}</div></div>;
}
```

`main.jsx` pasa de `<App />` a `<AppFrame><App /></AppFrame>` (dentro de `React.StrictMode`).

## 3. Archivos

| Archivo | Cambio |
|---|---|
| `client/index.html` | meta viewport + `, viewport-fit=cover` (R9) |
| `client/src/styles/index.css` | bloque de tokens y clases §2.1; `body min-height` (R1, R2, R10, R16-R20) |
| `client/src/utils/viewport.js` | **nuevo** §2.2 |
| `client/src/components/ui/AppFrame.jsx` | **nuevo** §2.3 |
| `client/src/main.jsx` | `installViewportVars()` + `<AppFrame>` |
| `client/src/App.jsx` | `w-screen h-screen`/`h-screen` → `w-full h-full`/`h-full` en las raíces (`:178`, `:186`, `:194`, `:207`, `:226`) (R8) |
| `client/src/components/menu/MainMenu.jsx:23` | `w-screen h-screen` → `w-full h-full` (R8) |
| `client/src/components/ui/LoadingScreen.jsx:6` | `h-screen` → `h-full` (R8) |
| `client/src/components/hud/TopResourceBar.jsx:81` | `pt-2` → `style={{ paddingTop: 'calc(0.5rem + var(--kh-safe-top))' }}` sobre el mismo div; el `px-2` pasa a `calc(0.5rem + safe-left/right)` solo si no rompe `TopResourceBar.test.jsx` (R11) |
| `client/src/components/hud/BottomNavBar.jsx:28` | `pb-2` → `paddingBottom: calc(0.5rem + var(--kh-safe-bottom))` (R12) |
| `client/src/components/hub/BastionHub.jsx` | `fixed inset-0` → `absolute inset-0` (el marco ya contiene); `pt-32` → `pt-[calc(8rem+var(--kh-safe-top))]`; `pb-[84px]` → `pb-[calc(84px+var(--kh-safe-bottom))]` (R11, R12, R14) |
| `client/src/styles/index.css` `.kh-rail` | `top: 128px` → `calc(128px + var(--kh-safe-top))`; `.kh-rail--left { left: calc(8px + var(--kh-safe-left)) }`, `--right` análogo (R11, R13) |
| `client/src/components/overlay/ShopPanel.jsx` | §4 (R22-R25) |
| `client/src/game/PhaserGame.jsx` | `ResizeObserver` + guard de canvas §5 (R6, R27, R28) |
| `client/src/tests/viewport.test.js` | **nuevo** §6 |

No se toca: `display.js`, `config.js`, `hubLayout.js`, `HubSceneB.js`, `server/`, `shared/`, `fix_superposiciones_ui` (píldora de clima, banner, TechTree, Logros, Settings).

## 4. ShopPanel (P4)

Hoy: contenedor `absolute inset-x-0 bottom-0` con `maxHeight: '78vh'`; zona con scroll con `maxHeight: calc(78vh - 56px)` (el 56 es una suposición).

Nuevo (mismos hijos, mismos textos):
- Contenedor: `maxHeight: '78%'` (porcentaje del bloque contenedor = `OverlayManager` `absolute inset-0` = marco) + `className` suma `flex flex-col`.
- Encabezado: `shrink-0`.
- Zona con scroll: quitar `maxHeight: calc(78vh - 56px)`; `className="flex-1 min-h-0 overflow-y-auto px-4 py-3"` y `paddingBottom: calc(0.75rem + var(--kh-safe-bottom))`.

Resultado: el alto del scroller = lo que sobra del 78 % menos el encabezado real, aunque el encabezado mida 53 o 60 px. Desktop 1280×720: 78 % de 720 = 78vh de 720 → igual. Si el 748 de P4 venía del encabezado y no de `vh`, esta forma lo corrige igual; T1 mide cuál era.

## 5. PhaserGame (P5 y resize)

- **ResizeObserver** sobre `#phaser-container`: llama a `handleResize` (la función existente). Cubre el cambio de `--kh-app-h` por Telegram sin `resize` de `window`. Se desconecta en el cleanup. Si `ResizeObserver` no existe, no hace nada (los listeners actuales siguen).
- **Guard de canvas**: justo antes de `new Phaser.Game(...)`, `container?.querySelectorAll('canvas').forEach((c) => c.remove())`. En el cleanup, tras `destroy(true)`, lo mismo (R28). No toca `gameRef`, listeners ni el registry. Con 1 canvas es un no-op.
- Si T1 muestra 2 canvas **en producción**, el guard queda y se anota la causa real en `tasks.md` (Bloqueado si requiere otra cosa). Si muestra 1 en prod y 2 solo en dev, el guard queda como cobertura de StrictMode/HMR.

## 6. Tests (Vitest, nuevos; no se modifica ninguno existente)

`client/src/tests/viewport.test.js`:
- `computeAppHeight`: Telegram válido (stable 640, inner 700 → 640; stable 720, inner 700 → 700); Telegram con `initData` vacío cae a dvh/innerHeight; `supportsDvh=false` → `innerHeight`; `supportsDvh=true` → `null`; stable 0 → no usa Telegram.
- `installViewportVars` con `win`/`doc` falsos: setea y quita `--kh-app-h`; registra y desregistra `resize`, `orientationchange` y `viewportChanged`.
- Texto de `index.html` contiene `viewport-fit=cover` y los otros tokens de siempre; `index.css` contiene `--kh-max-aspect: ${MAX_ASPECT}`, `@supports (height: 100dvh)`, `.kh-frame` con `contain: layout`.
- Barrido de `client/src/**/*.jsx` sin `h-screen`/`w-screen` (R1, R8; salvo comentarios).

## 7. Casos de error / bordes

- Sin `window.Telegram` o `initData` vacío (navegador, APK, dev): rama dvh/innerHeight.
- `viewportStableHeight` 0 o `undefined`: se ignora.
- Navegador sin `ResizeObserver`/`visualViewport`/`env()`: `env()` falla a `0px`; el resto cae a los listeners actuales.
- Orientación horizontal (desktop/tablet): aspecto < 1 → sin bandas; la app sigue siendo un layout vertical estirado como hoy (no se cambia).
- `100vw` incluye la barra de scroll en desktop; `body` es `overflow: hidden`, así que no hay barra.
- Teclado virtual (Chrome Android): `dvh` no lo descuenta (por defecto `interactive-widget=resizes-visual`); el marco no se encoge. Hoy tampoco. Sin cambio.

## 8. Alternativas descartadas

1. **Solo cambiar `h-screen` por `h-dvh` (Tailwind 3.4)**: arregla P1 en Chrome pero no cubre Telegram (`viewportStableHeight`), ni P2/P3, y deja 5 raíces con la misma clase; además requiere comprobar la versión de Tailwind. Se prefiere el token único.
2. **`window.visualViewport.height` como fuente principal**: tiene el mismo valor que `innerHeight` salvo con zoom o teclado, y se dispara en cada gesto de pinch; innerHeight + `resize` alcanza.
3. **Usar `--tg-viewport-stable-height` (CSS que inyecta telegram-web-app.js)**: ahorra el JS, pero no está verificado que el script la defina fuera de Telegram ni cuándo; la lectura explícita de `viewportStableHeight` es testeable.
4. **Centrar solo el chrome con el canvas a sangre (en vez de bandas)**: cada elemento absoluto necesitaría su propio offset; el marco con `contain: layout` lo resuelve en un lugar. Ver pregunta abierta 1.
5. **Cambiar el espacio lógico del hub o el cálculo cover para forzar 2.1**: toca `hubLayout.js`, `display.js` y sus tests fijados (R21, R-ND6). El marco deja el contenedor del canvas en ≤ 2.1 y el cálculo cover queda intacto.
6. **`transform: translateZ(0)` en vez de `contain: layout`** para contener los `fixed`: también crea un contexto de apilamiento y puede degradar el texto en WebViews viejos; `contain` es más acotado.

## 9. Riesgos

- `contain: layout` cambia el bloque contenedor de los `fixed` (§2.1): revisar cada overlay en 360×740 y 412×915.
- `TopResourceBar.jsx` está en la zona de `fix_superposiciones_ui` (S1): el cambio aquí es una propiedad; merge de esa rama primero (pregunta 7).
- `hudRails.test.jsx`/`TopResourceBar.test.jsx` no miran posición ni padding (brief §f), pero se corre la suite completa.
- La captura Playwright no tiene barras del navegador y no ve P1; la prueba de P1 es el emulador.
