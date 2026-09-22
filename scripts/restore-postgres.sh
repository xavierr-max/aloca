#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 BACKUP_FILE" >&2
  exit 2
fi

compose_file="${COMPOSE_FILE:-compose.production.yml}"
restore_database="${RESTORE_DATABASE:-aloca_restore_test}"
production_database="${POSTGRES_DB:-aloca}"
backup_file="$1"

if [ ! -f "$backup_file" ]; then
  echo "Backup not found: $backup_file" >&2
  exit 1
fi

if [ -f "$backup_file.sha256" ]; then
  sha256sum --check "$backup_file.sha256"
fi

if [ "$restore_database" = "$production_database" ] && [ "${ALLOW_PRODUCTION_RESTORE:-}" != "yes" ]; then
  echo "Refusing to restore over production. Set RESTORE_DATABASE to a separate database." >&2
  exit 1
fi

docker compose -f "$compose_file" exec -T postgres sh -ceu '
  export PGPASSWORD="$(cat /run/secrets/postgres_password)"
  psql --username="${POSTGRES_USER}" --dbname=postgres \
    --set=restore_database="$1" <<SQL
SELECT pg_terminate_backend(pid) FROM pg_stat_activity
WHERE datname = :'restore_database' AND pid <> pg_backend_pid();
DROP DATABASE IF EXISTS :"restore_database";
CREATE DATABASE :"restore_database";
SQL
' sh "$restore_database"

cat "$backup_file" | docker compose -f "$compose_file" exec -T postgres sh -ceu '
  export PGPASSWORD="$(cat /run/secrets/postgres_password)"
  pg_restore --exit-on-error --no-owner --no-privileges \
    --username="${POSTGRES_USER}" --dbname="$1"
' sh "$restore_database"

echo "Restore completed into database: $restore_database"
