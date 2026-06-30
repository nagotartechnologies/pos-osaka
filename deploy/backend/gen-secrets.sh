#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

b64url() { openssl base64 -A | tr '+/' '-_' | tr -d '='; }

JWT_SECRET=$(openssl rand -hex 32)
POSTGRES_PASSWORD=$(openssl rand -hex 24)
SECRET_KEY_BASE=$(openssl rand -hex 32)
VAULT_ENC_KEY=$(openssl rand -hex 16)
PG_META_CRYPTO_KEY=$(openssl rand -hex 16)
DASHBOARD_PASSWORD=$(openssl rand -hex 12)

iat=$(date +%s)
exp=$((iat + 60 * 60 * 24 * 365 * 10))

mkjwt() {
  local role="$1"
  local header payload sig
  header=$(printf '{"alg":"HS256","typ":"JWT"}' | b64url)
  payload=$(printf '{"role":"%s","iss":"supabase","iat":%s,"exp":%s}' "$role" "$iat" "$exp" | b64url)
  sig=$(printf '%s.%s' "$header" "$payload" | openssl dgst -binary -sha256 -hmac "$JWT_SECRET" | b64url)
  printf '%s.%s.%s' "$header" "$payload" "$sig"
}

ANON_KEY=$(mkjwt anon)
SERVICE_ROLE_KEY=$(mkjwt service_role)

{
  echo "############ Secrets ############"
  echo "POSTGRES_PASSWORD=$POSTGRES_PASSWORD"
  echo "JWT_SECRET=$JWT_SECRET"
  echo "ANON_KEY=$ANON_KEY"
  echo "SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY"
  echo "SECRET_KEY_BASE=$SECRET_KEY_BASE"
  echo "VAULT_ENC_KEY=$VAULT_ENC_KEY"
  echo "PG_META_CRYPTO_KEY=$PG_META_CRYPTO_KEY"
  echo "DASHBOARD_USERNAME=supabase"
  echo "DASHBOARD_PASSWORD=$DASHBOARD_PASSWORD"
  echo ""
  echo "############ Database ############"
  echo "POSTGRES_HOST=db"
  echo "POSTGRES_PORT=5432"
  echo "POSTGRES_DB=postgres"
  echo ""
  echo "############ JWT ############"
  echo "JWT_EXPIRY=3600"
  echo ""
  echo "############ PostgREST ############"
  echo "PGRST_DB_SCHEMAS=public"
  echo "PGRST_DB_EXTRA_SEARCH_PATH=public"
  echo "PGRST_DB_MAX_ROWS=1000"
  echo ""
  echo "############ Kong ############"
  echo "KONG_HTTP_PORT=8000"
  echo "KONG_HTTPS_PORT=8443"
  echo ""
  echo "############ URLs publicas ############"
  echo "SUPABASE_PUBLIC_URL=https://osakasushi.nagotartech.com"
  echo "API_EXTERNAL_URL=https://osakasushi.nagotartech.com"
  echo "SITE_URL=https://osakasushi.nagotartech.com"
  echo ""
  echo "############ Placeholders (servicios no usados) ############"
  echo "SUPABASE_PUBLISHABLE_KEY="
  echo "SUPABASE_SECRET_KEY="
  echo "ANON_KEY_ASYMMETRIC="
  echo "SERVICE_ROLE_KEY_ASYMMETRIC="
} > .env

echo "OK: .env generado"
