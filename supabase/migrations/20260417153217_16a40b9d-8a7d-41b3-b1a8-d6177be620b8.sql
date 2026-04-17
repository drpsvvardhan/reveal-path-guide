-- View-as session backend schema
-- Tables, indexes, RLS, and the has_valid_view_as_session() helper used by edge functions.

CREATE TABLE IF NOT EXISTS public.admin_view_as_sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id   uuid NOT NULL,
  target_user_id  uuid NOT NULL,
  reason          text NOT NULL,
  granted_at      timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL,
  revoked_at      timestamptz,
  revoked_by      uuid,
  revoke_reason   text,
  access_count    integer NOT NULL DEFAULT 0,
  last_accessed_at timestamptz,
  CONSTRAINT admin_view_as_sessions_no_self CHECK (admin_user_id <> target_user_id),
  CONSTRAINT admin_view_as_sessions_expiry_after_grant CHECK (expires_at > granted_at)
);

CREATE INDEX IF NOT EXISTS idx_admin_view_as_sessions_admin_active
  ON public.admin_view_as_sessions (admin_user_id, target_user_id)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_admin_view_as_sessions_expires_at
  ON public.admin_view_as_sessions (expires_at);

ALTER TABLE public.admin_view_as_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read own view-as sessions"
  ON public.admin_view_as_sessions;
CREATE POLICY "Admins can read own view-as sessions"
  ON public.admin_view_as_sessions
  FOR SELECT
  TO authenticated
  USING (admin_user_id = auth.uid() AND public.has_role(auth.uid(), 'admin'::public.app_role));

-- All writes go through the edge function with the service role; deny direct mutations.
DROP POLICY IF EXISTS "Block direct insert on view-as sessions"
  ON public.admin_view_as_sessions;
CREATE POLICY "Block direct insert on view-as sessions"
  ON public.admin_view_as_sessions
  FOR INSERT TO authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS "Block direct update on view-as sessions"
  ON public.admin_view_as_sessions;
CREATE POLICY "Block direct update on view-as sessions"
  ON public.admin_view_as_sessions
  FOR UPDATE TO authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "Block direct delete on view-as sessions"
  ON public.admin_view_as_sessions;
CREATE POLICY "Block direct delete on view-as sessions"
  ON public.admin_view_as_sessions
  FOR DELETE TO authenticated
  USING (false);


CREATE TABLE IF NOT EXISTS public.admin_view_as_audit (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      uuid REFERENCES public.admin_view_as_sessions(id) ON DELETE SET NULL,
  admin_user_id   uuid NOT NULL,
  target_user_id  uuid NOT NULL,
  event_type      text NOT NULL,
  event_detail    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_view_as_audit_admin_created
  ON public.admin_view_as_audit (admin_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_view_as_audit_target_created
  ON public.admin_view_as_audit (target_user_id, created_at DESC);

ALTER TABLE public.admin_view_as_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read own view-as audit"
  ON public.admin_view_as_audit;
CREATE POLICY "Admins can read own view-as audit"
  ON public.admin_view_as_audit
  FOR SELECT
  TO authenticated
  USING (admin_user_id = auth.uid() AND public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Block direct insert on view-as audit"
  ON public.admin_view_as_audit;
CREATE POLICY "Block direct insert on view-as audit"
  ON public.admin_view_as_audit
  FOR INSERT TO authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS "Block direct update on view-as audit"
  ON public.admin_view_as_audit;
CREATE POLICY "Block direct update on view-as audit"
  ON public.admin_view_as_audit
  FOR UPDATE TO authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "Block direct delete on view-as audit"
  ON public.admin_view_as_audit;
CREATE POLICY "Block direct delete on view-as audit"
  ON public.admin_view_as_audit
  FOR DELETE TO authenticated
  USING (false);


-- RPC used by other edge functions (e.g. export-celf-bundle) to gate cross-user access.
CREATE OR REPLACE FUNCTION public.has_valid_view_as_session(
  p_admin_user_id uuid,
  p_target_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.admin_view_as_sessions s
     WHERE s.admin_user_id  = p_admin_user_id
       AND s.target_user_id = p_target_user_id
       AND s.revoked_at IS NULL
       AND s.expires_at > now()
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_valid_view_as_session(uuid, uuid)
  TO authenticated, service_role;