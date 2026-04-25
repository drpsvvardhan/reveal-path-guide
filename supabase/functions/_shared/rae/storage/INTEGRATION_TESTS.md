# RAE SQL-layer integration test harness

This harness is a contract test between the TypeScript caller and Postgres.
It catches the bug class mock-based tests cannot: enum cast failures, FK
integrity violations, transaction boundary errors, idempotency drift at
the SQL layer, and migration-from-zero failures. The mock-based suite
(`admit.test.ts`) stays as-is and continues to cover orchestration logic.

It does **not** test edge function HTTP, RLS policies, or frontend
behavior. Those belong in their own harnesses.

## Run locally

Requires Docker and Deno on PATH. From the repo root:

```bash
bash scripts/test-integration.sh
```

The script starts a hermetic `postgres:15-alpine` container on port
`$RAE_TEST_PG_PORT` (default `54329`), bootstraps minimal `auth`/`storage`
stubs, applies every migration in `supabase/migrations/` in timestamp
order, runs the `--filter integration` Deno tests in this directory, and
tears the container down on exit.

## When it fails

1. Read the migration log first. The harness aborts on the first
   migration error and prints the offending file plus stderr — fix
   schema/SQL issues before debugging tests.
2. Then read the test failure. Test 1 (production auto-admit + depth-0
   witness) is load-bearing; if it fails with an "invalid input value
   for enum" error, a witness ontology field has drifted from the P1A
   registry — the D-9 bug shape.
