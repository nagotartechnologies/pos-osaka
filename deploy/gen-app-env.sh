#!/usr/bin/env bash
# Genera deploy/app.env (produccion) a partir del .env actual,
# repuntando Supabase al backend self-host bajo el mismo dominio.
set -euo pipefail
cd "$(dirname "$0")/.."

ANON=$(grep '^ANON_KEY=' deploy/backend/.env | cut -d= -f2-)
DOMAIN="https://osakasushi.nagotartech.com"

sed -E \
  -e "s|^NEXT_PUBLIC_SUPABASE_URL=.*|NEXT_PUBLIC_SUPABASE_URL=${DOMAIN}|" \
  -e "s|^NEXT_PUBLIC_SUPABASE_ANON_KEY=.*|NEXT_PUBLIC_SUPABASE_ANON_KEY=${ANON}|" \
  -e "s|^NEXT_PUBLIC_SITE_URL=.*|NEXT_PUBLIC_SITE_URL=${DOMAIN}|" \
  .env > deploy/app.env

echo "OK: deploy/app.env generado"
echo "--- NEXT_PUBLIC_* (verificacion) ---"
grep -E '^NEXT_PUBLIC_' deploy/app.env | sed -E 's/(ANON_KEY=.{12}).*/\1.../'
