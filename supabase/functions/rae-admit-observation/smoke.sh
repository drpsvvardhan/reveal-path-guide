#!/usr/bin/env bash
# ============================================================================
# rae-admit-observation smoke-test harness (hardened)
# ----------------------------------------------------------------------------
# Usage:
#   SUPABASE_URL=https://<ref>.supabase.co \
#   SUPABASE_ANON_KEY=<anon> \
#   [ADMIN_JWT=<jwt>] \
#   bash supabase/functions/rae-admit-observation/smoke.sh
#
# Hardening:
#   - curl --connect-timeout 10 --max-time 30
#   - one retry on transient 5xx / network failure
#   - body-code assertions on every test
#   - endpoint echoed; no secrets ever printed
# ============================================================================
set -u

: "${SUPABASE_URL:?SUPABASE_URL is required}"
: "${SUPABASE_ANON_KEY:?SUPABASE_ANON_KEY is required}"

URL="${SUPABASE_URL%/}/functions/v1/rae-admit-observation"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

PASS=0
FAIL=0
SKIP=0

pass() { echo "PASS  $1"; PASS=$((PASS+1)); }
fail() { echo "FAIL  $1 -- $2"; FAIL=$((FAIL+1)); }
skip() { echo "SKIP  $1 -- $2"; SKIP=$((SKIP+1)); }

echo "Endpoint: $URL"
echo "Admin test: $([ -n "${ADMIN_JWT:-}" ] && echo enabled || echo disabled)"
echo

# ---------------------------------------------------------------------------
# req <out_file> <method> <extra-curl-args...>
# Performs request with timeouts; one retry on curl failure or HTTP 5xx.
# Prints the HTTP code on stdout.
# ---------------------------------------------------------------------------
req() {
  local out="$1"; shift
  local method="$1"; shift
  local code rc
  for attempt in 1 2; do
    code=$(curl -s -o "$out" -w "%{http_code}" \
      --connect-timeout 10 --max-time 30 \
      -X "$method" "$URL" "$@" 2>/dev/null)
    rc=$?
    if [ "$rc" -eq 0 ] && [ -n "$code" ] && [ "${code:0:1}" != "5" ]; then
      echo "$code"; return 0
    fi
    [ "$attempt" -eq 1 ] && sleep 1
  done
  echo "${code:-000}"
  return 0
}

# Schema-valid body (mirrors request_schema.ts).
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
# 1. OPTIONS -> 204 (no body)
# ---------------------------------------------------------------------------
NAME="1. OPTIONS -> 204"
CODE=$(req "$TMP/b1" OPTIONS \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Access-Control-Request-Method: POST" \
  -H "Origin: https://example.com")
BYTES=$(wc -c < "$TMP/b1" | tr -d ' ')
if [ "$CODE" = "204" ] && [ "$BYTES" = "0" ]; then
  pass "$NAME"
else
  fail "$NAME" "code=$CODE body_bytes=$BYTES"
fi

# ---------------------------------------------------------------------------
# 2. malformed JSON -> 400 invalid_request
# ---------------------------------------------------------------------------
NAME="2. malformed JSON -> 400 invalid_request"
CODE=$(req "$TMP/b2" POST \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer not-a-real-jwt" \
  -H "Content-Type: application/json" \
  -d '{not json')
if [ "$CODE" = "400" ] && grep -q '"code":"invalid_request"' "$TMP/b2"; then
  pass "$NAME"
else
  fail "$NAME" "code=$CODE body=$(head -c 200 "$TMP/b2")"
fi

# ---------------------------------------------------------------------------
# 3. valid schema + missing Authorization -> 401 unauthenticated
# ---------------------------------------------------------------------------
NAME="3. valid + missing Authorization -> 401 unauthenticated"
CODE=$(req "$TMP/b3" POST \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d "$VALID_BODY")
if [ "$CODE" = "401" ] && grep -q '"code":"unauthenticated"' "$TMP/b3"; then
  pass "$NAME"
else
  fail "$NAME" "code=$CODE body=$(head -c 200 "$TMP/b3")"
fi

# ---------------------------------------------------------------------------
# 4. valid schema + invalid bearer -> 401 unauthenticated
# ---------------------------------------------------------------------------
NAME="4. valid + invalid bearer -> 401 unauthenticated"
CODE=$(req "$TMP/b4" POST \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer not-a-real-jwt" \
  -H "Content-Type: application/json" \
  -d "$VALID_BODY")
if [ "$CODE" = "401" ] && grep -q '"code":"unauthenticated"' "$TMP/b4"; then
  pass "$NAME"
else
  fail "$NAME" "code=$CODE body=$(head -c 200 "$TMP/b4")"
fi

# ---------------------------------------------------------------------------
# 5. optional admin: fake engine_version_id -> 422 registry_gap | 403 forbidden
# ---------------------------------------------------------------------------
NAME="5. admin + fake engine_version_id -> 422 registry_gap | 403 forbidden"
if [ -n "${ADMIN_JWT:-}" ]; then
  CODE=$(req "$TMP/b5" POST \
    -H "apikey: $SUPABASE_ANON_KEY" \
    -H "Authorization: Bearer $ADMIN_JWT" \
    -H "Content-Type: application/json" \
    -d "$VALID_BODY")
  if [ "$CODE" = "422" ] && grep -q '"code":"registry_gap"' "$TMP/b5"; then
    pass "$NAME (422 registry_gap)"
  elif [ "$CODE" = "403" ] && grep -q '"code":"forbidden"' "$TMP/b5"; then
    pass "$NAME (403 forbidden -- ADMIN_JWT lacks admin role)"
  else
    fail "$NAME" "code=$CODE body=$(head -c 200 "$TMP/b5")"
  fi
else
  skip "$NAME" "ADMIN_JWT not set"
fi

echo
echo "Summary: $PASS passed, $FAIL failed, $SKIP skipped"
[ "$FAIL" -eq 0 ]
