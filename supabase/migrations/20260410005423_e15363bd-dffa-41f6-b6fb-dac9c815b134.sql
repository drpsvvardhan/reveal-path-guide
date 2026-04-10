
CREATE OR REPLACE FUNCTION public.supersede_previous_active_narrative()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'active' THEN
    UPDATE public.patient_narratives
    SET status = 'superseded'
    WHERE user_id = NEW.user_id
      AND status = 'active'
      AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;
