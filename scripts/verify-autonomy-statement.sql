-- Run with a migration/test administrator, never a patient credential.
-- The inner subtransaction deliberately rolls back all synthetic records.
-- Unexpected failures propagate; only the explicit success sentinel is caught.
DO $probe$
DECLARE
  probe_user uuid := gen_random_uuid();
  probe_report uuid := gen_random_uuid();
  probe_statement uuid := gen_random_uuid();
  visible_rows integer;
BEGIN
  BEGIN
    INSERT INTO public.biotwin_reports
      (id,user_id,schema_name,report_type,content_sha256,adapter_version,raw_report)
    VALUES
      (probe_report,probe_user,'Vizzhy BioTwin Clinical Evidence Report',
       'FINAL_CORRECTED_CLINICAL_EVIDENCE_REPORT','d2c-rollback-probe-'||probe_report,'security-probe','{}');
    INSERT INTO public.biotwin_statements
      (id,report_id,user_id,source_id,section,statement_kind,truth_status,title,clinical_authority,ordinal)
    VALUES
      (probe_statement,probe_report,probe_user,'d2c-rollback-probe','synthetic','synthetic',
       'candidate','Synthetic rollback-only security check','patient_facing',0);
    PERFORM set_config('request.jwt.claim.sub',probe_user::text,true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    SELECT count(*) INTO visible_rows FROM public.biotwin_statements WHERE id=probe_statement;
    IF visible_rows <> 1 THEN RAISE EXCEPTION 'PROBE_FAILED: owner read denied'; END IF;
    BEGIN
      UPDATE public.biotwin_statements SET truth_status='confirmed',clinical_authority='clinician_only'
        WHERE id=probe_statement;
      RAISE EXCEPTION 'PROBE_FAILED: protected write succeeded';
    EXCEPTION WHEN insufficient_privilege THEN
      NULL;
    END;
    RAISE SQLSTATE 'ZP001' USING MESSAGE='probe passed; roll back all synthetic rows';
  EXCEPTION WHEN SQLSTATE 'ZP001' THEN
    NULL;
  END;
END
$probe$;
SELECT 'PASS: valid owned statement readable, authority write denied, fixture rolled back' AS result,
       (SELECT count(*) FROM public.biotwin_reports) AS reports,
       (SELECT count(*) FROM public.biotwin_statements) AS statements;
