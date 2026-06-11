#!/usr/bin/env bash
# scripts/backup/restore_postgres.sh
# Restores PostgreSQL from a MinIO backup.
#
# Usage:
#   # List available backups
#   ./scripts/backup/restore_postgres.sh --list
#
#   # Restore latest backup
#   ./scripts/backup/restore_postgres.sh --latest
#
#   # Restore specific backup
#   ./scripts/backup/restore_postgres.sh --file postgres_fraud_db_20240615_030000.sql.gz

set -euo pipefail

POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_USER="${POSTGRES_USER:-fraud_admin}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-fraud_secret_2024}"
POSTGRES_DB="${POSTGRES_DB:-fraud_db}"
MINIO_ENDPOINT="${MINIO_ENDPOINT:-http://localhost:9000}"
MINIO_ACCESS_KEY="${MINIO_ACCESS_KEY:-fraud_minio}"
MINIO_SECRET_KEY="${MINIO_SECRET_KEY:-fraud_minio_2024}"
MINIO_BUCKET="${MINIO_BUCKET:-backups}"
TMP_DIR="${TMP_DIR:-/tmp/fraud_restore}"

GREEN="\033[32m"; RED="\033[31m"; AMBER="\033[33m"; RESET="\033[0m"
log()  { echo -e "$(date -u +"%Y-%m-%dT%H:%M:%SZ") | $*"; }
ok()   { log "${GREEN}OK${RESET}  $*"; }
err()  { log "${RED}ERR${RESET} $*" >&2; exit 1; }
warn() { log "${AMBER}WARN${RESET} $*"; }

MODE="${1:---latest}"
FILE_ARG="${2:-}"

# ---------------------------------------------------------------------------
# List backups
# ---------------------------------------------------------------------------
list_backups() {
    log "Available PostgreSQL backups:"
    python3 - << PYEOF
from minio import Minio
client = Minio(
    "${MINIO_ENDPOINT}".replace("http://","").replace("https://",""),
    access_key="${MINIO_ACCESS_KEY}",
    secret_key="${MINIO_SECRET_KEY}",
    secure=False,
)
objects = sorted(
    [o for o in client.list_objects("${MINIO_BUCKET}", prefix="postgres/", recursive=True)],
    key=lambda o: o.object_name,
    reverse=True,
)
for i, o in enumerate(objects):
    size = f"{o.size / 1024 / 1024:.1f} MB" if o.size else "?"
    print(f"  [{i+1}] {o.object_name}  ({size})")
if not objects:
    print("  No backups found")
PYEOF
}

# ---------------------------------------------------------------------------
# Download backup from MinIO
# ---------------------------------------------------------------------------
download_backup() {
    local obj_name="$1"
    local local_path="$2"
    python3 - << PYEOF
from minio import Minio
client = Minio(
    "${MINIO_ENDPOINT}".replace("http://","").replace("https://",""),
    access_key="${MINIO_ACCESS_KEY}",
    secret_key="${MINIO_SECRET_KEY}",
    secure=False,
)
client.fget_object("${MINIO_BUCKET}", "${obj_name}", "${local_path}")
print(f"Downloaded: ${local_path}")
PYEOF
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
mkdir -p "$TMP_DIR"

case "$MODE" in
    --list)
        list_backups
        exit 0
        ;;

    --latest)
        log "Finding latest backup..."
        OBJ_NAME=$(python3 - << PYEOF
from minio import Minio
client = Minio(
    "${MINIO_ENDPOINT}".replace("http://","").replace("https://",""),
    access_key="${MINIO_ACCESS_KEY}",
    secret_key="${MINIO_SECRET_KEY}",
    secure=False,
)
objects = sorted(
    [o for o in client.list_objects("${MINIO_BUCKET}", prefix="postgres/", recursive=True)],
    key=lambda o: o.object_name,
    reverse=True,
)
print(objects[0].object_name if objects else "NONE")
PYEOF
)
        if [[ "$OBJ_NAME" == "NONE" ]]; then
            err "No backups found in s3://${MINIO_BUCKET}/postgres/"
        fi
        ;;

    --file)
        [[ -z "$FILE_ARG" ]] && err "Specify filename: --file postgres_fraud_db_YYYYMMDD_HHMMSS.sql.gz"
        OBJ_NAME="postgres/${FILE_ARG}"
        ;;

    *)
        err "Usage: $0 --list | --latest | --file <filename>"
        ;;
esac

LOCAL_PATH="${TMP_DIR}/$(basename "$OBJ_NAME")"

log "=== PostgreSQL Restore ==="
log "Source:   s3://${MINIO_BUCKET}/${OBJ_NAME}"
log "Target:   ${POSTGRES_DB} @ ${POSTGRES_HOST}:${POSTGRES_PORT}"
log ""
warn "This will OVERWRITE the existing database. Press Ctrl+C to cancel (10s)..."
sleep 10

# Download
log "Downloading backup..."
download_backup "$OBJ_NAME" "$LOCAL_PATH"
ok "Downloaded: $(du -sh "$LOCAL_PATH" | cut -f1)"

# Restore
log "Restoring..."
PGPASSWORD="$POSTGRES_PASSWORD" psql \
    -h "$POSTGRES_HOST" \
    -p "$POSTGRES_PORT" \
    -U "$POSTGRES_USER" \
    -d postgres \
    -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${POSTGRES_DB}' AND pid <> pg_backend_pid();"

PGPASSWORD="$POSTGRES_PASSWORD" psql \
    -h "$POSTGRES_HOST" \
    -p "$POSTGRES_PORT" \
    -U "$POSTGRES_USER" \
    -d postgres \
    -c "DROP DATABASE IF EXISTS ${POSTGRES_DB}; CREATE DATABASE ${POSTGRES_DB} OWNER ${POSTGRES_USER};"

zcat "$LOCAL_PATH" | PGPASSWORD="$POSTGRES_PASSWORD" psql \
    -h "$POSTGRES_HOST" \
    -p "$POSTGRES_PORT" \
    -U "$POSTGRES_USER" \
    -d "$POSTGRES_DB"

rm -f "$LOCAL_PATH"
ok "Restore complete from: $OBJ_NAME"
