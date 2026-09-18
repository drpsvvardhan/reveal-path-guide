// @vitest-environment node
// Independent regression checks run against the historical table migrations,
// including the permissive legacy policy names found in the live database.
import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const a = "10000000-0000-4000-8000-000000000001";
const b = "10000000-0000-4000-8000-000000000002";
const expA = "20000000-0000-4000-8000-000000000001";
const expB = "20000000-0000-4000-8000-000000000002";
let db: PGlite;
const read = (path: string) => readFileSync(path, "utf8");

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    grant usage on schema auth, public to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
    create function public.has_role(uuid,text) returns boolean language sql as $$ select false $$;
    create function public.has_valid_view_as_session(uuid,uuid) returns boolean language sql as $$ select false $$;
    create function public.rae_touch_updated_at() returns trigger language plpgsql as $$
      begin new.updated_at = now(); return new; end
    $$;
    create table public.patient_lab_uploads(id uuid primary key);
    create table public.witness_objects(witness_id uuid primary key,user_id uuid,value jsonb);
    create table public.cie33_sessions(id uuid primary key,user_id uuid,state jsonb);
    create table public.cie_assessments(id uuid primary key,user_id uuid,state jsonb);
    grant all on public.witness_objects,public.cie33_sessions,public.cie_assessments to service_role;
  `);
  const bio = read("docs/migrations-pending/20260805190500_biotwin_governed_reports.sql");
  await db.exec(bio.slice(0, bio.indexOf("-- 4. Pre-registered")));
  await db.exec(read("supabase/migrations/20260630040042_7e66ae59-a8d6-4905-affd-61a8b148500f.sql"));
  await db.exec(read("supabase/migrations/20260630125859_6ab4e727-c92d-4788-a417-2dfbdc702a52.sql"));
  await db.exec(read("supabase/migrations/20260728140337_d0cb90c6-52c7-4897-ac2e-eb7dbde20913.sql"));
  await db.exec(`
    grant update,delete on simulator_daily_observations to authenticated;
    create policy sdo_own_update on simulator_daily_observations for update to authenticated
      using(auth.uid()=user_id) with check(auth.uid()=user_id);
    create policy sdo_own_delete on simulator_daily_observations for delete to authenticated
      using(auth.uid()=user_id);
    insert into simulator_experiments(id,user_id,lever,rationale) values
      ('${expA}','${a}','Observe energy','Synthetic permission test'),
      ('${expB}','${b}','Observe sleep','Synthetic permission test');
  `);
  await db.exec(read("drizzle/migrations/0005_patient_autonomy_authority.sql"));
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${a}',false)`);
}, 60000);

beforeEach(async () => {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub','${a}',false); set role authenticated`);
});
afterAll(async () => { await db?.close(); });

describe("independent patient ownership and derived authority", () => {
  it("retains reads of the patient's own experiments and hides another patient's", async () => {
    const r = await db.query<{ id: string }>("select id from simulator_experiments");
    expect(r.rows).toEqual([{ id: expA }]);
  });

  it("retains self-reporting for an owned experiment", async () => {
    const r = await db.query(`insert into simulator_daily_observations
      (user_id,experiment_id,phase,observed_on,primary_value)
      values ('${a}','${expA}','run_in','2026-01-01',4) returning id`);
    expect(r.rows).toHaveLength(1);
  });

  it("rejects attaching one's own observation to someone else's experiment", async () => {
    await expect(db.query(`insert into simulator_daily_observations
      (user_id,experiment_id,phase,observed_on,primary_value)
      values ('${a}','${expB}','run_in','2026-01-02',4)`)).rejects.toThrow();
  });

  it("rejects moving an owned observation to someone else's experiment", async () => {
    await expect(db.query(`update simulator_daily_observations
      set experiment_id='${expB}' where experiment_id='${expA}'`)).rejects.toThrow();
  });

  it("rejects direct phase changes even on an owned experiment", async () => {
    await expect(db.query(`update simulator_experiments
      set phase='intervention' where id='${expA}'`)).rejects.toThrow();
  });

  it("rejects deleting an experiment to cascade away its protected protocol", async () => {
    await expect(db.query(`delete from simulator_experiments where id='${expA}'`)).rejects.toThrow();
  });
});

async function seed() {
  await db.exec("reset role");
  const e = (await db.query<{ id: string }>(`insert into simulator_experiments(user_id,lever,rationale)
    values ('${a}','Synthetic plan','No patient data') returning id`)).rows[0].id;
  const p = (await db.query<{ id: string }>(`insert into simulator_experiment_protocols
    (experiment_id,user_id,hypothesis_question,perturbation_category,primary_outcome,executable_sha256)
    values ($1,$2,'Observe energy?','sleep','{}','synthetic-content') returning id`,[e,a])).rows[0].id;
  const snapshot = async () => {
    const exp = (await db.query<any>("select to_jsonb(e) as row from simulator_experiments e where id=$1",[e])).rows[0].row;
    const proto = (await db.query<any>("select to_jsonb(p) as row from simulator_experiment_protocols p where id=$1",[p])).rows[0].row;
    const fp = (await db.query<any>("select simulator_admission_fingerprint($1) as fp",[a])).rows[0].fp;
    return { exp, proto, fp };
  };
  return {e,p,snapshot};
}
async function start(f: Awaited<ReturnType<typeof seed>>, s: any, changes: any = {}) {
  await db.exec("set role service_role");
  return db.query<any>(`select simulator_transition_phase($1,$2,$3,$4,$5,1,'synthetic-content',$6,$7::jsonb,null) as result`,[
    a,f.e,s.exp.phase,"run_in",f.p,s.fp,JSON.stringify({activation_allowed:true,verdict:"ADMIT",
      observation_only:false,protocol_snapshot:s.proto,experiment_snapshot:s.exp,...changes}),
  ]);
}
describe("transactional admission boundaries", () => {
  it("denies authenticated callers access to service admission RPCs", async () => {
    await expect(db.query("select simulator_admission_fingerprint($1)",[a])).rejects.toThrow(/permission denied/);
  });
  it("admits the reviewed exact snapshot without clinician approval", async () => {
    const f = await seed(); const s = await f.snapshot();
    expect((await start(f,s)).rows[0].result.phase).toBe("run_in");
  });
  it("rejects a protocol edit that leaves its old content hash in place", async () => {
    const f = await seed(); const s = await f.snapshot();
    await db.query("update simulator_experiment_protocols set intervention='{\"dose\":999}' where id=$1",[f.p]);
    await expect(start(f,s)).rejects.toThrow(/PROTOCOL_CHANGED/);
  });
  it("rejects newly arrived clinical evidence after the check", async () => {
    const f = await seed(); const s = await f.snapshot();
    await db.query("insert into witness_objects values(gen_random_uuid(),$1,'{\"value\":9}')",[a]);
    await expect(start(f,s)).rejects.toThrow(/CONTEXT_CHANGED/);
  });
  it("rejects a CIE handoff even if the caller supplies the newest fingerprint", async () => {
    const f = await seed();
    await db.query("insert into cie33_sessions values(gen_random_uuid(),$1,'{\"safety\":\"handoff_required\"}')",[a]);
    await expect(start(f,await f.snapshot())).rejects.toThrow(/CONTEXT_CHANGED/);
    await db.exec("reset role"); await db.query("delete from cie33_sessions where user_id=$1",[a]);
  });
  it("permits observation-only tracking during a CIE hold", async () => {
    const f = await seed();
    await db.query("insert into cie33_sessions values(gen_random_uuid(),$1,'{\"safety\":\"handoff_required\"}')",[a]);
    expect((await start(f,await f.snapshot(),{observation_only:true})).rows[0].result.phase).toBe("run_in");
    await db.exec("reset role"); await db.query("delete from cie33_sessions where user_id=$1",[a]);
  });
  it("stops despite a stale phase and remains stopped on repetition", async () => {
    const f = await seed();
    await db.query("update simulator_experiments set phase='intervention' where id=$1",[f.e]);
    await db.exec("set role service_role");
    const stop = () => db.query<any>(`select simulator_transition_phase($1,$2,'draft','stopped',null,null,null,null,'{}',null) as result`,[a,f.e]);
    expect((await stop()).rows[0].result.phase).toBe("stopped");
    expect((await stop()).rows[0].result.idempotent).toBe(true);
  });
  it("rejects invalid lifecycle jumps even for the service caller", async () => {
    const f=await seed(); await db.exec("set role service_role");
    await expect(db.query(`select simulator_transition_phase($1,$2,'draft','intervention',null,null,null,null,'{}',null)`,[a,f.e])).rejects.toThrow(/INVALID_TRANSITION/);
  });
});
describe("comparison cycle integrity", () => {
  it("does not manufacture replication by changing observations and comparing again", async () => {
    const f=await seed();
    await db.query("update simulator_experiments set phase='intervention' where id=$1",[f.e]);
    const s=await f.snapshot();
    const result={n_a:5,n_b:5,result:"SIGNAL_DETECTED",reasons:{},human_summary:"Synthetic result",observation_fingerprint:"first"};
    const compare=(fp: string)=>db.query<any>(`select simulator_complete_comparison($1,$2,1,$3::jsonb,$4::jsonb) as result`,[a,f.e,JSON.stringify(s.exp),JSON.stringify({...result,observation_fingerprint:fp})]);
    await db.exec("set role service_role");
    expect((await compare("first")).rows[0].result.replayed).toBe(false);
    expect((await compare("edited")).rows[0].result.replayed).toBe(true);
    const count=await db.query<any>("select count(*)::int n from simulator_experiment_comparisons where experiment_id=$1",[f.e]);
    expect(count.rows[0].n).toBe(1);
    await expect(db.query("select simulator_graduate_experiment($1,$2)",[a,f.e])).rejects.toThrow(/REPLICATION_REQUIRED/);
  });
  it("assigns observation cycle itself and preserves it through corrections", async () => {
    const f=await seed(); await db.exec("set role authenticated");
    const row=await db.query<any>(`insert into simulator_daily_observations(user_id,experiment_id,phase,observed_on,cycle_index,primary_value)
      values($1,$2,'run_in','2026-02-01',99,4) returning id,cycle_index`,[a,f.e]);
    expect(row.rows[0].cycle_index).toBe(1);
    await db.query("update simulator_daily_observations set primary_value=5 where id=$1",[row.rows[0].id]);
    await expect(db.query("update simulator_daily_observations set cycle_index=2 where id=$1",[row.rows[0].id])).rejects.toThrow(/PROVENANCE_IMMUTABLE/);
  });
});

describe("the four reported security findings", () => {
  it.each([
    ["biotwin_statements", "truth_status='confirmed'"],
    ["biotwin_reports", "clinician_review_required=false"],
    ["simulator_what_if_cards", "patient_safe=true"],
    ["simulator_experiment_protocols", "admission_verdict='ADMIT'"],
  ])("rejects patient writes to %s authority", async (table, assignment) => {
    await expect(db.query(`update ${table} set ${assignment}`)).rejects.toThrow(/permission denied/);
  });
  it("preserves dismissing one's own suggestion while denying an accompanying safety edit", async () => {
    await db.exec("reset role");
    const c=(await db.query<any>(`insert into simulator_what_if_cards(user_id,lever,rationale) values($1,'Synthetic','Synthetic') returning id`,[a])).rows[0].id;
    await db.exec("set role authenticated");
    await db.query("update simulator_what_if_cards set dismissed_at=now() where id=$1",[c]);
    await expect(db.query("update simulator_what_if_cards set dismissed_at=now(),patient_safe=true where id=$1",[c])).rejects.toThrow(/permission denied/);
  });
});
