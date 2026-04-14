
-- Allow admins to upload files to any user's folder in lab-uploads
CREATE POLICY "Admins can upload to any folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'lab-uploads'
  AND public.has_role(auth.uid(), 'admin')
);

-- Allow admins to read any lab file
CREATE POLICY "Admins can read any lab file"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'lab-uploads'
  AND public.has_role(auth.uid(), 'admin')
);

-- Allow admins to delete any lab file
CREATE POLICY "Admins can delete any lab file"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'lab-uploads'
  AND public.has_role(auth.uid(), 'admin')
);
