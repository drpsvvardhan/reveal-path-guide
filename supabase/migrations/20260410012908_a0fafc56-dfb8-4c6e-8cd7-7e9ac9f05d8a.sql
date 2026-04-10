-- Drop existing INSERT-only trigger
DROP TRIGGER IF EXISTS supersede_on_active_insert ON public.patient_narratives;

-- Recreate trigger to fire on both INSERT and UPDATE
CREATE TRIGGER supersede_on_active_insert
  BEFORE INSERT OR UPDATE ON public.patient_narratives
  FOR EACH ROW
  EXECUTE FUNCTION public.supersede_previous_active_narrative();
