#!/usr/bin/env bash
set -euo pipefail

compose_file="${COMPOSE_FILE:-compose.production.yml}"
backup_dir="${BACKUP_DIR:-backups/postgres}"
retention_days="${BACKUP_RETENTION_DAYS:-14}"
log_file="${BACKUP_LOG_FILE:-$backup_dir/backup.log}"
timestamp="$(date -u +%Y%m%d-%H%M%S)"
final_file="$backup_dir/aloca-postgres-$timestamp.dump"
temporary_file="$final_file.part"

umask 077
if [[ ! "$retention_days" =~ ^[1-9][0-9]*$ ]]; then
  printf 'BACKUP_RETENTION_DAYS must be a positive integer\n' >&2
  exit 2
fi

mkdir -p -- "$backup_dir"
chmod 700 -- "$backup_dir"
mkdir -p -- "$(dirname -- "$log_file")"
chmod 600 -- "$log_file" 2>/dev/null || true

cleanup() {
  rm -f -- "$temporary_file"
}
trap cleanup EXIT

log() {
  printf '{"timestamp":"%s","event":"backup.%s","backup_file":"%s"}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1" "${2:-}" >> "$log_file"
}

if ! docker compose -f "$compose_file" ps --status running --services | grep -qx postgres; then
  log "failed" "postgres_service_not_running"
  exit 1
fi

log "started" "$final_file"
if docker compose -f "$compose_file" exec -T postgres sh -ceu '
  export PGPASSWORD="$(cat /run/secrets/postgres_password)"
  pg_dump --format=custom --compress=9 --no-owner --no-privileges \
    --username="${POSTGRES_USER}" --dbname="${POSTGRES_DB}"
' > "$temporary_file"; then
  if ! pg_restore --list "$temporary_file" >/dev/null; then
    log "failed" "invalid_dump"
    exit 1
  fi
  mv -f -- "$temporary_file" "$final_file"
  chmod 600 -- "$final_file"
  sha256sum "$final_file" > "$final_file.sha256"
  chmod 600 -- "$final_file.sha256"
  log "completed" "$final_file"
else
  log "failed" "$final_file"
  exit 1
fi

# Only consider regular files directly under BACKUP_DIR with the exact dump name.
# Keep the newest dump even when a bad retention value or clock skew makes all
# other files appear expired.
mapfile -t backup_files < <(find "$backup_dir" -mindepth 1 -maxdepth 1 -type f \
  -regextype posix-extended -regex '.*/aloca-postgres-[0-9]{8}-[0-9]{6}\.dump' -printf '%f\n' | sort)

if ((${#backup_files[@]} > 1)); then
  cutoff_epoch="$(date -u -d "-$retention_days days" +%s)"
  newest_file="${backup_files[${#backup_files[@]}-1]}"
  for backup_name in "${backup_files[@]}"; do
    backup_path="$backup_dir/$backup_name"
    [[ "$backup_name" == "$newest_file" ]] && continue
    modified_epoch="$(stat -c '%Y' -- "$backup_path")"
    if ((modified_epoch < cutoff_epoch)); then
      rm -f -- "$backup_path" "$backup_path.sha256"
      log "expired_deleted" "$backup_path"
    fi
  done
fi
