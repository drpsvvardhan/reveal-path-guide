UPDATE derived_patterns 
SET status = 'dismissed', dismissed_at = now() 
WHERE id IN (
  '1224ee27-86d9-43cc-a964-a1b3fb51993c',
  '0c00b5e5-06d4-44f3-9348-2875a8faaa55',
  '62b2dcb6-99a8-48c9-8a5c-106ab14fba7a',
  '8862a4d8-7b9e-4187-a765-c34da2eeec76',
  '618d6583-0366-4aaa-8225-5d1da0c7f6ae'
);