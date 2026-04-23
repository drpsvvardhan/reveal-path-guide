BEGIN;

DROP INDEX IF EXISTS public.witness_objects_provenance_seed_uniq;

CREATE UNIQUE INDEX witness_objects_provenance_seed_uniq
  ON public.witness_objects (user_id, source_table, source_row_id, registry_seed_version);

COMMENT ON INDEX public.witness_objects_provenance_seed_uniq IS
  'Pattern Z idempotency (CodexOS, 20 Apr 2026; fixed 23 Apr 2026). '
  'PostgREST ON CONFLICT target for the witnessify backfill. '
  'Non-partial because PostgREST does not accept partial unique indexes as '
  'conflict targets. Rows with NULL source_row_id are allowed to duplicate '
  'in this dimension — acceptable because P1a does not materialize '
  'observation packets. When packets enter use in P1b, add a separate '
  'unique index for (user_id, derived_from_packet_id, registry_seed_version).';

COMMIT;