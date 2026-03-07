-- Inspiration Discovery: storage bucket/policies

BEGIN;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'public-assets',
  'public-assets',
  true,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public read public-assets" ON storage.objects;
CREATE POLICY "Public read public-assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'public-assets');

DROP POLICY IF EXISTS "Authenticated upload covers" ON storage.objects;
CREATE POLICY "Authenticated upload covers"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'public-assets'
    AND auth.uid() IS NOT NULL
    AND split_part(name, '/', 1) = 'covers'
  );

DROP POLICY IF EXISTS "Authenticated update covers" ON storage.objects;
CREATE POLICY "Authenticated update covers"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'public-assets'
    AND auth.uid() IS NOT NULL
    AND split_part(name, '/', 1) = 'covers'
  )
  WITH CHECK (
    bucket_id = 'public-assets'
    AND auth.uid() IS NOT NULL
    AND split_part(name, '/', 1) = 'covers'
  );

DROP POLICY IF EXISTS "Authenticated upload own avatar" ON storage.objects;
CREATE POLICY "Authenticated upload own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'public-assets'
    AND auth.uid() IS NOT NULL
    AND split_part(name, '/', 1) = 'avatars'
    AND split_part(split_part(name, '/', 2), '.', 1) = auth.uid()::text
  );

DROP POLICY IF EXISTS "Authenticated update own avatar" ON storage.objects;
CREATE POLICY "Authenticated update own avatar"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'public-assets'
    AND auth.uid() IS NOT NULL
    AND split_part(name, '/', 1) = 'avatars'
    AND split_part(split_part(name, '/', 2), '.', 1) = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'public-assets'
    AND auth.uid() IS NOT NULL
    AND split_part(name, '/', 1) = 'avatars'
    AND split_part(split_part(name, '/', 2), '.', 1) = auth.uid()::text
  );

DROP POLICY IF EXISTS "Authenticated delete own avatar" ON storage.objects;
CREATE POLICY "Authenticated delete own avatar"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'public-assets'
    AND auth.uid() IS NOT NULL
    AND split_part(name, '/', 1) = 'avatars'
    AND split_part(split_part(name, '/', 2), '.', 1) = auth.uid()::text
  );

DROP POLICY IF EXISTS "Authenticated delete covers" ON storage.objects;
CREATE POLICY "Authenticated delete covers"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'public-assets'
    AND auth.uid() IS NOT NULL
    AND split_part(name, '/', 1) = 'covers'
  );

COMMIT;
