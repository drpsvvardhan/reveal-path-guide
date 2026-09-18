// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  applyCommand,
  startIntake,
} from "../../supabase/functions/_shared/cie33/engine";
import type { IntakeState } from "../../supabase/functions/_shared/cie33/engine";
import { contentHash } from "../../supabase/functions/_shared/cie33/reference/canonical";

const owner = "11111111-1111-4111-8111-111111111111";
const stranger = "22222222-2222-4222-8222-222222222222";
const legacyId = "33333333-3333-4333-8333-333333333333";
const now = "2026-09-18T10:00:00.000Z";
let db: PGlite;
async function role(name: string, uid = owner) {
  await db.exec(`reset role; set role ${name}`);
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [
    uid,
  ]);
}
async function commit(
  state: IntakeState,
  previous?: IntakeState,
  requestId = crypto.randomUUID(),
  requestHash = contentHash({ requestId }),
  action = previous ? "answer" : "start",
) {
  const result = await db.query<{ state: IntakeState }>(
    "select public.cie33_commit($1, $2, $3, $4, $5, $6::jsonb, $7) as state",
    [
      owner,
      requestId,
      requestHash,
      previous?.revision ?? -1,
      previous?.stateHash ?? null,
      JSON.stringify(state),
      action,
    ],
  );
  return result.rows[0].state;
}
function respond(state: IntakeState, requestId = crypto.randomUUID()) {
  const q = state.current!.instance;
  return applyCommand(
    state,
    {
      action: "answer",
      answer: {
        questionInstanceId: q.id,
        questionInstanceHash: q.instanceContentHash,
        semanticResponse:
          q.response.kind === "boolean"
            ? { kind: "boolean", value: false }
            : q.response.kind === "single_select"
              ? { kind: "single_select", optionId: q.response.options![0].id }
              : { kind: "short_text", text: "Synthetic patient account" },
        negativeCapabilityConfirmed: true,
      },
    },
    requestId,
    now,
  );
}
beforeAll(async () => {
  db = new PGlite();
  // The pre-existing assessment contract and Supabase roles; the migration under
  // test is loaded verbatim below. No live patient records or remote database.
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth, public to authenticated, anon, service_role;
    grant execute on function auth.uid() to authenticated, anon, service_role;
    insert into auth.users values ('${owner}'), ('${stranger}');
    create table public.cie_assessments (
      id uuid primary key default gen_random_uuid(), user_id uuid not null,
      version integer not null default 1, status text not null default 'in_progress',
      total_questions_answered integer not null default 0, full_completed_at timestamptz,
      created_at timestamptz not null default now(), updated_at timestamptz not null default now()
    );
    alter table public.cie_assessments enable row level security;
    create policy legacy_owner on public.cie_assessments for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
    grant select, insert, update, delete on public.cie_assessments to authenticated, service_role;
    insert into public.cie_assessments(id, user_id, status, total_questions_answered) values ('${legacyId}', '${owner}', 'complete', 75);
  `);
  await db.exec(
    readFileSync(
      "supabase/migrations/20260918031800_cie_v33_patient_intake.sql",
      "utf8",
    ),
  );
}, 30000);
beforeEach(async () => {
  await role("postgres");
  await db.exec(
    "delete from public.cie_assessments where instrument_version = '3.3.0'",
  );
  await role("service_role");
});
afterAll(async () => {
  await db?.close();
});

describe("CIE 3.3 PostgreSQL persistence and access", () => {
  it("preserves legacy data and binds the new metadata to the durable session", async () => {
    const state = await commit(startIntake(owner, false, now));
    const rows = (
      await db.query<{
        id: string;
        instrument_version: string;
        total_questions_answered: number;
      }>("select * from public.cie_assessments order by version")
    ).rows;
    expect(rows.find((r) => r.id === legacyId)).toMatchObject({
      instrument_version: "2.2.0",
      total_questions_answered: 75,
    });
    expect(rows.find((r) => r.id === state.id)?.instrument_version).toBe(
      "3.3.0",
    );
  });
  it("makes starts and answer retries durable and rejects idempotency-key reuse", async () => {
    const startId = crypto.randomUUID();
    const state = await commit(
      startIntake(owner, false, now),
      undefined,
      startId,
    );
    const replay = await commit(
      startIntake(owner, false, now),
      undefined,
      startId,
    );
    expect(replay.id).toBe(state.id);
    const anotherStart = await commit(startIntake(owner, false, now));
    expect(anotherStart.id).toBe(state.id);
    const key = crypto.randomUUID();
    const next = respond(state, key);
    await commit(next, state, key);
    const duplicate = await commit(next, state, key);
    expect(duplicate.entries).toHaveLength(1);
    expect(
      (
        await db.query(
          "select * from public.cie33_events where event->>'action' = 'answer'",
        )
      ).rows,
    ).toHaveLength(1);
    await expect(
      commit(next, state, key, contentHash({ changed: true })),
    ).rejects.toThrow("IDEMPOTENCY_CONFLICT");
  });
  it("rejects stale competing updates without duplicating evidence", async () => {
    const state = await commit(startIntake(owner, false, now));
    await commit(respond(state), state);
    await expect(commit(respond(state), state)).rejects.toThrow("STALE_STATE");
    expect(
      (
        await db.query(
          "select * from public.cie33_events where event->>'action' = 'answer'",
        )
      ).rows,
    ).toHaveLength(1);
  });
  it("rejects rewriting historical evidence even by the application RPC", async () => {
    const initial = await commit(startIntake(owner, false, now));
    const state = await commit(respond(initial), initial);
    const changed = respond(state);
    changed.entries[0].answer.exactSourceText = "forged";
    await expect(commit(changed, state)).rejects.toThrow(
      "APPEND_ONLY_VIOLATION",
    );
  });
  it("allows owner reads, denies another patient and anonymous access", async () => {
    await commit(startIntake(owner, false, now));
    await role("authenticated", owner);
    expect(
      (await db.query("select * from public.cie33_sessions")).rows,
    ).toHaveLength(1);
    await role("authenticated", stranger);
    expect(
      (await db.query("select * from public.cie33_sessions")).rows,
    ).toHaveLength(0);
    expect(
      (await db.query("select * from public.cie33_events")).rows,
    ).toHaveLength(0);
    await role("anon");
    await expect(
      db.query("select * from public.cie33_sessions"),
    ).rejects.toThrow("permission denied");
  });
  it("denies patient canonical writes, service RPC execution and forged metadata completion", async () => {
    const state = await commit(startIntake(owner, false, now));
    await role("authenticated", owner);
    await expect(
      db.query("update public.cie33_sessions set revision=999 where id=$1", [
        state.id,
      ]),
    ).rejects.toThrow("permission denied");
    await expect(db.query("delete from public.cie33_events")).rejects.toThrow(
      "permission denied",
    );
    await expect(commit(respond(state), state)).rejects.toThrow(
      "permission denied",
    );
    await expect(
      db.query(
        "update public.cie_assessments set status='complete' where id=$1",
        [state.id],
      ),
    ).rejects.toThrow("authenticated intake service");
    await expect(
      db.query("delete from public.cie_assessments where id=$1", [state.id]),
    ).rejects.toThrow("authenticated intake service");
  });
  it("rejects cross-owner state commits", async () => {
    await expect(commit(startIntake(stranger, false, now))).rejects.toThrow(
      "INVALID_STATE",
    );
  });
  it("publishes only confirmed evidence and preserves it while a correction is in progress", async () => {
    let state = await commit(startIntake(owner, false, now));
    while (state.phase === "active")
      state = await commit(respond(state), state);
    const review = state;
    state = await commit(
      applyCommand(state, { action: "finish" }, crypto.randomUUID(), now),
      state,
      crypto.randomUUID(),
      undefined,
      "finish",
    );
    const published = state;
    expect(
      (
        await db.query<{ published_state: IntakeState }>(
          "select published_state from public.cie33_sessions where id=$1",
          [state.id],
        )
      ).rows[0].published_state.phase,
    ).toBe("complete");
    state = await commit(
      applyCommand(
        state,
        { action: "revise", witnessId: review.entries[4].witness.id },
        crypto.randomUUID(),
        now,
      ),
      state,
      crypto.randomUUID(),
      undefined,
      "revise",
    );
    const row = (
      await db.query<{ published_state: IntakeState; state: IntakeState }>(
        "select * from public.cie33_sessions where id=$1",
        [state.id],
      )
    ).rows[0];
    expect(row.published_state).toEqual(published);
    expect(row.state.phase).toBe("active");
    expect(
      (
        await db.query<{ status: string }>(
          "select status from public.cie_assessments where id=$1",
          [state.id],
        )
      ).rows[0].status,
    ).toBe("complete");
  });
});
