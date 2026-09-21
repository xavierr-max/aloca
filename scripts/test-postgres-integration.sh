#!/usr/bin/env bash
set -Eeuo pipefail

container_name="aloca-postgres-tests"
port="${ALOCA_TEST_POSTGRES_PORT:-55432}"
connection="Host=127.0.0.1;Port=${port};Database=aloca_tests;Username=aloca;Password=aloca_test_password"
cleanup() { docker rm -f "$container_name" >/dev/null 2>&1 || true; }
trap cleanup EXIT
cleanup
docker run --rm -d --name "$container_name" -e POSTGRES_DB=aloca_tests -e POSTGRES_USER=aloca -e POSTGRES_PASSWORD=aloca_test_password -p "${port}:5432" postgres:18 >/dev/null
for attempt in {1..60}; do
  if docker exec "$container_name" pg_isready -U aloca -d aloca_tests >/dev/null 2>&1; then break; fi
  sleep 1
done
export ALOCA_TEST_POSTGRES_CONNECTION="$connection"
dotnet test tests/Aloca.Api.Tests/Aloca.Api.Tests.csproj --no-restore --filter FullyQualifiedName~PostgresIntegrationTests
