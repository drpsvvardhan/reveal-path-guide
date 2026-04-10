-- Patient lab uploads table
CREATE TABLE public.patient_lab_uploads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  original_filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_size_bytes INTEGER,
  source_lab TEXT,
  collection_date DATE,
  ordering_provider TEXT,
  status TEXT NOT NULL DEFAULT 'uploaded',
  processing_started_at TIMESTAMP WITH TIME ZONE,
  processing_completed_at TIMESTAMP WITH TIME ZONE,
  observations_extracted INTEGER DEFAULT 0,
  observations_inserted INTEGER DEFAULT 0,
  observations_duplicates INTEGER DEFAULT 0,
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_plu_user_status ON public.patient_lab_uploads (user_id, status);
CREATE INDEX idx_plu_user_collection ON public.patient_lab_uploads (user_id, collection_date DESC);

-- Patient lab observations table
CREATE TABLE public.patient_lab_observations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  upload_id UUID NOT NULL REFERENCES public.patient_lab_uploads(id) ON DELETE CASCADE,
  raw_name TEXT NOT NULL,
  canonical_name TEXT NOT NULL,
  display_name TEXT,
  value NUMERIC NOT NULL,
  unit TEXT NOT NULL,
  ref_low NUMERIC,
  ref_high NUMERIC,
  flag TEXT CHECK (flag IN ('low', 'normal', 'high', 'critical')),
  collection_date DATE NOT NULL,
  source TEXT,
  corrected BOOLEAN NOT NULL DEFAULT false,
  original_value NUMERIC,
  corrected_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_plo_user_canonical ON public.patient_lab_observations (user_id, canonical_name);
CREATE INDEX idx_plo_user_collection ON public.patient_lab_observations (user_id, collection_date DESC);
CREATE INDEX idx_plo_upload ON public.patient_lab_observations (upload_id);

CREATE UNIQUE INDEX idx_plo_dedup ON public.patient_lab_observations 
  (user_id, canonical_name, value, unit, collection_date);

-- Row Level Security
ALTER TABLE public.patient_lab_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_lab_observations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own uploads" ON public.patient_lab_uploads
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own uploads" ON public.patient_lab_uploads
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own uploads" ON public.patient_lab_uploads
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own uploads" ON public.patient_lab_uploads
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can read own observations" ON public.patient_lab_observations
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own observations" ON public.patient_lab_observations
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own observations" ON public.patient_lab_observations
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert uploads" ON public.patient_lab_uploads
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Service role can update uploads" ON public.patient_lab_uploads
  FOR UPDATE USING (true);
CREATE POLICY "Service role can insert observations" ON public.patient_lab_observations
  FOR INSERT WITH CHECK (true);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_lab_upload_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER lab_upload_updated_at
  BEFORE UPDATE ON public.patient_lab_uploads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_lab_upload_timestamp();

-- Storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'lab-uploads',
  'lab-uploads',
  false,
  10485760,
  ARRAY['application/pdf']
);

CREATE POLICY "Users can upload to own folder"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'lab-uploads' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can read own lab files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'lab-uploads'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own lab files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'lab-uploads'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Service role can read any lab file"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'lab-uploads');