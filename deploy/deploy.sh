#!/bin/bash
set -e

APP_DIR="/home/kingdoms/app"

echo "========================================="
echo "  Kingdoms Harvest - Deploy"
echo "========================================="

cd "$APP_DIR"

# Live branch is iso-rework — origin/main is just a baseline snapshot.
# Override with DEPLOY_BRANCH=name ./deploy.sh to test other branches.
BRANCH="${DEPLOY_BRANCH:-iso-rework}"

echo ""
echo "=== Pulling latest code from $BRANCH ==="
git fetch origin
git checkout "$BRANCH"
git pull origin "$BRANCH"

echo ""
echo "=== Instalando dependencias del server ==="
cd server
npm install --production

echo ""
echo "=== Building client ==="
cd ../client
npm install
npm run build

echo ""
echo "=== Reiniciando aplicación ==="
cd "$APP_DIR"
# Migrations apply on boot via db.migrate.latest in server/src/index.js.
# pm2 reload restarts the running app; if it's not running yet, start it.
pm2 reload ecosystem.config.js || pm2 start ecosystem.config.js

echo ""
echo "=== Deploy completado ==="
pm2 status

echo ""
echo "Verificar health:"
echo "  curl http://localhost:3001/api/health"
echo ""
