#!/usr/bin/env python3
"""Patient Reveal — Azure migration operator tool (Gate G1 evidence).

Compares the LIVE catalogue against a candidate database that has had the
rendered Azure baseline replayed into it, and fails loudly on any drift that
would change behaviour: missing tables, missing/renamed policies, missing
routines or triggers, RLS left disabled, or a policy predicate that differs.

Read-only against both databases. Compares structure only, never rows.

Usage:
  reconcile_replay.py <LIVE_PSQL_CMD> <CANDIDATE_PSQL_CMD> <REPORT_JSON>
Each PSQL_CMD is a shell command that accepts -tAc "<sql>".
"""

from __future__ import annotations

import json
import shlex
import subprocess
import sys

QUERIES = {
    "tables": "select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace "
    "where n.nspname='public' and c.relkind='r' order by 1",
    "views": "select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace "
    "where n.nspname='public' and c.relkind in ('v','m') order by 1",
    "columns": "select c.relname||'.'||a.attname||':'||format_type(a.atttypid,a.atttypmod)||"
    "':'||a.attnotnull from pg_attribute a join pg_class c on c.oid=a.attrelid "
    "join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' "
    "and c.relkind='r' and a.attnum>0 and not a.attisdropped order by 1",
    "enums": "select t.typname||'='||string_agg(e.enumlabel,',' order by e.enumsortorder) "
    "from pg_type t join pg_enum e on e.enumtypid=t.oid join pg_namespace n "
    "on n.oid=t.typnamespace where n.nspname='public' group by t.typname order by 1",
    "routines": "select p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' "
    "from pg_proc p join pg_namespace n on n.oid=p.pronamespace "
    "where n.nspname='public' and p.prokind in ('f','p') order by 1",
    "triggers": "select c.relname||'.'||t.tgname from pg_trigger t "
    "join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace "
    "where n.nspname='public' and not t.tgisinternal order by 1",
    "rls_disabled": "select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace "
    "where n.nspname='public' and c.relkind='r' and c.relrowsecurity=false order by 1",
    "policies": "select tablename||'::'||policyname||'::'||cmd||'::'||coalesce(qual,'-')"
    "||'::'||coalesce(with_check,'-') from pg_policies where schemaname='public' order by 1",
    "policy_names": "select tablename||'::'||policyname from pg_policies "
    "where schemaname='public' order by 1",
    "fks": "select conname from pg_constraint where contype='f' "
    "and connamespace='public'::regnamespace order by 1",
    # relacl, not information_schema: the latter hides grants the connecting
    # role cannot see, which would silently produce empty T3 evidence.
    "anon_grants": "select c.relname from pg_class c join pg_namespace n "
    "on n.oid=c.relnamespace, aclexplode(c.relacl) acl "
    "where n.nspname='public' and c.relkind in ('r','v') "
    "and acl.grantee = 'anon'::regrole group by c.relname order by 1",
}


def run(cmd: str, sql: str) -> list[str]:
    proc = subprocess.run(
        shlex.split(cmd) + ["-tAc", sql], capture_output=True, text=True, check=True
    )
    return [l.strip() for l in proc.stdout.split("\n") if l.strip()]


def main() -> int:
    if len(sys.argv) < 4:
        print(__doc__)
        return 2
    live_cmd, cand_cmd, report_path = sys.argv[1], sys.argv[2], sys.argv[3]

    report: dict = {"sections": {}, "blocking": [], "expected_differences": {}}

    for name, sql in QUERIES.items():
        live = set(run(live_cmd, sql))
        cand = set(run(cand_cmd, sql))
        missing = sorted(live - cand)
        extra = sorted(cand - live)
        report["sections"][name] = {
            "live_count": len(live),
            "candidate_count": len(cand),
            "missing_in_candidate": missing,
            "extra_in_candidate": extra,
        }

    # Expected, deliberate differences (transformations T3/T4 and Azure identity).
    anon = report["sections"]["anon_grants"]
    report["expected_differences"]["T3_anon_grants_intentionally_dropped"] = anon[
        "missing_in_candidate"
    ]
    anon["missing_in_candidate"] = []

    # Blocking rules: anything that changes enforcement or shape.
    for name in (
        "tables",
        "columns",
        "enums",
        "routines",
        "triggers",
        "policy_names",
        "policies",
        "fks",
    ):
        sec = report["sections"][name]
        if sec["missing_in_candidate"]:
            report["blocking"].append(
                {"section": name, "missing": sec["missing_in_candidate"][:50]}
            )

    cand_rls_off = report["sections"]["rls_disabled"]["extra_in_candidate"]
    if cand_rls_off:
        report["blocking"].append(
            {"section": "rls_disabled", "tables_without_rls": cand_rls_off}
        )

    report["verdict"] = "PASS" if not report["blocking"] else "BLOCKED"

    with open(report_path, "w") as fh:
        json.dump(report, fh, indent=2)
        fh.write("\n")

    for name, sec in report["sections"].items():
        print(
            f'{name:<16} live={sec["live_count"]:<5} candidate={sec["candidate_count"]:<5} '
            f'missing={len(sec["missing_in_candidate"]):<4} extra={len(sec["extra_in_candidate"])}'
        )
    print()
    print("verdict:", report["verdict"])
    for b in report["blocking"]:
        print("  BLOCKING", b["section"], list(b.values())[1][:8])
    return 0 if report["verdict"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
