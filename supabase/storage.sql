-- ChatCanvas Storage Configuration
-- This file defines the storage bucket and access policies
-- Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6

-- ============================================================================
-- Create Storage Bucket (Requirement 4.1)
-- ============================================================================

-- Create the assets bucket for storing user files
-- Note: This is typically done via Supabase Dashboard or CLI, but we document it here
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'assets',
  'assets',
  false,  -- Private bucket, requires authentication
  10485760,  -- 10MB max file size (Requirement 4.6)
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']::text[]  -- Allowed MIME types (Requirement 4.6)
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ============================================================================
-- Storage Path Format (Requirement 4.2)
-- Path format: {userId}/{projectId}/{assetId}.{ext}
-- ============================================================================

-- Helper function to extract user_id from storage path
CREATE OR REPLACE FUNCTION storage.get_user_id_from_path(path TEXT)
RETURNS UUID AS $$
BEGIN
  -- Path format: {userId}/{projectId}/{assetId}.{ext}
  -- Extract the first segment (userId)
  RETURN (string_to_array(path, '/'))[1]::UUID;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Helper function to validate storage path format
CREATE OR REPLACE FUNCTION storage.is_valid_asset_path(path TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  parts TEXT[];
BEGIN
  parts := string_to_array(path, '/');
  
  -- Must have exactly 3 parts: userId/projectId/filename
  IF array_length(parts, 1) != 3 THEN
    RETURN FALSE;
  END IF;
  
  -- First two parts must be valid UUIDs
  BEGIN
    PERFORM parts[1]::UUID;
    PERFORM parts[2]::UUID;
  EXCEPTION
    WHEN OTHERS THEN
      RETURN FALSE;
  END;
  
  -- Third part must have an extension
  IF parts[3] NOT LIKE '%.%' THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;


-- ============================================================================
-- Storage Access Policies
-- ============================================================================

-- Policy: Users can only upload to paths starting with their userId (Requirement 4.3)
CREATE POLICY "Users can upload to own folder"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'assets'
    AND storage.get_user_id_from_path(name) = auth.uid()
    AND storage.is_valid_asset_path(name)
  );

-- Policy: Users can only download from paths starting with their userId (Requirement 4.4)
CREATE POLICY "Users can download from own folder"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'assets'
    AND storage.get_user_id_from_path(name) = auth.uid()
  );

-- Policy: Users can update their own files
CREATE POLICY "Users can update own files"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'assets'
    AND storage.get_user_id_from_path(name) = auth.uid()
  )
  WITH CHECK (
    bucket_id = 'assets'
    AND storage.get_user_id_from_path(name) = auth.uid()
  );

-- Policy: Users can delete their own files
CREATE POLICY "Users can delete own files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'assets'
    AND storage.get_user_id_from_path(name) = auth.uid()
  );

-- ============================================================================
-- Signed URL Configuration (Requirement 4.5)
-- Default expiration: 1 hour (3600 seconds)
-- This is configured at the application level when generating signed URLs
-- ============================================================================

-- Note: Signed URL generation is done via Supabase client:
-- const { data } = await supabase.storage
--   .from('assets')
--   .createSignedUrl(path, 3600); // 1 hour expiration

-- ============================================================================
-- Service Role Access
-- Edge Functions using service_role key bypass storage policies
-- ============================================================================
