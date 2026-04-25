-- RAE append-only state transition audit log. Plan §3.2.
-- Every state change appends one row. Updates and deletes are forbidden
-- by RLS so the audit chain is immutable.

CREATE TABLE public.rae_state_transitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caw_id uuid NOT NULL REFERENCES public.concept_assignment_witnesses(caw_id) ON DELETE RESTRICT,
  from_state public.rae_admission_state,
  to_state public.rae_admission_state NOT NULL,
  actor_kind text NOT NULL,
  actor_id text NOT NULL,
  reason text NOT NULL,
  policy text NOT NULL DEFAULT 'default',
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT rae_state_transitions_actor_kind_valid
    CHECK (actor_kind IN ('engine','human')),
  CONSTRAINT rae_state_transitions_reason_min_length
    CHECK (char_length(btrim(reason)) >= 10),
  CONSTRAINT rae_state_transitions_policy_valid
    CHECK (policy IN ('default','calibration_all_routes_to_review','back_annotation')),
  CONSTRAINT rae_state_transitions_human_confirmed_requires_human
    CHECK (to_state <> 'human_confirmed' OR actor_kind = 'human'),
  CONSTRAINT rae_state_transitions_no_self_transition
    CHECK (from_state IS DISTINCT FROM to_state)
);

CREATE INDEX idx_rae_state_transitions_caw       ON public.rae_state_transitions (caw_id);
CREATE INDEX idx_rae_state_transitions_to_state  ON public.rae_state_transitions (to_state);
CREATE INDEX idx_rae_state_transitions_created   ON public.rae_state_transitions (created_at);

ALTER TABLE public.rae_state_transitions ENABLE ROW LEVEL SECURITY;

-- Owner read via join through CAW.
CREATE POLICY "rae_state_transitions_owner_read"
  ON public.rae_state_transitions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.concept_assignment_witnesses caw
      WHERE caw.caw_id = rae_state_transitions.caw_id
        AND caw.user_id = auth.uid()
    )
  );

-- Admin read.
CREATE POLICY "rae_state_transitions_admin_read"
  ON public.rae_state_transitions FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Service role inserts only. No update/delete policies — append-only.
CREATE POLICY "rae_state_transitions_service_role_insert"
  ON public.rae_state_transitions FOR INSERT TO service_role
  WITH CHECK (true);

CREATE POLICY "rae_state_transitions_service_role_select"
  ON public.rae_state_transitions FOR SELECT TO service_role
  USING (true);

COMMENT ON TABLE public.rae_state_transitions IS
  'Append-only audit log of RAE admission state changes. One row per transition. Update and delete are forbidden by RLS (no policies). Allowed/forbidden transition sets are enforced in the orchestrator (TypeScript) per spec §6.2 / §6.3, not in the database, to keep the encoded state machine in one place.';