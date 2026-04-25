#!/usr/bin/env bash
# ============================================================================
# rae-admit-observation smoke-test harness
# ----------------------------------------------------------------------------
# Usage:
#   SUPABASE_URL=https://<ref>.supabase.co \
#   SUPABASE_ANON_KEY=<anon> \
#   [ADMIN_JWT=<jwt>] \
#   bash supabase/functions/rae-admit-observation/smoke.sh
#
# Exits non-zero if any required test fails. Optional admin test only runs
# when ADMIN_JWT is set. Secrets are never printed.
# ============================================================================
set -u

: "${SUPABASE_URL:?SUPABASE_URL is required}"
: "${SUPABASE_ANON_KEY:?SUPABASE_ANON_KEY is required}"

URL="${SUPABASE_URL%/}/functions/v1/rae-admit-observation"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

PASS=0
FAIL=0

pass() { echo "PASS  $1"; PASS=$((PASS+1)); }
fail() { echo "FAIL  $1 -- $2"; FAIL=$((FAIL+1)); }

# Schema-valid request body (mirrors request_schema.ts).
VALID_BODY=$(cat <<'JSON'
{
  "engine_version_id": "00000000-0000-0000-0000-000000000099",
  "claim": {
    "source_table": "patient_lab_observations",
    "source_row_id": "00000000-0000-0000-0000-000000000002",
    "user_id": "00000000-0000-0000-0000-000000000001",
    "raw_name": "glucose",
    "raw_unit": "mg/dL",
    "raw_value": 95,
    "raw_method": null,
    "raw_reference_low": 70,
    "raw_reference_high": 99,
    "observed_at": "2025-01-01T00:00:00+00:00",
    "panel_grouping_key": null
  },
  "candidate_concept": {
    "concept_id": "00000000-0000-0000-0000-0000000000aa",
    "canonical_name": "Glucose, Serum",
    "canonical_unit": "mg/dL",
    "plausibility_band": {"low": 20, "high": 800},
    "canonical_reference_range": {"low": 70, "high": 99},
    "dynamics_rule_id": null,
    "delta_ceiling": null
  }
}
JSON
)

# ---------------------------------------------------------------------------
# 1. OPTIONS -> 204
# ---------------------------------------------------------------------------
NAME="1. OPTIONS -> 204"
CODE=$(curl -s -o "$TMP/b1" -w "%{http_code}" -X OPTIONS "$URL" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Access-Control-Request-Method: POST" \
  -H "Origin: https://example.com")
if [ "$CODE" = "204" ]; then pass "$NAME"; else fail "$NAME" "got $CODE"; fi

# ---------------------------------------------------------------------------
# 2. malformed JSON -> 400 invalid_request
# ---------------------------------------------------------------------------
NAME="2. malformed JSON -> 400 invalid_request"
CODE=$(curl -s -o "$TMP/b2" -w "%{http_code}" -X POST "$URL" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer not-a-real-jwt" \
  -H "Content-Type: application/json" \
  -d '{not json')
if [ "$CODE" = "400" ] && grep -q '"invalid_request"' "$TMP/b2"; then
  pass "$NAME"
else
  fail "$NAME" "got $CODE / $(head -c 200 "$TMP/b2")"
fi

# ---------------------------------------------------------------------------
# 3. valid schema + missing Authorization -> 401 unauthenticated
# ---------------------------------------------------------------------------
NAME="3. valid + missing Authorization -> 401 unauthenticated"
CODE=$(curl -s -o "$TMP/b3" -w "%{http_code}" -X POST "$URL" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d "$VALID_BODY")
if [ "$CODE" = "401" ] && grep -q '"unauthenticated"' "$TMP/b3"; then
  pass "$NAME"
else
  fail "$NAME" "got $CODE / $(head -c 200 "$TMP/b3")"
fi

# ---------------------------------------------------------------------------
# 4. valid schema + invalid bearer -> 401 unauthenticated
# ---------------------------------------------------------------------------
NAME="4. valid + invalid bearer -> 401 unauthenticated"
CODE=$(curl -s -o "$TMP/b4" -w "%{http_code}" -X POST "$URL" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer not-a-real-jwt" \
  -H "Content-Type: application/json" \
  -d "$VALID_BODY")
if [ "$CODE" = "401" ] && grep -q '"unauthenticated"' "$TMP/b4"; then
  pass "$NAME"
else
  fail "$NAME" "got $CODE / $(head -c 200 "$TMP/b4")"
fi

# ---------------------------------------------------------------------------
# 5. optional admin mode: fake engine_version_id -> 422 registry_gap (or 403)
# ---------------------------------------------------------------------------
NAME="5. admin + fake engine_version_id -> 422 registry_gap | 403 forbidden"
if [ -n "${ADMIN_JWT:-}" ]; then
  CODE=$(curl -s -o "$TMP/b5" -w "%{http_code}" -X POST "$URL" \
    -H "apikey: $SUPABASE_ANON_KEY" \
    -H "Authorization: Bearer $ADMIN_JWT" \
    -H "Content-Type: application/json" \
    -d "$VALID_BODY")
  if [ "$CODE" = "422" ] && grep -q '"registry_gap"' "$TMP/b5"; then
    pass "$NAME (422 registry_gap)"
  elif [ "$CODE" = "403" ] && grep -q '"forbidden"' "$TMP/b5"; then
    pass "$NAME (403 forbidden -- ADMIN_JWT lacks admin role)"
  else
    fail "$NAME" "got $CODE / $(head -c 200 "$TMP/b5")"
  fi
else
  echo "SKIP  $NAME (ADMIN_JWT not set)"
fi

echo
echo "Summary: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
