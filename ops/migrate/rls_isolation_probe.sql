-- Patient Reveal — Azure migration operator tool (Gate G1 enforcement evidence).
--
-- Schema parity does NOT prove enforcement parity. This probe runs against a
-- candidate database that has had the rendered Azure baseline replayed into it,
-- and asserts that patient isolation actually holds when identity arrives via
-- request.jwt.claims + SET ROLE instead of Supabase GoTrue.
--
-- Synthetic identities only. Never point this at a database holding real
-- patient rows: it writes and then rolls back.
--
-- Every assertion raises on failure, so a non-zero psql exit is the verdict.

BEGIN;

-- Two synthetic patients and one synthetic admin.
INSERT INTO app_identity.app_users (id, email) VALUES
  ('11111111-1111-4111-8111-111111111111', 'subject-01@synthetic.invalid'),
  ('22222222-2222-4222-8222-222222222222', 'subject-02@synthetic.invalid'),
  ('33333333-3333-4333-8333-333333333333', 'admin-01@synthetic.invalid');

INSERT INTO public.profiles (user_id, display_name) VALUES
  ('11111111-1111-4111-8111-111111111111', 'Subject-01'),
  ('22222222-2222-4222-8222-222222222222', 'Subject-02');

INSERT INTO public.user_roles (user_id, role) VALUES
  ('33333333-3333-4333-8333-333333333333', 'admin');

INSERT INTO public.biotwin_reports (user_id, status, version, report_payload)
VALUES
  ('11111111-1111-4111-8111-111111111111', 'active', 1, '{"synthetic": true}'),
  ('22222222-2222-4222-8222-222222222222', 'active', 1, '{"synthetic": true}');

CREATE OR REPLACE FUNCTION pg_temp.assert(p_label text, p_ok boolean)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_ok THEN
    RAISE NOTICE 'PASS  %', p_label;
  ELSE
    RAISE EXCEPTION 'FAIL  %', p_label;
  END IF;
END
$$;

-- --------------------------------------------------------------------------
-- 1. Identity plumbing: the shims must read the claims the API will set.
-- --------------------------------------------------------------------------
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
SELECT pg_temp.assert(
  'auth.uid() resolves the claims subject',
  auth.uid() = '11111111-1111-4111-8111-111111111111'::uuid
);
SELECT pg_temp.assert('auth.role() resolves the claims role', auth.role() = 'authenticated');

-- --------------------------------------------------------------------------
-- 2. Patient isolation under RLS as the authenticated role.
-- --------------------------------------------------------------------------
SET LOCAL ROLE authenticated;

SELECT pg_temp.assert(
  'subject-01 sees exactly one profile (its own)',
  (SELECT count(*) FROM public.profiles) = 1
  AND (SELECT user_id FROM public.profiles) = '11111111-1111-4111-8111-111111111111'::uuid
);

SELECT pg_temp.assert(
  'subject-01 sees only its own twin report',
  (SELECT count(*) FROM public.biotwin_reports) = 1
  AND (SELECT user_id FROM public.biotwin_reports)
      = '11111111-1111-4111-8111-111111111111'::uuid
);

RESET ROLE;
SET LOCAL request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
SET LOCAL ROLE authenticated;

SELECT pg_temp.assert(
  'subject-02 sees only its own twin report (no cross-patient read)',
  (SELECT count(*) FROM public.biotwin_reports) = 1
  AND (SELECT user_id FROM public.biotwin_reports)
      = '22222222-2222-4222-8222-222222222222'::uuid
);

-- Writing into another patient's row must be refused, not silently accepted.
DO $$
DECLARE v_rows integer;
BEGIN
  UPDATE public.profiles
     SET display_name = 'tampered'
   WHERE user_id = '11111111-1111-4111-8111-111111111111';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 0 THEN
    RAISE EXCEPTION 'FAIL  cross-patient UPDATE affected % row(s)', v_rows;
  END IF;
  RAISE NOTICE 'PASS  cross-patient UPDATE affects zero rows';
END
$$;

DO $$
BEGIN
  INSERT INTO public.biotwin_reports (user_id, status, version, report_payload)
  VALUES ('11111111-1111-4111-8111-111111111111', 'active', 2, '{"forged": true}');
  RAISE EXCEPTION 'FAIL  forged insert for another patient was accepted';
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS  forged insert for another patient rejected by RLS';
END
$$;

-- --------------------------------------------------------------------------
-- 3. Anonymous traffic must see nothing.
-- --------------------------------------------------------------------------
RESET ROLE;
SET LOCAL request.jwt.claims = '{}';
SET LOCAL ROLE anon;

DO $$
DECLARE v_count integer;
BEGIN
  BEGIN
    SELECT count(*) INTO v_count FROM public.biotwin_reports;
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS  anon has no privilege on biotwin_reports';
    RETURN;
  END;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'FAIL  anon read % twin report row(s)', v_count;
  END IF;
  RAISE NOTICE 'PASS  anon reads zero twin report rows';
END
$$;

DO $$
DECLARE v_count integer;
BEGIN
  BEGIN
    SELECT count(*) INTO v_count FROM public.profiles;
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS  anon has no privilege on profiles';
    RETURN;
  END;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'FAIL  anon read % profile row(s)', v_count;
  END IF;
  RAISE NOTICE 'PASS  anon reads zero profile rows';
END
$$;

-- --------------------------------------------------------------------------
-- 4. The definer shims must not become an RLS bypass. app_auth_owner owns the
--    shims and must own no application table.
-- --------------------------------------------------------------------------
RESET ROLE;
SELECT pg_temp.assert(
  'app_auth_owner owns no application table',
  NOT EXISTS (
    SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname IN ('public', 'storage')
       AND c.relkind = 'r'
       AND c.relowner = 'app_auth_owner'::regrole
  )
);

SELECT pg_temp.assert(
  'has_role() is SECURITY DEFINER (no policy recursion on user_roles)',
  (SELECT prosecdef FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'has_role' LIMIT 1)
);

SELECT pg_temp.assert(
  'no public table is left without RLS',
  NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity = false
  )
);

ROLLBACK;
