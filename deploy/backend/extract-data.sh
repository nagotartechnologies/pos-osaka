#!/usr/bin/env bash
# Extrae solo los bloques COPY public.* (datos) del dump completo de Supabase.
set -euo pipefail
cd "$(dirname "$0")"

SRC="../../backup-pos-osaka.sql"
OUT="osaka-data.sql"

awk '
  /^COPY public\./ { capture=1 }
  capture { print }
  capture && /^\\\.$/ { capture=0 }
' "$SRC" > "$OUT"

echo "OK: $OUT generado"
echo "Bloques COPY: $(grep -c '^COPY public\.' "$OUT")"
echo "Lineas totales: $(wc -l < "$OUT")"
