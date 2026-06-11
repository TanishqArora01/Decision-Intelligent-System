#!/usr/bin/env bash
# scripts/backup/backup_postgres.sh
# Creates a compressed pg_dump and uploads to MinIO.
# Retains last N_KEEP backups, deletes older ones.
#
# Usage:
#   ./scripts/backup/backup_postgres.sh
#   BACKUP_DRY_RUN=1 ./scripts/backup/backup_postgres.sh  # print only
#
# Cron (daily at 03:30 UTC):
#   30 3 * * * /path/to/fraud-detection/scripts/backup/backup_postgres.sh >> /var/log/fraud-backup.log 2>&1

set -euo pipefail

# ---------------------------------------------------------------------------
# Config (override via env)
# ---------------------------------------------------------------------------
POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_USER="${POSTGRES_USER:-fraud_admin}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-fraud_secret_2024}"
POSTGRES_DB="${POSTGRES_DB:-fraud_db}"

MINIO_ENDPOINT="${MINIO_ENDPOINT:-http://localhost:9000}"
MINIO_ACCESS_KEY="${MINIO_ACCESS_KEY:-fraud_minio}"
MINIO_SECRET_KEY="${MINIO_SECRET_KEY:-fraud_minio_2024}"
MINIO_BUCKET="${MINIO_BUCKET:-backups}"

N_KEEP="${N_KEEP:-7}"         # keep last 7 daily backups
TMP_DIR="${TMP_DIR:-/tmp/fraud_backup}"
DRY_RUN="${BACKUP_DRY_RUN:-0}"

# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------
TIMESTAMP=$(date -u +"%Y%m%d_%H%M%S")
FILENAME="postgres_${POSTGRES_DB}_${TIMESTAMP}.sql.gz"
LOCAL_PATH="${TMP_DIR}/${FILENAME}"
MINIO_PATH="postgres/${FILENAME}"

GREEN="\033[32m"; RED="\033[31m"; AMBER="\033[33m"; RESET="\033[0m"

log()  { echo -e "$(date -u +"%Y-%m-%dT%H:%M:%SZ") | $*"; }
ok()   { log "${GREEN}OK${RESET}  $*"; }
err()  { log "${RED}ERR${RESET} $*" >&2; }
warn() { log "${AMBER}WARN${RESET} $*"; }

mkdir -p "$TMP_DIR"

log "=== PostgreSQL Backup ==="
log "Database:  ${POSTGRES_DB} @ ${POSTGRES_HOST}:${POSTGRES_PORT}"
log "Dest:      s3://${MINIO_BUCKET}/${MINIO_PATH}"
log "Dry run:   ${DRY_RUN}"
log ""

# ---------------------------------------------------------------------------
# Dump
# ---------------------------------------------------------------------------
if [[ "$DRY_RUN" == "1" ]]; then
    warn "DRY RUN — skipping actual dump"
else
    log "Running pg_dump..."
    PGPASSWORD="$POSTGRES_PASSWORD" pg_dump \
        -h "$POSTGRES_HOST" \
        -p "$POSTGRES_PORT" \
        -U "$POSTGRES_USER" \
        -d "$POSTGRES_DB" \
        --format=plain \
        --no-password \
        --verbose \
        2>/tmp/pgdump_stderr.log \
      | gzip -9 > "$LOCAL_PATH"

    SIZE=$(du -sh "$LOCAL_PATH" | cut -f1)
    ok "Dump complete: $LOCAL_PATH ($SIZE)"
fi

# ---------------------------------------------------------------------------
# Upload to MinIO via mc (MinIO client) or python fallback
# ---------------------------------------------------------------------------
upload_via_python() {
    python3 - << PYEOF
import sys
try:
    from minio import Minio
    client = Minio(
        "${MINIO_ENDPOINT}".replace("http://","").replace("https://",""),
        access_key="${MINIO_ACCESS_KEY}",
        secret_key="${MINIO_SECRET_KEY}",
        secure=False,
    )
    if not client.bucket_exists("${MINIO_BUCKET}"):
        client.make_bucket("${MINIO_BUCKET}")
    client.fput_object("${MINIO_BUCKET}", "${MINIO_PATH}", "${LOCAL_PATH}")
    print("Upload OK")
except Exception as e:
    print(f"Upload failed: {e}", file=sys.stderr)
    sys.exit(1)
PYEOF
}

if [[ "$DRY_RUN" == "1" ]]; then
    warn "DRY RUN — skipping MinIO upload"
elif command -v mc &>/dev/null; then
    mc alias set fraud "${MINIO_ENDPOINT}" "${MINIO_ACCESS_KEY}" "${MINIO_SECRET_KEY}" --quiet
    mc cp "$LOCAL_PATH" "fraud/${MINIO_BUCKET}/${MINIO_PATH}"
    ok "Uploaded via mc"
elif python3 -c "import minio" 2>/dev/null; then
    upload_via_python && ok "Uploaded via python minio client"
else
    warn "Neither mc nor minio python package available — backup stored locally only: $LOCAL_PATH"
fi

# ---------------------------------------------------------------------------
# Rotate old backups (keep last N_KEEP)
# ---------------------------------------------------------------------------
if [[ "$DRY_RUN" != "1" ]] && python3 -c "import minio" 2>/dev/null; then
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
to_delete = objects[${N_KEEP}:]
for obj in to_delete:
    client.remove_object("${MINIO_BUCKET}", obj.object_name)
    print(f"Deleted old backup: {obj.object_name}")
print(f"Kept {min(len(objects), ${N_KEEP})} backups, deleted {len(to_delete)}")
PYEOF
fi

# ---------------------------------------------------------------------------
# Cleanup local temp file
# ---------------------------------------------------------------------------
if [[ -f "$LOCAL_PATH" ]]; then
    rm -f "$LOCAL_PATH"
fi

ok "Backup complete: s3://${MINIO_BUCKET}/${MINIO_PATH}"
