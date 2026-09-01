#!/usr/bin/env bash
# Patient Reveal — Azure migration operator tool
# Gate G0 / PR-00: capture the live PostgreSQL catalogue as machine-readable evidence.
#
# The live database — not the checked-in migrations — is authoritative for schema,
# policies, grants, routines, triggers, extensions and sequences (handover §10.1).
#
# Usage:
#   ops/migrate/capture-catalogue.sh [OUTPUT_DIR]
#
# Connection comes from the standard PG* environment (PGHOST/PGPORT/PGUSER/
# PGPASSWORD/PGDATABASE). No connection string is embedded and no credential is
# written to the output.
#
# Output (default /tmp/azure-migration/catalogue-<UTC timestamp>):
#   <section>.json        one file per catalogue section, deterministic ordering
#   manifest.json         section -> row count + sha256
#   catalogue-hash.txt    single hash over the ordered section hashes
#
# Known limitation (recorded, per handover §10.1): information_schema.*_grants is
# filtered to roles the capturing user belongs to, so the authoritative privilege
# evidence is table_acls/routine_acls (pg_class.relacl / pg_proc.proacl), which are
# visible regardless of role membership.
#
# Raw output is evidence for the restricted store. Only counts and hashes may be
# published in docs/azure-migration/evidence-index/.

set -euo pipefail

OUT_DIR="${1:-/tmp/azure-migration/catalogue-$(date -u +%Y%m%dT%H%M%SZ)}"
MIN_SERVER_VERSION_NUM=150000

command -v psql >/dev/null || { echo "capture-catalogue: psql not found" >&2; exit 127; }
: "${PGHOST:?capture-catalogue: PGHOST is not set — refusing to guess a target}"

q() { psql -X -q -v ON_ERROR_STOP=1 -tAc "$1"; }

SERVER_VERSION_NUM="$(q "show server_version_num" | tr -d '[:space:]')"
if [ "$SERVER_VERSION_NUM" -lt "$MIN_SERVER_VERSION_NUM" ]; then
  echo "capture-catalogue: server_version_num $SERVER_VERSION_NUM below supported $MIN_SERVER_VERSION_NUM" >&2
  exit 2
fi

mkdir -p "$OUT_DIR"

# section name -> SQL returning one JSON object per row, deterministically ordered.
sections=(
"server_version|select json_build_object('server_version', version(), 'server_version_num', current_setting('server_version_num'), 'captured_at_utc', to_char(now() at time zone 'utc','YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"'))"
"extensions|select json_build_object('name', e.extname, 'version', e.extversion, 'schema', n.nspname) from pg_extension e join pg_namespace n on n.oid = e.extnamespace order by e.extname"
"schemas|select json_build_object('schema', nspname) from pg_namespace where nspname not like 'pg\\_%' and nspname <> 'information_schema' order by nspname"
"tables|select json_build_object('schema', table_schema, 'table', table_name, 'type', table_type) from information_schema.tables where table_schema in ('public','storage') order by table_schema, table_name"
"columns|select json_build_object('schema', table_schema, 'table', table_name, 'column', column_name, 'ordinal', ordinal_position, 'type', data_type, 'nullable', is_nullable, 'default', column_default) from information_schema.columns where table_schema in ('public','storage') order by table_schema, table_name, ordinal_position"
"constraints|select json_build_object('schema', c.connamespace::regnamespace::text, 'table', c.conrelid::regclass::text, 'name', c.conname, 'type', c.contype, 'definition', pg_get_constraintdef(c.oid)) from pg_constraint c where c.connamespace::regnamespace::text in ('public','storage') order by c.conrelid::regclass::text, c.conname"
"indexes|select json_build_object('schema', schemaname, 'table', tablename, 'name', indexname, 'definition', indexdef) from pg_indexes where schemaname in ('public','storage') order by schemaname, tablename, indexname"
"sequences|select json_build_object('schema', schemaname, 'sequence', sequencename, 'data_type', data_type, 'start_value', start_value, 'increment', increment_by, 'last_value', last_value) from pg_sequences where schemaname in ('public','storage') order by schemaname, sequencename"
"views|select json_build_object('schema', table_schema, 'view', table_name) from information_schema.views where table_schema in ('public','storage') order by table_schema, table_name"
"routines|select json_build_object('schema', n.nspname, 'name', p.proname, 'args', pg_get_function_identity_arguments(p.oid), 'kind', p.prokind, 'security_definer', p.prosecdef, 'volatility', p.provolatile, 'config', p.proconfig, 'body_sha256', encode(sha256(convert_to(pg_get_functiondef(p.oid),'utf8')),'hex')) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' order by p.proname, pg_get_function_identity_arguments(p.oid)"
"triggers|select json_build_object('schema', n.nspname, 'table', c.relname, 'name', t.tgname, 'definition', pg_get_triggerdef(t.oid)) from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace where not t.tgisinternal and n.nspname in ('public','storage') order by n.nspname, c.relname, t.tgname"
"rls_enabled|select json_build_object('schema', n.nspname, 'table', c.relname, 'rls_enabled', c.relrowsecurity, 'rls_forced', c.relforcerowsecurity) from pg_class c join pg_namespace n on n.oid = c.relnamespace where c.relkind = 'r' and n.nspname in ('public','storage') order by n.nspname, c.relname"
"policies|select json_build_object('schema', schemaname, 'table', tablename, 'policy', policyname, 'permissive', permissive, 'roles', roles, 'command', cmd, 'using', qual, 'check', with_check) from pg_policies where schemaname in ('public','storage') order by schemaname, tablename, policyname"
"table_grants|select json_build_object('schema', table_schema, 'table', table_name, 'grantee', grantee, 'privilege', privilege_type) from information_schema.role_table_grants where table_schema in ('public','storage') order by table_schema, table_name, grantee, privilege_type"
"table_acls|select json_build_object('schema', n.nspname, 'table', c.relname, 'acl', coalesce(array_to_string(c.relacl::text[], ' '), '')) from pg_class c join pg_namespace n on n.oid = c.relnamespace where c.relkind in ('r','v','m') and n.nspname in ('public','storage') order by n.nspname, c.relname"
"routine_acls|select json_build_object('schema', n.nspname, 'routine', p.proname, 'args', pg_get_function_identity_arguments(p.oid), 'acl', coalesce(array_to_string(p.proacl::text[], ' '), '')) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' order by p.proname, pg_get_function_identity_arguments(p.oid)"
"rls_gaps|select json_build_object('schema', n.nspname, 'table', c.relname, 'rls_enabled', c.relrowsecurity, 'policy_count', (select count(*) from pg_policy pol where pol.polrelid = c.oid)) from pg_class c join pg_namespace n on n.oid = c.relnamespace where c.relkind='r' and n.nspname in ('public','storage') and (c.relrowsecurity = false or (select count(*) from pg_policy pol where pol.polrelid = c.oid) = 0) order by n.nspname, c.relname"
"routine_grants|select json_build_object('schema', routine_schema, 'routine', routine_name, 'grantee', grantee, 'privilege', privilege_type) from information_schema.role_routine_grants where routine_schema = 'public' order by routine_name, grantee, privilege_type"
"schema_grants|select json_build_object('schema', n.nspname, 'acl', coalesce(n.nspacl::text,'')) from pg_namespace n where n.nspname in ('public','storage') order by n.nspname"
"roles|select json_build_object('role', rolname, 'superuser', rolsuper, 'login', rolcanlogin, 'bypassrls', rolbypassrls, 'inherit', rolinherit) from pg_roles where rolname not like 'pg\\_%' order by rolname"
"role_memberships|select json_build_object('member', m.rolname, 'member_of', r.rolname, 'admin_option', a.admin_option) from pg_auth_members a join pg_roles m on m.oid = a.member join pg_roles r on r.oid = a.roleid where m.rolname not like 'pg\\_%' order by m.rolname, r.rolname"
"row_counts|select json_build_object('schema', 'public', 'table', c.relname, 'live_rows', (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from public.%I', c.relname), false, true, '')))[1]::text::bigint) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname='public' and c.relkind='r' order by c.relname"
"storage_buckets|select json_build_object('bucket', id, 'public', public, 'file_size_limit', file_size_limit, 'allowed_mime_types', allowed_mime_types, 'created_at', created_at) from storage.buckets order by id"
"storage_object_manifest|select json_build_object('bucket', bucket_id, 'object_key', name, 'size_bytes', (metadata->>'size')::bigint, 'content_type', metadata->>'mimetype', 'etag', metadata->>'eTag', 'owner', owner, 'created_at', created_at, 'updated_at', updated_at) from storage.objects order by bucket_id, name"
"storage_object_rollup|select json_build_object('bucket', bucket_id, 'objects', count(*), 'total_bytes', coalesce(sum((metadata->>'size')::bigint),0)) from storage.objects group by bucket_id order by bucket_id"
"file_row_linkage|select json_build_object('uploads_total', count(*), 'with_storage_path', count(storage_path), 'distinct_storage_paths', count(distinct storage_path), 'orphan_upload_rows', count(*) filter (where storage_path is null)) from public.patient_lab_uploads"
)

manifest_rows=()
hash_input=""

for entry in "${sections[@]}"; do
  name="${entry%%|*}"
  sql="${entry#*|}"
  file="$OUT_DIR/$name.json"
  # jsonl -> array, so the file is diffable and hashable without ordering surprises
  psql -X -q -v ON_ERROR_STOP=1 -tAc "$sql" > "$file.raw"
  python3 - "$file.raw" "$file" <<'PY'
import json, sys
src, dst = sys.argv[1], sys.argv[2]
rows = [json.loads(l) for l in open(src) if l.strip()]
with open(dst, "w") as fh:
    json.dump(rows, fh, indent=2, sort_keys=True)
    fh.write("\n")
PY
  rm -f "$file.raw"
  count="$(python3 -c "import json,sys;print(len(json.load(open(sys.argv[1]))))" "$file")"
  sha="$(sha256sum "$file" | cut -d' ' -f1)"
  manifest_rows+=("{\"section\":\"$name\",\"rows\":$count,\"sha256\":\"$sha\"}")
  hash_input="$hash_input$name:$sha\n"
  printf '%-24s %6s rows  %s\n' "$name" "$count" "${sha:0:16}"
done

printf '%s' "$(IFS=,; echo "[${manifest_rows[*]}]")" | python3 -c "import json,sys;json.dump(json.load(sys.stdin),open('$OUT_DIR/manifest.json','w'),indent=2);open('$OUT_DIR/manifest.json','a').write('\n')"

CATALOGUE_HASH="$(printf "$hash_input" | sha256sum | cut -d' ' -f1)"
echo "$CATALOGUE_HASH" > "$OUT_DIR/catalogue-hash.txt"

echo
echo "catalogue captured: $OUT_DIR"
echo "catalogue-hash:     $CATALOGUE_HASH"
