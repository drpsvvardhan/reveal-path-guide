update public.patient_lab_uploads
set status = 'failed',
    error_message = 'This report doesn''t contain any numeric biomarkers we can chart (it looks like a qualitative report — e.g. stool routine, culture, or microscopy). Nothing was added to your timeline.'
where id = 'd8877e9e-45f0-4204-ba92-25855531da1c';