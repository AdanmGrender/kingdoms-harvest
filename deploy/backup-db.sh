#!/bin/bash

BACKUP_DIR="/home/kingdoms/backups"
DB_PATH="/home/kingdoms/app/server/data/kingdoms.db"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

if [ ! -f "$DB_PATH" ]; then
  echo "[$(date)] ERROR: Database not found at $DB_PATH"
  exit 1
fi

cp "$DB_PATH" "$BACKUP_DIR/kingdoms_${DATE}.db"

# Mantener solo los últimos 14 días de backups
find "$BACKUP_DIR" -name "kingdoms_*.db" -mtime +14 -delete

echo "[$(date)] Backup completado: kingdoms_${DATE}.db ($(du -h "$BACKUP_DIR/kingdoms_${DATE}.db" | cut -f1))"
