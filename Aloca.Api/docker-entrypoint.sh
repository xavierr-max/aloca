#!/bin/sh
set -eu

if [ -f /run/secrets/postgres_password ]; then
  postgres_password=$(cat /run/secrets/postgres_password)
  export ConnectionStrings__DefaultConnection="Host=${POSTGRES_HOST:-postgres};Port=5432;Database=${POSTGRES_DB};Username=${POSTGRES_USER};Password=${postgres_password}"
fi

exec dotnet Aloca.Api.dll
