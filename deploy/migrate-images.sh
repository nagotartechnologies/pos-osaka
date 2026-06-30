#!/usr/bin/env bash
# Sube las imagenes del respaldo a Supabase Storage (bucket 'media'),
# preservando el path = URL sin esquema (host/path).
# Ejecutar en el servidor: bash /root/osaka/migrate-images.sh
set -uo pipefail

BACKUP_DIR="/root/osaka/backups/images-backup"
ENV_FILE="/root/osaka/backend/.env"
KONG="http://127.0.0.1:8000"
BUCKET="media"

SERVICE=$(grep '^SERVICE_ROLE_KEY=' "$ENV_FILE" | cut -d= -f2-)
URLS="$BACKUP_DIR/_urls.txt"

ctype() {
  case "${1##*.}" in
    webp) echo "image/webp" ;;
    jpg|jpeg) echo "image/jpeg" ;;
    png) echo "image/png" ;;
    gif) echo "image/gif" ;;
    avif) echo "image/avif" ;;
    svg) echo "image/svg+xml" ;;
    pdf) echo "application/pdf" ;;
    *) echo "application/octet-stream" ;;
  esac
}

OK=0; MISS=0; ERR=0; i=0
TOTAL=$(grep -c . "$URLS")

while IFS= read -r url; do
  [ -z "$url" ] && continue
  i=$((i+1))
  noscheme="${url#http://}"; noscheme="${noscheme#https://}"
  noscheme="${noscheme%%\?*}"
  host="${noscheme%%/*}"
  path="${noscheme#*/}"
  flatname=$(printf '%s' "$path" | tr '/' '_')
  localfile="$BACKUP_DIR/$host/$flatname"
  storagepath="$noscheme"

  if [ ! -f "$localfile" ]; then
    MISS=$((MISS+1)); echo "MISS [$i/$TOTAL] $localfile"; continue
  fi

  code=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "$KONG/storage/v1/object/$BUCKET/$storagepath" \
    -H "Authorization: Bearer $SERVICE" \
    -H "apikey: $SERVICE" \
    -H "x-upsert: true" \
    -H "Content-Type: $(ctype "$localfile")" \
    --data-binary "@$localfile")

  if [ "$code" = "200" ] || [ "$code" = "201" ]; then
    OK=$((OK+1))
  else
    ERR=$((ERR+1)); echo "ERR [$i/$TOTAL] code=$code $storagepath"
  fi
done < "$URLS"

echo ""
echo "Subidas OK: $OK | Faltantes: $MISS | Errores: $ERR | Total URLs: $TOTAL"
