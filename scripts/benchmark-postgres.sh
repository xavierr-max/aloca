#!/usr/bin/env bash
set -euo pipefail

container_name="aloca-postgres-benchmark"
port="${ALOCA_BENCHMARK_POSTGRES_PORT:-55433}"
connection="Host=localhost;Port=${port};Database=aloca_benchmark;Username=aloca;Password=aloca_benchmark_password"

cleanup() {
  docker rm -f "$container_name" >/dev/null 2>&1 || true
}
trap cleanup EXIT

cleanup
docker run --rm -d --name "$container_name" \
  -e POSTGRES_DB=aloca_benchmark \
  -e POSTGRES_USER=aloca \
  -e POSTGRES_PASSWORD=aloca_benchmark_password \
  -p "${port}:5432" postgres:18 >/dev/null

for attempt in {1..30}; do
  if docker exec "$container_name" pg_isready -U aloca -d aloca_benchmark >/dev/null 2>&1; then break; fi
  sleep 1
done

ALOCA_BENCHMARK_POSTGRES_CONNECTION="$connection" \
  dotnet test tests/Aloca.Api.Tests/Aloca.Api.Tests.csproj --no-restore \
  --filter 'FullyQualifiedName~PostgresPerformanceBenchmarkTests' \
  --logger 'console;verbosity=detailed'
