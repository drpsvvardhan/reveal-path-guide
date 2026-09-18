// @vitest-environment node
//
// PostgreSQL/RLS/transaction tests for clinician review authority.
// Runs the real migration verbatim in an in-process PostgreSQL (PGlite).
// No live patient records and no remote database.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  applyCommand,
  startIntake,
  permitResumption,
  latestEntries,
} from "../../supabase/functions/_shared/cie33/engine";
import type { IntakeState } from "../../supabase/functions/_shared/cie33/engine";
import { contentHash } from "../../supabase/functions/_shared/cie33/reference/canonical";

const patient = "11111111-1111-4111-8111-111111111111";
const clinician = "22222222-2222-4222-8222-222222222222";
const other = "33333333-3333-4333-8333-333333333333";
const admin = "44444444-4444-4444-8444-444444444444";
const now = "2026-09-18T10:00:00.000Z";
const later = "2026-09-18T12:00:00.000Z";

let db: PGlite;

async function role(name: string, uid = patient) {
  await db.exec(`reset role; set role ${name}`);
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [uid]);
}

async function grant(
  clinicianId = clinician,
  patientId = patient,
  days = 7,
  actor = admin,
) {
  const res = await db.query<{ id: string }>(
    `select (public.clinician_grant_authorization($1, $2, $3, $4, $5, $6)).id as id`,
    [
      actor,
      clinicianId,
      patientId,
      "LIC-2026-0001 verified by registry lookup",
      "Credential verified against the state register by the clinical operations lead.",
      new Date(Date.now() + days * 86400000).toISOString(),
    ],
  );
  return res.rows[0].id;
}

function heldState(): IntakeState {
  const start = startIntake(patient, false, now);
  const q = start.current!.instance;
  return applyCommand(
    start,
    {
      action: "answer",
      answer: {
        questionInstanceId: q.id,
        questionInstanceHash: q.instanceContentHash,
        semanticResponse: { kind: "boolean", value: true },
      },
    },
    crypto.randomUUID(),
    now,
  );
}

/** Persist a fresh held session and return its state. */
async function seedHeldSession(): Promise<IntakeState> {
  const start = startIntake(patient, false, now);
  const started = await db.query<{ state: IntakeState }>(
    "select public.cie33_commit($1, $2, $3, $4, $5, $6::jsonb, $7) as state",
    [
      patient,
      crypto.randomUUID(),
      contentHash({ k: crypto.randomUUID() }),
      -1,
      null,
      JSON.stringify(start),
      "start",
    ],
  );
  const persisted = started.rows[0].state;
  const q = persisted.current!.instance;
  const held = applyCommand(
    persisted,
    {
      action: "answer",
      answer: {
        questionInstanceId: q.id,
        questionInstanceHash: q.instanceContentHash,
        semanticResponse: { kind: "boolean", value: true },
      },
    },
    crypto.randomUUID(),
    now,
  );
  const committed = await db.query<{ state: IntakeState }>(
    "select public.cie33_commit($1, $2, $3, $4, $5, $6::jsonb, $7) as state",
    [
      patient,
      crypto.randomUUID(),
      contentHash({ k: crypto.randomUUID() }),
      persisted.revision,
      persisted.stateHash,
      JSON.stringify(held),
      "answer",
    ],
  );
  const state = committed.rows[0].state;
  expect(state.safety).toBe("handoff_required");
  return state;
}

function permittedState(held: IntakeState, clinicianId = clinician, authId = other) {
  const witnessId = latestEntries(held).find((e) => e.key === "safety")!.witness
    .id;
  return permitResumption(
    held,
    {
      reviewId: crypto.randomUUID(),
      authorizationId: authId,
      clinicianUserId: clinicianId,
      sourceWitnessId: witnessId,
    },
    later,
  );
}

async function submit(opts: {
  held: IntakeState;
  clinicianId?: string;
  disposition?: "keep_hold" | "permit_resumption";
  requestId?: string;
  state?: IntakeState | null;
  expectedRevision?: number;
  expectedHash?: string;
  note?: string;
  authId?: string;
}) {
  const clinicianId = opts.clinicianId ?? clinician;
  const disposition = opts.disposition ?? "permit_resumption";
  const requestId = opts.requestId ?? crypto.randomUUID();
  const witnessId = latestEntries(opts.held).find((e) => e.key === "safety")!
    .witness.id;
  const state =
    opts.state === undefined
      ? disposition === "permit_resumption"
        ? permittedState(opts.held, clinicianId, opts.authId ?? other)
        : null
      : opts.state;
  const note =
    opts.note ?? "Spoke with the patient by phone and completed a full risk assessment.";
  const res = await db.query<{ out: Record<string, unknown> }>(
    `select public.cie33_submit_safety_review(
       $1,$2,$3,$4,$5,$6,$7,$8,$9::timestamptz,$10,$11,$12,$13,$14::jsonb) as out`,
    [
      clinicianId,
      patient,
      requestId,
      contentHash({ requestId, disposition, note }),
      opts.held.id,
      opts.expectedRevision ?? opts.held.revision,
      opts.expectedHash ?? opts.held.stateHash,
      disposition,
      later,
      note,
      "Documented rationale for permitting the patient to continue the intake.",
      "Continue the intake today and call the crisis line if anything changes.",
      witnessId,
      state ? JSON.stringify(state) : null,
    ],
  );
  return res.rows[0].out;
}

beforeAll(async () => {
  db = new PGlite();
  // Pre-existing production objects the new migration depends on.
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth, public to authenticated, anon, service_role;
    grant execute on function auth.uid() to authenticated, anon, service_role;
    insert into auth.users values ('${patient}'), ('${clinician}'), ('${other}'), ('${admin}');
    create table public.cie_assessments (
      id uuid primary key default gen_random_uuid(), user_id uuid not null,
      version integer not null default 1, status text not null default 'in_progress',
      total_questions_answered integer not null default 0, full_completed_at timestamptz,
      created_at timestamptz not null default now(), updated_at timestamptz not null default now()
    );
    alter table public.cie_assessments enable row level security;
    create policy legacy_owner on public.cie_assessments for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
    grant select, insert, update, delete on public.cie_assessments to authenticated, service_role;
    create type public.app_role as enum ('admin', 'moderator', 'user');
    create table public.user_roles (
      id uuid primary key default gen_random_uuid(), user_id uuid not null, role public.app_role not null,
      created_at timestamptz not null default now(), unique (user_id, role)
    );
    grant select on public.user_roles to authenticated; grant all on public.user_roles to service_role;
    create function public.has_role(_user_id uuid, _role public.app_role) returns boolean
      language sql stable security definer set search_path = public as $$
      select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;
    create table public.profiles (
      id uuid primary key default gen_random_uuid(), user_id uuid not null unique, display_name text
    );
    grant select on public.profiles to authenticated; grant all on public.profiles to service_role;
    insert into public.user_roles (user_id, role) values ('${admin}', 'admin'), ('${other}', 'admin');
  `);
  await db.exec(
    readFileSync(
      "supabase/migrations/20260918031800_cie_v33_patient_intake.sql",
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(
      "drizzle/migrations/0001_clinician_review_authority.sql",
      "utf8",
    ),
  );
}, 60000);

beforeEach(async () => {
  await role("postgres");
  // The audit and review tables are append-only in production; the fixture
  // resets them only by suspending those guards as the table owner.
  await db.exec(`
    alter table public.cie33_safety_reviews disable trigger cie33_safety_reviews_append_only;
    alter table public.clinician_authorization_audit disable trigger clinician_authorization_audit_append_only;
    delete from public.cie33_safety_reviews;
    delete from public.clinician_authorization_audit;
    delete from public.clinician_patient_authorizations;
    alter table public.cie33_safety_reviews enable trigger cie33_safety_reviews_append_only;
    alter table public.clinician_authorization_audit enable trigger clinician_authorization_audit_append_only;
  `);
  await db.exec(
    "delete from public.cie_assessments where instrument_version = '3.3.0'",
  );
  await role("service_role");
});

afterAll(async () => {
  await db?.close();
});

describe("clinician authority register", () => {
  it("records a patient-scoped grant with credentials, granter and expiry, and audits it", async () => {
    const id = await grant();
    const row = (
      await db.query<Record<string, unknown>>(
        "select * from public.clinician_patient_authorizations where id = $1",
        [id],
      )
    ).rows[0];
    expect(row.patient_user_id).toBe(patient);
    expect(row.granted_by).toBe(admin);
    expect(row.revoked_at).toBeNull();
    const audit = (
      await db.query<{ action: string; actor_user_id: string }>(
        "select action, actor_user_id from public.clinician_authorization_audit where authorization_id = $1",
        [id],
      )
    ).rows;
    expect(audit).toEqual([{ action: "granted", actor_user_id: admin }]);
  });

  it("refuses a non-admin granter, a self-grant and a self-authorization", async () => {
    await expect(grant(clinician, patient, 7, clinician)).rejects.toThrow(
      /ADMIN_REQUIRED/,
    );
    await expect(grant(other, patient, 7, other)).rejects.toThrow(
      /SELF_GRANT_FORBIDDEN/,
    );
    await expect(grant(patient, patient, 7, admin)).rejects.toThrow(
      /cpa_no_self_authorization/,
    );
  });

  it("rejects an inverted or excessive authority window", async () => {
    await expect(
      db.query(
        `select public.clinician_grant_authorization($1,$2,$3,$4,$5,$6)`,
        [
          admin,
          clinician,
          patient,
          "LIC-1",
          "Credential verified against the register by operations.",
          new Date(Date.now() - 86400000).toISOString(),
        ],
      ),
    ).rejects.toThrow(/AUTHORIZATION_WINDOW_INVALID/);
    await expect(grant(clinician, patient, 500)).rejects.toThrow(
      /AUTHORIZATION_WINDOW_TOO_LONG/,
    );
  });

  it("revokes once, audits the revocation, and refuses a second revocation", async () => {
    const id = await grant();
    await db.query(
      "select public.clinician_revoke_authorization($1, $2, $3)",
      [admin, id, "Engagement ended"],
    );
    await expect(
      db.query("select public.clinician_revoke_authorization($1, $2, $3)", [
        admin,
        id,
        "again",
      ]),
    ).rejects.toThrow(/AUTHORIZATION_ALREADY_REVOKED/);
    const actions = (
      await db.query<{ action: string }>(
        "select action from public.clinician_authorization_audit where authorization_id = $1 order by occurred_at",
        [id],
      )
    ).rows.map((r) => r.action);
    expect(actions).toEqual(["granted", "revoked"]);
  });

  it("keeps the audit trail append-only", async () => {
    const id = await grant();
    await role("postgres");
    await expect(
      db.query(
        "update public.clinician_authorization_audit set action = 'revoked' where authorization_id = $1",
        [id],
      ),
    ).rejects.toThrow(/APPEND_ONLY/);
    await expect(
      db.query(
        "delete from public.clinician_authorization_audit where authorization_id = $1",
        [id],
      ),
    ).rejects.toThrow(/APPEND_ONLY/);
  });
});

describe("clinician safety review RPC", () => {
  it("permits resumption for an authorized clinician and records an immutable attributed review", async () => {
    const authId = await grant();
    const held = await seedHeldSession();
    const out = (await submit({ held, authId })) as {
      review_id: string;
      replayed: boolean;
      state: IntakeState;
    };
    expect(out.replayed).toBe(false);
    expect(out.state.safety).toBe("recheck_required");
    expect(out.state.phase).toBe("active");
    expect(out.state.revision).toBe(held.revision + 1);
    // original patient answers and witnesses unchanged
    expect(out.state.entries).toEqual(held.entries);

    const review = (
      await db.query<Record<string, unknown>>(
        "select * from public.cie33_safety_reviews where id = $1",
        [out.review_id],
      )
    ).rows[0];
    expect(review.clinician_user_id).toBe(clinician);
    expect(review.authorization_id).toBe(authId);
    expect(review.source_revision).toBe(held.revision);
    expect(review.source_state_hash).toBe(held.stateHash);
    expect(review.disposition).toBe("permit_resumption");

    const event = (
      await db.query<{ event: Record<string, unknown> }>(
        "select event from public.cie33_events where session_id = $1 and event->>'action' = 'clinician_safety_review'",
        [held.id],
      )
    ).rows;
    expect(event).toHaveLength(1);
    expect(event[0].event.clinicianUserId).toBe(clinician);

    // service_role holds no update/delete privilege at all;
    // even the table owner is stopped by the append-only guard.
    await expect(
      db.query("update public.cie33_safety_reviews set rationale = 'x'"),
    ).rejects.toThrow(/permission denied/i);
    await role("postgres");
    await expect(
      db.query("update public.cie33_safety_reviews set rationale = 'x'"),
    ).rejects.toThrow(/APPEND_ONLY/);
    await expect(
      db.query("delete from public.cie33_safety_reviews"),
    ).rejects.toThrow(/APPEND_ONLY/);
    await role("service_role");
  });

  it("keep_hold documents the review and leaves the held state untouched", async () => {
    await grant();
    const held = await seedHeldSession();
    const out = (await submit({ held, disposition: "keep_hold" })) as {
      state: IntakeState;
    };
    expect(out.state.safety).toBe("handoff_required");
    expect(out.state.revision).toBe(held.revision);
    expect(out.state.entries).toEqual(held.entries);
  });

  it("replays an identical request without creating a second review", async () => {
    await grant();
    const held = await seedHeldSession();
    const requestId = crypto.randomUUID();
    const first = (await submit({ held, requestId })) as { review_id: string };
    const replay = (await submit({ held, requestId })) as {
      review_id: string;
      replayed: boolean;
    };
    expect(replay.replayed).toBe(true);
    expect(replay.review_id).toBe(first.review_id);
    const count = (
      await db.query<{ n: number }>(
        "select count(*)::int as n from public.cie33_safety_reviews",
      )
    ).rows[0].n;
    expect(count).toBe(1);
  });

  it("rejects reuse of a request ID for different content", async () => {
    await grant();
    const held = await seedHeldSession();
    const requestId = crypto.randomUUID();
    await submit({ held, requestId });
    await expect(
      submit({
        held,
        requestId,
        note: "A completely different assessment note for the same request ID.",
      }),
    ).rejects.toThrow(/IDEMPOTENCY_CONFLICT/);
  });

  it("rejects a stale revision and a stale state hash", async () => {
    await grant();
    const held = await seedHeldSession();
    await expect(
      submit({ held, expectedRevision: held.revision - 1 }),
    ).rejects.toThrow(/STALE_STATE/);
    await expect(
      submit({ held, expectedHash: "sha256:deadbeef" }),
    ).rejects.toThrow(/STALE_STATE/);
  });

  it("rejects a second disposition on an already-resumed intake", async () => {
    await grant();
    const held = await seedHeldSession();
    const out = (await submit({ held })) as { state: IntakeState };
    await expect(
      submit({
        held: { ...out.state, id: held.id } as IntakeState,
        expectedRevision: out.state.revision,
        expectedHash: out.state.stateHash,
        state: null,
        disposition: "keep_hold",
      }),
    ).rejects.toThrow(/NOT_HELD/);
  });

  it("denies a clinician with no grant, and admin role alone is not clearance", async () => {
    const held = await seedHeldSession();
    await expect(submit({ held })).rejects.toThrow(/NOT_AUTHORIZED/);
    // `other` holds the admin role but no patient-scoped grant.
    await expect(submit({ held, clinicianId: other })).rejects.toThrow(
      /NOT_AUTHORIZED/,
    );
  });

  it("denies a revoked grant and an expired grant", async () => {
    const id = await grant();
    const held = await seedHeldSession();
    await db.query("select public.clinician_revoke_authorization($1,$2,$3)", [
      admin,
      id,
      "Revoked for test",
    ]);
    await expect(submit({ held })).rejects.toThrow(/NOT_AUTHORIZED/);

    // Simulate the passage of time past the expiry: the immutability guard is
    // suspended as the table owner purely so the fixture can age the row.
    await role("postgres");
    await db.exec(
      "alter table public.clinician_patient_authorizations disable trigger clinician_authorization_validate",
    );
    await db.query(
      "update public.clinician_patient_authorizations set revoked_at = null, revoked_by = null, expires_at = now() - interval '1 day' where id = $1",
      [id],
    );
    await db.exec(
      "alter table public.clinician_patient_authorizations enable trigger clinician_authorization_validate",
    );
    await role("service_role");
    await expect(submit({ held })).rejects.toThrow(/NOT_AUTHORIZED/);
  });

  it("denies self-review even with a grant row present", async () => {
    await grant();
    const held = await seedHeldSession();
    await expect(submit({ held, clinicianId: patient })).rejects.toThrow(
      /SELF_REVIEW_FORBIDDEN|own intake|cpa_no_self|NOT_AUTHORIZED/,
    );
  });

  it("rejects a resumption state that has been tampered with", async () => {
    await grant();
    const held = await seedHeldSession();
    const permitted = permittedState(held);
    // The clinician cannot answer the safety question on the patient's behalf.
    const tampered = {
      ...permitted,
      safety: "no_signal_reported",
    } as unknown as IntakeState;
    await expect(submit({ held, state: tampered })).rejects.toThrow(
      /INVALID_PERMIT/,
    );
    const droppedEntries = {
      ...permitted,
      entries: [],
    } as unknown as IntakeState;
    await expect(submit({ held, state: droppedEntries })).rejects.toThrow(
      /INVALID_PERMIT/,
    );
    await expect(submit({ held, state: null })).rejects.toThrow(
      /INVALID_PERMIT/,
    );
  });
});

describe("access control on review records", () => {
  it("never exposes clinical notes or the RPC to patients, admins or anonymous users", async () => {
    await grant();
    const held = await seedHeldSession();
    await submit({ held });

    for (const actor of ["authenticated", "anon"]) {
      await role(actor, patient);
      await expect(
        db.query("select * from public.cie33_safety_reviews"),
      ).rejects.toThrow(/permission denied/i);
      await expect(
        db.query(
          "insert into public.cie33_safety_reviews (request_id, request_hash, session_id, patient_user_id, clinician_user_id, authorization_id, source_revision, source_state_hash, source_witness_id, disposition, encounter_at, assessment_note, rationale, patient_instructions) values (gen_random_uuid(),'sha256:x',$1,$1,$2,gen_random_uuid(),0,'sha256:y','w','permit_resumption',now(),'aaaaaaaaaaaaaaaaaaaaaa','bbbbbbbbbbbbbbbbbbbbbb','cccccccccccc')",
          [held.id, clinician],
        ),
      ).rejects.toThrow(/permission denied/i);
      await expect(
        db.query(
          "select public.cie33_submit_safety_review($1,$1,gen_random_uuid(),'sha256:x',$2,0,'sha256:y','keep_hold',now(),'a','b','c','w',null)",
          [patient, held.id],
        ),
      ).rejects.toThrow(/permission denied/i);
      await expect(
        db.query(
          "insert into public.clinician_patient_authorizations (clinician_user_id, patient_user_id, credential_reference, credential_attestation, granted_by, expires_at) values ($1,$2,'x','yyyyyyyyyyyyyyyyyyyyyy',$1, now() + interval '1 day')",
          [clinician, patient],
        ),
      ).rejects.toThrow(/permission denied/i);
      await expect(
        db.query("select public.clinician_grant_authorization($1,$2,$3,$4,$5,now() + interval '1 day')", [
          patient,
          clinician,
          patient,
          "x",
          "yyyyyyyyyyyyyyyyyyyyyy",
        ]),
      ).rejects.toThrow(/permission denied/i);
    }
  });

  it("shows the patient only their own patient-facing notice", async () => {
    await grant();
    const held = await seedHeldSession();
    await submit({ held });
    await role("authenticated", patient);
    const mine = (
      await db.query<Record<string, unknown>>(
        "select * from public.cie33_safety_review_notices",
      )
    ).rows;
    expect(mine).toHaveLength(1);
    expect(mine[0].patient_instructions).toBeTruthy();
    expect(mine[0]).not.toHaveProperty("assessment_note");
    expect(mine[0]).not.toHaveProperty("rationale");

    await role("authenticated", clinician);
    const theirs = (
      await db.query("select * from public.cie33_safety_review_notices")
    ).rows;
    expect(theirs).toHaveLength(0);
  });

  it("lets a clinician read their own grants but not another clinician's", async () => {
    const mineId = await grant(clinician, patient);
    await role("postgres");
    await db.query(
      "insert into public.clinician_patient_authorizations (clinician_user_id, patient_user_id, credential_reference, credential_attestation, granted_by, expires_at) values ($1,$2,'LIC-9','Credential verified by operations lead.',$3, now() + interval '1 day')",
      [other, patient, admin],
    );
    await role("authenticated", clinician);
    const rows = (
      await db.query<{ id: string }>(
        "select id from public.clinician_patient_authorizations",
      )
    ).rows;
    expect(rows.map((r) => r.id)).toEqual([mineId]);

    await role("authenticated", patient);
    const asPatient = (
      await db.query("select * from public.clinician_patient_authorizations")
    ).rows;
    expect(asPatient).toHaveLength(0);
  });
});
