# Pivote a APK Android (adiós Telegram) — Fase 1: APK de prueba

> Diseño aprobado 2026-09-15. Rama `feat/android-apk`. Convierte el cliente
> React/Vite/Phaser (hoy Telegram Mini App) en una **APK Android nativa** vía
> **Capacitor**, reusando todo el cliente. Fase 1 = APK debug que CORRE el juego
> contra el server local, sin Telegram. Hosting/pago/cripto = fases posteriores.

## 0. Contexto

El cliente ya es web (React 18 + Vite 6 + Phaser 3.90). El acoplamiento a
Telegram está en 6 archivos, casi todo con guardas `?.` (degrada). Ataduras
funcionales: header `x-telegram-init-data` (`services/api.js`), `initData` en el
handshake del socket y en `initGame` (`store/gameStore.js`, `services/socketService.js`).
El socket YA lee `VITE_API_URL`; la API usa `baseURL:'/api'` relativo (rompe en
APK: no hay proxy Vite). Toolchain listo: Android SDK (licencias OK), JDK 21.

## 1. Contrato (Fase 1)

```
ENTRADA:  usuario abre la APK en emulador (AVD 'vault') o teléfono.
SALIDA:   el juego CORRE en Android — menú → hub → operaciones/combate — hablando
          con el server Express local, SIN Telegram.
INVARIANTES:
  - No se reescribe el cliente: Capacitor lo envuelve tal cual.
  - Server local sin cambios de lógica de juego; solo se le agrega una vía de
    auth por dispositivo y CORS para el origen Capacitor.
  - Nada de Telegram en el arranque (guardas para que no rompa standalone).
FUERA DE ALCANCE (fases 2+): hosting del backend, Google Play Billing, política
  de cripto en tiendas, auth fuerte (Google Sign-In/attestation), release firmado.
```

## 2. Componentes / cambios

### 2.1 Empaquetado (Capacitor)
- `client/`: `@capacitor/core`, `@capacitor/cli`, `@capacitor/android`, `@capacitor/preferences`.
- `capacitor.config` → `appId` `com.kingdomsharvest.app`, `appName` "Kingdoms Harvest",
  `webDir: 'dist'`. Plataforma `android` agregada (`client/android/`).
- Build: `npm run build` → `npx cap sync android` → Gradle `assembleDebug`.

### 2.2 Backend alcanzable
- `services/api.js`: `baseURL = (import.meta.env.VITE_API_URL ?? '') + '/api'`
  (absoluto en APK, relativo `/api` en web/dev).
- Default de build APK: `VITE_API_URL=http://10.0.2.2:3001` (emulador → host).
  Teléfono real: IP LAN de la PC o túnel (se cambia el env y se re-buildea).
- Server `index.js` CORS: permitir orígenes Capacitor
  (`capacitor://localhost`, `http://localhost`, `https://localhost`) además de WEBAPP_URL.

### 2.3 Auth por dispositivo (reemplaza HMAC de Telegram)
- Cliente: `services/deviceId.js` — genera/lee un UUID persistente
  (Capacitor Preferences, fallback localStorage). Lo manda como header
  `x-device-id` en `api.js` y en el handshake del socket.
- `initGame`/`connectSocket`: si NO hay Telegram, usar la vía device-id.
- Server `middleware/telegramAuth.js`: si llega `x-device-id` (y no hay
  Telegram initData), derivar un `playerId` entero ESTABLE del UUID (hash) →
  reúsa todo el sistema de jugador (la "telegram_id" pasa a ser id por
  dispositivo). Mismo tratamiento en el auth del socket (`join_game`).
- ⚠️ Auth débil (cualquiera puede mandar un device-id) — aceptable SOLO para
  Fase 1 de prueba; Fase 2 endurece (Sign-In/attestation).

### 2.4 Desacople de Telegram
- Guardar las llamadas restantes (`tg.ready/expand/setHeaderColor`, flujos de
  invoice de Stars) para que el arranque standalone no rompa. El menú entra al hub.

## 3. Criterios de aceptación (Fase 1)

- `assembleDebug` produce un APK instalable.
- Instalado en el emulador `vault`, el juego arranca (menú → "Entrar al Bastión"
  → hub con personajes moviéndose), sin errores de consola de arranque, hablando
  con el server local (init de jugador por device-id devuelve 200).
- Sin Telegram: no hay 401 ni pantalla "Error al iniciar el juego".
- Tests del server siguen pasando (la vía device-id no rompe la de HMAC).

## 4. Riesgos

- Fricción de build Gradle (descargas, versión de plugin Android Gradle vs JDK 21) —
  se resuelve fijando versiones compatibles con Capacitor 6.
- El WebView + WebGL de Phaser en emulador puede ir lento (usar dispositivo real
  si el emulador no rinde). No es bug, es rendimiento de emulador.
