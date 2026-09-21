#!/usr/bin/env bash
set -euo pipefail

compose_file="compose.production.yml"
lock_file=".aloca-production-migration.lock"

if ! command -v flock >/dev/null 2>&1; then
  echo "flock is required to serialize production migrations." >&2
  exit 1
fi

exec 9>"$lock_file"
flock -n 9 || {
  echo "Another production migration is already running." >&2
  exit 1
}

docker compose -f "$compose_file" run --rm api --migrate
