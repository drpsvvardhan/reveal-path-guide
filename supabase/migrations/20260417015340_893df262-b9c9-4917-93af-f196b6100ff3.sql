-- ============================================================================
-- Retroactive specimen_type backfill
-- Date: 2026-04-17
--
-- The BEFORE INSERT trigger (trg_inherit_specimen_type) is working correctly
-- for any NEW observations, but 923 existing observations predate the trigger.
-- This migration updates those existing rows.
--
-- Uses the upload's document_type (already correctly set on 33 uploads:
--   29 lab / 2 fibroscan / 2 inbody) as the source of truth.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Body composition (InBody)
-- ----------------------------------------------------------------------------
update public.patient_lab_observations o
   set specimen_type = 'body_composition'
  from public.patient_lab_uploads u
 where o.upload_id = u.id
   and u.document_type = 'inbody'
   and (o.specimen_type is null or o.specimen_type = '');

-- ----------------------------------------------------------------------------
-- 2. FibroScan
-- ----------------------------------------------------------------------------
update public.patient_lab_observations o
   set specimen_type = 'fibroscan'
  from public.patient_lab_uploads u
 where o.upload_id = u.id
   and u.document_type = 'fibroscan'
   and (o.specimen_type is null or o.specimen_type = '');

-- ----------------------------------------------------------------------------
-- 3. Verification
-- ----------------------------------------------------------------------------
do $$
declare
  v_inbody int;
  v_fibroscan int;
  v_null_remaining int;
begin
  select count(*) into v_inbody    from public.patient_lab_observations where specimen_type = 'body_composition';
  select count(*) into v_fibroscan from public.patient_lab_observations where specimen_type = 'fibroscan';
  select count(*) into v_null_remaining from public.patient_lab_observations where specimen_type is null;
  raise notice 'Backfill complete: body_composition=%, fibroscan=%, null(lab)=%',
    v_inbody, v_fibroscan, v_null_remaining;
end$$;