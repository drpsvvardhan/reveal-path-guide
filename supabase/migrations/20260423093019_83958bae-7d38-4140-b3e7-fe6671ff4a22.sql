BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS witness_objects_provenance_seed_uniq
  ON public.witness_objects (user_id, source_table, source_row_id, registry_seed_version)
  WHERE source_row_id IS NOT NULL;

COMMENT ON INDEX public.witness_objects_provenance_seed_uniq IS
  'Pattern Z idempotency (CodexOS, 20 Apr 2026). Allows witnessify backfill '
  'to use INSERT ... ON CONFLICT DO NOTHING. The tuple '
  '(user_id, source_table, source_row_id, registry_seed_version) is the '
  'natural identity of a witness derived from a raw row. A seed version bump '
  'constitutes a new contract and therefore a new witness, not a duplicate. '
  'Partial (source_row_id IS NOT NULL) so packet-derived witnesses are not '
  'affected by this index.';

COMMIT;