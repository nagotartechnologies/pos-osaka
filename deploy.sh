#!/usr/bin/env bash
# Deploy pos-osaka al VPS via rsync + docker compose
# Uso: bash deploy.sh
set -euo pipefail

VPS_HOST="root@docs.csec.cl"
VPS_PATH="/root/osaka/app"
COMPOSE_FILE="docker-compose.prod.yml"

echo "→ Sincronizando archivos al VPS..."
rsync -avz \
  --exclude node_modules \
  --exclude .next \
  --exclude .git \
  --exclude images-backup \
  --exclude .DS_Store \
  /Users/thomaslanderos/Desktop/pos-osaka/ \
  "$VPS_HOST:$VPS_PATH/"

echo "→ Reconstruyendo contenedor en el VPS..."
ssh "$VPS_HOST" "cd $VPS_PATH && docker compose -f $COMPOSE_FILE up -d --build"

echo "✓ Deploy completado"
