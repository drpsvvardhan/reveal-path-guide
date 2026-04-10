-- Update storage bucket to allow images alongside PDFs and increase size limit to 20MB
UPDATE storage.buckets 
SET file_size_limit = 20971520,
    allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']::text[]
WHERE id = 'lab-uploads';
