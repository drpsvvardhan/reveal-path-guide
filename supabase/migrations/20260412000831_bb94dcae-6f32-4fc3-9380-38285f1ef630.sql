-- Allow anon to look up profile by terrain_share_token
CREATE POLICY "Public can read profile by terrain_share_token"
ON public.profiles
FOR SELECT
TO anon, authenticated
USING (terrain_share_token IS NOT NULL);

-- Allow anon to read active terrain renders for users with a share token
CREATE POLICY "Public can read terrain renders via share token"
ON public.terrain_renders
FOR SELECT
TO anon, authenticated
USING (
  status = 'active'
  AND user_id IN (
    SELECT p.user_id FROM profiles p WHERE p.terrain_share_token IS NOT NULL
  )
);