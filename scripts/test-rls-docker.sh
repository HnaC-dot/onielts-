#!/usr/bin/env bash
set -euo pipefail

CONTAINER_NAME="onielts-rls-test-pg"
PG_PORT="${RLS_TEST_PG_PORT:-55432}"

cleanup() {
  docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

cleanup

echo "[test:rls:docker] Starting ephemeral postgres:16-alpine on 127.0.0.1:${PG_PORT}..."
docker run -d \
  --name "$CONTAINER_NAME" \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=postgres \
  -p "127.0.0.1:${PG_PORT}:5432" \
  postgres:16-alpine >/dev/null

for i in $(seq 1 30); do
  if docker exec "$CONTAINER_NAME" pg_isready -U postgres >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

SUPABASE_DB_URL="postgresql://postgres:postgres@127.0.0.1:${PG_PORT}/postgres" \
  npx vitest run tests/rls.test.ts tests/rls.integration.test.ts
