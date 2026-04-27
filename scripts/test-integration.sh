#!/usr/bin/env bash
# ============================================================================
# scripts/test-integration.sh
# ----------------------------------------------------------------------------
# RAE SQL-layer integration test harness.
#
# Spins up a hermetic Postgres 15 container, applies every migration in
# supabase/migrations/ in timestamp order against a from-scratch database,
# then runs the deno integration tests under
# supabase/functions/_shared/rae/storage/ filtered by name "integration".
#
# Catches the bug class mock tests cannot: enum cast failures, FK
# violations, transaction boundary errors, idempotency drift at the SQL
# layer, fresh-migration failures.
#
# Out of scope: edge function HTTP, RLS policy behavior, frontend.
#
# Requirements: docker + deno on PATH. No other prerequisites.
# ============================================================================

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS_DIR="$REPO_ROOT/supabase/migrations"
TESTS_DIR="$REPO_ROOT/supabase/functions/_shared/rae/storage"

PG_PORT="${RAE_TEST_PG_PORT:-54329}"
PG_PASSWORD="rae_test_password"
PG_USER="postgres"
PG_DB="postgres"
CONTAINER_NAME="rae-integration-pg-${PG_PORT}"
PG_IMAGE="postgres:15-alpine"

log() { printf "\033[1;34m[harness]\033[0m %s\n" "$*" >&2; }
err() { printf "\033[1;31m[harness:error]\033[0m %s\n" "$*" >&2; }

command -v docker >/dev/null 2>&1 || { err "docker not on PATH"; exit 2; }
command -v deno   >/dev/null 2>&1 || { err "deno not on PATH"; exit 2; }

cleanup() {
  log "tearing down container ${CONTAINER_NAME}"
  docker rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

# Pre-cleanup in case a previous run left a stale container.
docker rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true

log "starting ${PG_IMAGE} on port ${PG_PORT}"
docker rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true
docker run -d \
  --name "${CONTAINER_NAME}" \
  -e POSTGRES_PASSWORD="${PG_PASSWORD}" \
  -e POSTGRES_USER="${PG_USER}" \
  -e POSTGRES_DB="${PG_DB}" \
  -p "${PG_PORT}:5432" \
  "${PG_IMAGE}" >/dev/null

sleep 3
log "container status after start:"
docker ps -a --filter "name=${CONTAINER_NAME}" --format \
  'table {{.Names}}\t{{.Status}}\t{{.State}}' || true

# Wait for readiness.
log "waiting for postgres to accept connections"
for i in $(seq 1 120); do
  if docker exec "${CONTAINER_NAME}" pg_isready -U "${PG_USER}" -d "${PG_DB}" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
if ! docker exec "${CONTAINER_NAME}" pg_isready -U "${PG_USER}" -d "${PG_DB}" >/dev/null 2>&1; then
  err "postgres did not become ready in 120s"
  err "----- container status -----"
  docker ps -a --filter "name=${CONTAINER_NAME}" >&2 || true
  err "----- container logs (last 100 lines) -----"
  docker logs --tail 100 "${CONTAINER_NAME}" >&2 || true
  err "----- docker info -----"
  docker info 2>&1 | head -30 >&2 || true
  exit 3
fi

# ----------------------------------------------------------------------------
# Bootstrap: minimal stubs for Supabase-managed schemas the migrations
# reference. The harness does NOT test RLS or auth behavior, so these
# stubs are intentionally inert.
# ----------------------------------------------------------------------------
log "bootstrapping minimal supabase auth/storage stubs"
docker exec -i "${CONTAINER_NAME}" psql -v ON_ERROR_STOP=1 -U "${PG_USER}" -d "${PG_DB}" <<'SQL'
-- Required extension for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- auth schema stubs
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
  LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;
CREATE OR REPLACE FUNCTION auth.role() RETURNS text
  LANGUAGE sql STABLE AS $$ SELECT NULL::text $$;
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb
  LANGUAGE sql STABLE AS $$ SELECT NULL::jsonb $$;

-- storage schema stubs (some migrations reference storage.buckets/objects)
CREATE SCHEMA IF NOT EXISTS storage;
CREATE TABLE IF NOT EXISTS storage.buckets (
  id text PRIMARY KEY,
  name text NOT NULL,
  public boolean DEFAULT false,
  file_size_limit bigint,
  allowed_mime_types text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS storage.objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id text REFERENCES storage.buckets(id),
  name text,
  owner uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb
);
CREATE OR REPLACE FUNCTION storage.foldername(name text) RETURNS text[]
  LANGUAGE sql IMMUTABLE AS $$
    SELECT string_to_array(name, '/')
  $$;

-- service_role + authenticated/anon roles (no-op, just exist for GRANTs)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
END $$;
SQL

# ----------------------------------------------------------------------------
# Apply every migration in timestamp order. Fail loudly on the first
# migration error: a partial schema is worse than none.
# ----------------------------------------------------------------------------
log "applying migrations from ${MIGRATIONS_DIR}"
migration_count=0
for f in $(ls "${MIGRATIONS_DIR}" | sort); do
  case "$f" in
    *.sql) ;;
    *) continue ;;
  esac
  migration_count=$((migration_count + 1))
  if ! docker exec -i "${CONTAINER_NAME}" psql -v ON_ERROR_STOP=1 -U "${PG_USER}" -d "${PG_DB}" \
        < "${MIGRATIONS_DIR}/${f}" >/dev/null 2>/tmp/rae_migration_err.log; then
    err "migration failed: ${f}"
    err "----- stderr -----"
    cat /tmp/rae_migration_err.log >&2 || true
    exit 4
  fi
done
log "applied ${migration_count} migrations cleanly"

# ----------------------------------------------------------------------------
# Run integration tests. The tests connect via deno-postgres directly to
# the container; no Supabase client involvement.
# ----------------------------------------------------------------------------
export RAE_TEST_PG_HOST="127.0.0.1"
export RAE_TEST_PG_PORT="${PG_PORT}"
export RAE_TEST_PG_USER="${PG_USER}"
export RAE_TEST_PG_PASSWORD="${PG_PASSWORD}"
export RAE_TEST_PG_DB="${PG_DB}"

log "running deno integration tests"
cd "${REPO_ROOT}"
if ! deno test --allow-net --allow-env --no-check \
      --filter integration \
      "supabase/functions/_shared/rae/storage/"; then
  err "deno integration tests failed"
  exit 5
fi

log "all integration tests passed"
exit 0