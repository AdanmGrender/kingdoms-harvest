# Deploy de producción — estable y seguro (named Cloudflare Tunnel)

Reemplaza el **quick tunnel efímero** (URL aleatoria que cambia en cada
reinicio) por un **named tunnel** con hostname fijo, HTTPS real y **cero puertos
abiertos**. Sirve para esta PC Windows o cualquier host con Docker.

```
Telegram / navegador
      │  https://juego.tu-dominio.com   (TLS de Cloudflare)
      ▼
  Cloudflare edge  ──(túnel saliente, sin puertos entrantes)──►  cloudflared
                                                                    │ red interna
                                                                    ▼
                                                            kingdoms:3001 (Express)
```

La app **no publica ningún puerto**: `cloudflared` la alcanza por la red interna
de Docker. Nada escucha en el internet ni en la LAN.

---

## 1. Requisitos (una sola vez)

1. Cuenta **Cloudflare** (gratis) + un **dominio** añadido a Cloudflare (podés
   registrar uno barato o usar uno que ya tengas; el DNS lo maneja Cloudflare).
2. **Docker Desktop** corriendo en la PC.

## 2. Crear el named tunnel (una sola vez)

1. Cloudflare **Zero Trust** → **Networks → Tunnels → Create a tunnel** →
   *Cloudflared* → nombrelo `kingdoms`.
2. Copiá el **token** que muestra (una cadena larga). Es lo único que necesita
   el contenedor `cloudflared`.
3. En **Public Hostnames** del túnel, agregá:
   - Subdomain/Domain: p. ej. `juego.tu-dominio.com`
   - Service: **HTTP** → `kingdoms:3001`   ← nombre del servicio en Docker
4. Guardá. Cloudflare crea el registro DNS solo.

## 3. Configurar `server/.env`

```dotenv
BOT_TOKEN=123456:tu-token-de-bot
WEBAPP_URL=https://juego.tu-dominio.com   # EXACTO al public hostname (CORS/CSP)
TUNNEL_TOKEN=eyJ...el-token-del-paso-2...
BOT_POLLING=true
# Retiros TON reales (opcional hasta habilitarlos):
# TON_HOT_WALLET_MNEMONIC="palabra1 palabra2 ... palabra24"
# TON_NETWORK=mainnet
# REDIS_URL / SENTRY_DSN opcionales
```

> `.env` está gitignoreado y **no** entra a la imagen (se inyecta en runtime).
> Nunca commitees `BOT_TOKEN` ni `TUNNEL_TOKEN`.

## 4. Arrancar

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps        # kingdoms healthy + cloudflared up
docker compose -f docker-compose.prod.yml logs -f cloudflared   # "Registered tunnel connection"
```

Probar: abrir `https://juego.tu-dominio.com/api/health` → `{"status":"ok",...}`.

## 5. Apuntar el bot a la URL estable

En **@BotFather** → tu bot → *Bot Settings → Menu Button / Web App URL* →
`https://juego.tu-dominio.com`. (Ya no cambia en cada reinicio.)

## 6. Operación

```bash
# Actualizar tras git pull
docker compose -f docker-compose.prod.yml up -d --build

# Logs / estado
docker compose -f docker-compose.prod.yml logs -f kingdoms
docker compose -f docker-compose.prod.yml ps

# Backup de la DB (el volumen kingdoms-data monta /data; la DB vive en /data/db)
docker run --rm -v kingdoms-harvest_kingdoms-data:/data -v "$PWD:/backup" \
  busybox tar czf /backup/kh-db-$(date +%F).tar.gz -C /data db

# Parar
docker compose -f docker-compose.prod.yml down
```

---

## Checklist de endurecimiento (estado actual)

| Ítem | Estado |
|------|--------|
| Auth Telegram HMAC + ventana 5 min + timing-safe | ✅ ya |
| Dev-bypass (`SKIP_AUTH`) solo si `NODE_ENV !== production` | ✅ ya |
| `env.js`: el server **no arranca** en prod sin `BOT_TOKEN`/`WEBAPP_URL`, ni con `SKIP_AUTH=true` | ✅ nuevo |
| helmet (CSP + HSTS en prod) | ✅ ya |
| CORS: en prod solo `WEBAPP_URL` (localhost fuera) | ✅ nuevo |
| Rate-limit 100/min por IP sobre `/api` (+ Redis opcional) | ✅ ya |
| Body JSON máx 16 KB | ✅ ya |
| Contenedor **sin root** (`USER node`) + `no-new-privileges` | ✅ nuevo |
| HEALTHCHECK + `restart: unless-stopped` | ✅ nuevo |
| **Cero puertos publicados** (solo el túnel saliente) | ✅ nuevo |
| Límites de memoria/CPU + rotación de logs | ✅ nuevo |
| HTTPS real (TLS de Cloudflare) + hostname estable | ✅ nuevo |
| Retiros TON **reales** on-chain | ⏳ pendiente (hoy pseudo — ver §7 CLAUDE.md) |
| `frame-ancestors` para Telegram Web (si se embebe en iframe) | ⚠ revisar si falla en Telegram Web |

## Notas

- **NODE_ENV=production** lo fija el compose; con eso `env.js` valida secretos,
  se activan CSP/HSTS, y `window.__gameStore`/`__phaserGame` desaparecen del
  build del cliente (Vite los elimina).
- El **VPS de Hostinger sigue apagado**; este setup no lo necesita. Si algún día
  se reenciende con el bot activo, poné `BOT_POLLING=false` en uno de los dos
  para no duplicar el polling.
- Alternativa a Cloudflare: cualquier PaaS (Railway/Render/Fly.io) con la misma
  imagen Docker y `NODE_ENV=production` + las mismas env. El túnel es la opción
  gratis para hostear desde esta PC.
