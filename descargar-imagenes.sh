#!/usr/bin/env bash
# Descarga todas las imágenes referenciadas en el dump de la BD a ./images-backup
# Uso: bash descargar-imagenes.sh
set -uo pipefail

DUMP="${1:-backup-pos-osaka.sql}"
OUT="images-backup"

if [[ ! -f "$DUMP" ]]; then
  echo "No se encuentra el dump: $DUMP"
  exit 1
fi

mkdir -p "$OUT"

# Extraer URLs de imágenes únicas (http/https) del dump
grep -oE 'https?://[^"[:space:]\\]+\.(jpg|jpeg|png|webp|gif|avif|svg)' "$DUMP" \
  | sort -u > "$OUT/_urls.txt"

# También URLs de Cloudinary sin extensión explícita (image/upload/...)
grep -oE 'https?://res\.cloudinary\.com/[^"[:space:]\\]+' "$DUMP" \
  | sort -u >> "$OUT/_urls.txt"

sort -u "$OUT/_urls.txt" -o "$OUT/_urls.txt"

TOTAL=$(wc -l < "$OUT/_urls.txt" | tr -d ' ')
echo "URLs únicas encontradas: $TOTAL"

OK=0; FAIL=0; i=0
while IFS= read -r url; do
  [[ -z "$url" ]] && continue
  i=$((i+1))
  # carpeta por host
  host=$(echo "$url" | awk -F/ '{print $3}')
  # nombre de archivo a partir del path (reemplaza / por _)
  path=$(echo "$url" | sed -E 's#https?://[^/]+/##; s#[?].*$##')
  fname=$(echo "$path" | tr '/' '_')
  dir="$OUT/$host"
  mkdir -p "$dir"
  dest="$dir/$fname"
  if [[ -f "$dest" ]]; then OK=$((OK+1)); continue; fi
  if curl -fsSL --max-time 60 "$url" -o "$dest"; then
    OK=$((OK+1))
    printf "[%d/%d] OK  %s\n" "$i" "$TOTAL" "$url"
  else
    FAIL=$((FAIL+1))
    rm -f "$dest"
    printf "[%d/%d] ERR %s\n" "$i" "$TOTAL" "$url" >> "$OUT/_errores.txt"
    printf "[%d/%d] ERR %s\n" "$i" "$TOTAL" "$url"
  fi
done < "$OUT/_urls.txt"

echo
echo "Descargadas OK: $OK | Fallidas: $FAIL"
echo "Carpeta: $OUT"
[[ "$FAIL" -gt 0 ]] && echo "Errores en: $OUT/_errores.txt"
