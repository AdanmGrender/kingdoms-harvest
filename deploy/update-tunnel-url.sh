#!/bin/bash
# /root/update-tunnel-url.sh
# Auto-updates WEBAPP_URL, PM2, and Telegram Menu Button when tunnel URL changes

BOT_TOKEN="${BOT_TOKEN:-$(grep -oP 'BOT_TOKEN=\K.*' "$ENV_FILE")}"
ENV_FILE="/home/kingdoms/app/server/.env"
MAX_WAIT=60

echo "[tunnel-updater] Waiting for new tunnel URL..."

# Wait for cloudflared to output the URL (check last 5 min of logs)
for i in $(seq 1 $MAX_WAIT); do
  TUNNEL_URL=$(journalctl -u cloudflared-tunnel --no-pager -n 50 --since "5 minutes ago" 2>/dev/null | grep -oP 'https://[a-z0-9-]+\.trycloudflare\.com' | tail -1)
  if [ -n "$TUNNEL_URL" ]; then
    break
  fi
  sleep 2
done

if [ -z "$TUNNEL_URL" ]; then
  echo "[tunnel-updater] ERROR: Could not find tunnel URL after ${MAX_WAIT}s"
  exit 1
fi

# Get current URL from .env
CURRENT_URL=$(grep -oP 'WEBAPP_URL=\K.*' "$ENV_FILE")

if [ "$CURRENT_URL" = "$TUNNEL_URL" ]; then
  echo "[tunnel-updater] URL unchanged: $TUNNEL_URL — skipping"
  exit 0
fi

echo "[tunnel-updater] New tunnel URL: $TUNNEL_URL (was: $CURRENT_URL)"

# 1. Update .env
sed -i "s|WEBAPP_URL=.*|WEBAPP_URL=$TUNNEL_URL|" "$ENV_FILE"
echo "[tunnel-updater] .env updated"

# 2. Restart PM2 to pick up new WEBAPP_URL
HOME=/root PM2_HOME=/root/.pm2 pm2 restart kingdoms-harvest --update-env
echo "[tunnel-updater] PM2 restarted"

# 3. Update Telegram Bot Menu Button via API
RESPONSE=$(curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setChatMenuButton" \
  -H "Content-Type: application/json" \
  -d "{\"menu_button\":{\"type\":\"web_app\",\"text\":\"Play\",\"web_app\":{\"url\":\"${TUNNEL_URL}\"}}}")

if echo "$RESPONSE" | grep -q '"ok":true'; then
  echo "[tunnel-updater] Telegram Menu Button updated OK"
else
  echo "[tunnel-updater] ERROR updating Telegram: $RESPONSE"
fi

echo "[tunnel-updater] Done! URL: $TUNNEL_URL"
