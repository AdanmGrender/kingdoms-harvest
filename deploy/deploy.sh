#!/bin/bash
set -e

APP_DIR="/home/kingdoms/app"

echo "========================================="
echo "  Kingdoms Harvest - Deploy"
echo "========================================="

cd "$APP_DIR"

echo ""
echo "=== Pulling latest code ==="
git pull origin main

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
pm2 reload ecosystem.config.js

echo ""
echo "=== Deploy completado ==="
pm2 status

echo ""
echo "Verificar health:"
echo "  curl http://localhost:3001/api/health"
echo ""
