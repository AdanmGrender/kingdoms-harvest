#!/bin/bash
# Probe every API endpoint mounted in server/src/index.js to spot 404 (broken
# route) vs 401 (mounted, auth required — healthy).
BASE="https://adamn-vps.duckdns.org"

probe() {
  local path="$1"
  local method="${2:-GET}"
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" "$BASE$path")
  local status="OK"
  if [ "$code" = "404" ]; then status="🚫 404 MISSING"
  elif [ "$code" = "500" ]; then status="💀 500 CRASH"
  elif [ "$code" = "401" ]; then status="🔐 401 (mounted)"
  elif [ "$code" = "400" ]; then status="📨 400 (mounted)"
  elif [ "$code" = "200" ]; then status="✅ 200"
  else status="? $code"
  fi
  printf "%-45s %s %s\n" "$path" "$method" "$status"
}

echo "=== Phase 2/3/4 (iso-rework) ==="
probe /api/health GET
probe /api/factions GET
probe /api/factions/me GET
probe /api/territories GET
probe /api/achievements GET
probe /api/marketplace GET
probe /api/marketplace/listings GET
probe /api/alliances GET
probe /api/alliances/me GET
probe /api/events/active GET
probe /api/tournaments/active GET
probe /api/wars/faction/active GET
probe /api/wars/alliance/active GET
probe /api/missions GET
probe /api/tech/tree GET
probe /api/combat/battles GET
probe /api/villagers GET
probe /api/sieges GET

echo ""
echo "=== Parallel WiFOf branch ==="
probe /api/crafting GET
probe /api/heroes GET
probe /api/world-events GET
probe /api/notifications/prefs GET
probe /api/market GET
probe /api/seasonal GET
probe /api/seasonal/active GET
probe /api/prestige GET
probe /api/guilds GET
probe /api/guilds/mine GET

echo ""
echo "=== Player/Token base ==="
probe /api/player/leaderboard GET
probe /api/player/search?q=ab GET
probe /api/tokens GET
probe /api/tasks/daily GET
probe /api/tasks/social GET
probe /api/referral GET
probe /api/buildings GET
probe /api/farm/plots GET
