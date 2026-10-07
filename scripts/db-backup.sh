#!/usr/bin/env bash
# Backup de la base de datos a un archivo comprimido.
#
# Uso: npm run db:backup
#
# Requiere: pg_dump en el PATH y DATABASE_URL exportada (apunta a la BD real,
# no a una cadena de placeholder). El dump se deja en ./backups/ con fecha.
#
# Los backups automáticos de Supabase NO sustituyen a esto: cubren el lado del
# proveedor, no errores operativos (DROP accidental, migración que revienta,
# credenciales filtradas). Este script es la red local.

set -euo pipefail

if [ -z "${DATABASE_URL:-}" ] || [[ "${DATABASE_URL}" == *"placeholder"* ]] || [[ "${DATABASE_URL}" == *"env("* ]]; then
  echo "[backup] ERROR: DATABASE_URL no está definida o es un placeholder." >&2
  exit 1
fi

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "[backup] ERROR: pg_dump no está instalado (apt-get install postgresql-client)." >&2
  exit 1
fi

mkdir -p backups

STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="backups/profesorapp-${STAMP}.sql.gz"

# Sin --clean para que el dump sea puramente aditivo sobre un esquema vacío.
pg_dump --dbname="$DATABASE_URL" \
        --no-owner \
        --no-acl \
        --format=plain \
  | gzip -9 > "$OUT"

SIZE="$(du -h "$OUT" | cut -f1)"

# Verificación: el .gz debe descomprimirse sin error.
if ! gzip -t "$OUT"; then
  echo "[backup] ERROR: el archivo generado está corrupto." >&2
  exit 1
fi

echo "[backup] OK -> ${OUT} (${SIZE})"

# Retención: conservar los 14 más recientes.
ls -1t backups/profesorapp-*.sql.gz 2>/dev/null | tail -n +15 | while read -r old; do
  echo "[backup] Eliminando backup antiguo: ${old}"
  rm -f "$old"
done

echo "[backup] Copia el archivo fuera del servidor (NAS, S3, otro equipo)."
echo "[backup] Un backup que vive en el mismo servidor no protege de perderlo."