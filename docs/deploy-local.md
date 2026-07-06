# Deploy local con Docker (esta PC)

El juego completo (server Express + cliente React ya bundleado) corre en **un
solo contenedor**: en `NODE_ENV=production` el server sirve `client/dist` como
estáticos con SPA fallback, así que `:3001` = juego entero.

## Arrancar

```powershell
# Docker Desktop debe estar corriendo (engine Linux)
cd "E:\New folder\kingdoms-harvest"
docker compose -f docker-compose.local.yml up -d --build
# → http://localhost:3001
```

- Estado / logs: `docker compose -f docker-compose.local.yml logs -f`
- Parar: `docker compose -f docker-compose.local.yml down`
- Rebuild tras cambios de código: agregá `--build` al `up`.

El estado persistente (DB sql.js, secrets) vive en el volumen
`kingdoms-harvest_kingdoms-data` (montado en `/data`), así que sobrevive a
reinicios del contenedor.

## Requisitos

- `server/.env` con al menos `BOT_TOKEN` (se inyecta vía `env_file`, no se
  hornea en la imagen — `.dockerignore` excluye `.env`).
- Docker Desktop con backend Linux (WSL2).

## Exponerlo a Telegram (HTTPS público)

Una Mini App de Telegram necesita una **URL HTTPS pública**. El contenedor
escucha en `127.0.0.1:3001` (HTTP), así que hace falta un túnel:

```powershell
# Opción A — cloudflared (quick tunnel, sin cuenta, URL temporal)
cloudflared tunnel --url http://localhost:3001

# Opción B — ngrok
ngrok http 3001
```

El túnel imprime una URL `https://xxxx.trycloudflare.com`. Entonces:

1. Poné esa URL en `server/.env` → `WEBAPP_URL=https://xxxx...` (CORS) y
   reiniciá el contenedor (`up -d`).
2. En **@BotFather** → tu bot → *Bot Settings → Menu Button / Mini App URL* →
   pegá la misma URL.
3. Abrí el bot en Telegram → botón → el juego carga con `initData` real y la
   API deja de dar 401.

⚠️ La URL de `trycloudflare` cambia en cada arranque del túnel. Para algo
estable: dominio propio + Cloudflare Tunnel con nombre, o volver al VPS
(`docker-compose.yml` trae la config Traefik+SSL de producción).

## Verificación rápida (sin Telegram)

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/           # 200 (juego)
curl -s -X POST http://localhost:3001/api/player/init -d '{}' \
  -H "Content-Type: application/json" -o /dev/null -w "%{http_code}\n"     # 401 (auth OK)
```

200 en `/` = sirve el juego. 401 en la API sin sesión = la seguridad de
producción funciona (no bypass fuera de dev).
