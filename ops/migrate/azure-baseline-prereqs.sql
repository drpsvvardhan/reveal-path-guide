-- Patient Reveal — Azure compatibility prerequisites (handover §6, §10.1 step 6).
-- Applied BEFORE any application DDL. Without these objects every auth.uid()
-- policy fails open or fails hard, and RLS silently goes permissive.
--
-- Ownership rule that must not be relaxed: the auth.* shims are SECURITY DEFINER
-- and are owned by app_auth_owner, a role that owns NO application table. A
-- definer function owned by the table owner would reintroduce the service_role
-- bypass this migration exists to remove.

-- ---------------------------------------------------------------------------
-- 1. Roles the live policies name. anon/authenticated/service_role are NOLOGIN
--    privilege buckets; the API connects as app_runtime and sets claims per
--    transaction.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    -- Retained as a grant target only. No connection uses it in Azure; the API
    -- and workers connect with scoped identities.
    CREATE ROLE service_role NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_auth_owner') THEN
    CREATE ROLE app_auth_owner NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_schema_owner') THEN
    CREATE ROLE app_schema_owner NOLOGIN NOINHERIT;
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- 2. Application identity. Entra oid/sub is issuer-controlled and immutable, so
--    it is an external key, never the application identity. The patient UUID
--    stays authoritative and every RLS policy keeps working unchanged.
-- ---------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS app_identity AUTHORIZATION app_schema_owner;

CREATE TABLE IF NOT EXISTS app_identity.app_users (
  id           uuid PRIMARY KEY,
  email        text,
  disabled_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_identity.identity_bindings (
  entra_oid        uuid PRIMARY KEY,
  app_user_id      uuid NOT NULL UNIQUE REFERENCES app_identity.app_users(id) ON DELETE CASCADE,
  issuer           text NOT NULL,
  bound_at         timestamptz NOT NULL DEFAULT now(),
  bound_by         text NOT NULL,
  revoked_at       timestamptz
);

-- An unmapped oid must be denied and surfaced as an admin provisioning task.
-- Never auto-create an application identity from a token.
CREATE TABLE IF NOT EXISTS app_identity.unmapped_identity_events (
  id          bigserial PRIMARY KEY,
  entra_oid   uuid NOT NULL,
  issuer      text NOT NULL,
  seen_at     timestamptz NOT NULL DEFAULT now(),
  request_id  text
);

-- ---------------------------------------------------------------------------
-- 3. auth.* shims. The API sets request.jwt.claims (a per-transaction GUC) to a
--    claims object whose `sub` is the resolved app_user_id.
-- ---------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS auth AUTHORIZATION app_auth_owner;

CREATE OR REPLACE FUNCTION auth.jwt()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claims', true), '')::jsonb,
    '{}'::jsonb
  );
$$;

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT NULLIF(auth.jwt() ->> 'sub', '')::uuid;
$$;

CREATE OR REPLACE FUNCTION auth.role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(NULLIF(auth.jwt() ->> 'role', ''), 'anon');
$$;

ALTER FUNCTION auth.jwt()  OWNER TO app_auth_owner;
ALTER FUNCTION auth.uid()  OWNER TO app_auth_owner;
ALTER FUNCTION auth.role() OWNER TO app_auth_owner;

GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.jwt(), auth.uid(), auth.role()
  TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. Minimal storage compatibility. Files live in private Blob Storage and are
--    reached only through short-lived user-delegation SAS issued by the API.
--    This table exists so replayed policies and any residual references resolve;
--    it is NOT the file authority.
-- ---------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS storage AUTHORIZATION app_schema_owner;

CREATE TABLE IF NOT EXISTS storage.buckets (
  id                 text PRIMARY KEY,
  public             boolean NOT NULL DEFAULT false,
  file_size_limit    bigint,
  allowed_mime_types text[],
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS storage.objects (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id  text NOT NULL REFERENCES storage.buckets(id),
  name       text NOT NULL,
  owner      uuid,
  metadata   jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bucket_id, name)
);

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Bucket inventory carried forward from the live catalogue. Both are private in
-- Azure: `ontology` is read by the API/worker managed identity, never publicly.
INSERT INTO storage.buckets (id, public) VALUES
  ('lab-uploads', false),
  ('ontology', false)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 5. Extensions live in their own schema, exactly as they do today. Installing
--    them into `public` would add ~36 functions to the application schema and
--    make every future drift comparison noisy.
-- ---------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS extensions AUTHORIZATION app_schema_owner;
CREATE EXTENSION IF NOT EXISTS pgcrypto  WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role;
-- Per-role search_path (not ALTER DATABASE) so extension functions resolve for
-- every connecting identity without a database-wide setting.
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    EXECUTE format('ALTER ROLE %I SET search_path TO public, extensions', r);
  END LOOP;
END
$$;
