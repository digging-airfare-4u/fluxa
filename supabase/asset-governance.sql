-- ChatCanvas Asset Lifecycle & Quota Governance
-- This file defines asset metadata, quota management, soft delete, and cleanup
-- Requirements: 18.1, 18.2, 18.3, 18.4, 18.5

-- ============================================================================
-- Extended Asset Metadata (Requirement 18.1)
-- Track asset source, EXIF, copyright, and generation model info
-- ============================================================================

-- Add soft delete and extended metadata columns to assets table
ALTER TABLE assets 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Create index for soft delete queries
CREATE INDEX IF NOT EXISTS idx_assets_deleted_at ON assets(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_assets_expires_at ON assets(expires_at) WHERE expires_at IS NOT NULL;

-- Asset metadata schema documentation:
-- The metadata JSONB column should contain:
-- {
--   "source": {
--     "type": "upload" | "generate" | "export",
--     "origin": "user_upload" | "ai_generation" | "canvas_export",
--     "timestamp": "ISO8601 timestamp"
--   },
--   "exif": {
--     "width": number,
--     "height": number,
--     "format": string,
--     "colorSpace": string,
--     ... other EXIF data
--   },
--   "copyright": {
--     "status": "unknown" | "user_owned" | "ai_generated" | "licensed",
--     "license": string | null,
--     "attribution": string | null
--   },
--   "generation": {
--     "model": string | null,  -- e.g., "dall-e-3", "stable-diffusion-xl"
--     "prompt": string | null,
--     "parameters": object | null,
--     "seed": number | null
--   },
--   "scan": {
--     "status": "pending" | "passed" | "flagged" | "blocked",
--     "scannedAt": "ISO8601 timestamp" | null,
--     "flags": string[] | null
--   }
-- }

-- ============================================================================
-- User Quota Configuration (Requirement 18.3)
-- ============================================================================

-- Create user_quotas table for tracking storage usage
CREATE TABLE IF NOT EXISTS user_quotas (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_used_bytes BIGINT DEFAULT 0,
  storage_limit_bytes BIGINT DEFAULT 104857600,  -- 100MB default limit
  asset_count INTEGER DEFAULT 0,
  asset_limit INTEGER DEFAULT 500,  -- 500 assets default limit
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on user_quotas
ALTER TABLE user_quotas ENABLE ROW LEVEL SECURITY;

-- Users can only view their own quota
CREATE POLICY "Users can view own quota"
  ON user_quotas FOR SELECT
  USING (user_id = auth.uid());

-- Only system can update quotas (via service role)
CREATE POLICY "System can manage quotas"
  ON user_quotas FOR ALL
  USING (auth.role() = 'service_role');


-- ============================================================================
-- Quota Check Functions (Requirement 18.3)
-- ============================================================================

-- Function to check if user has quota for new asset
CREATE OR REPLACE FUNCTION check_user_quota(
  p_user_id UUID,
  p_file_size BIGINT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_quota user_quotas%ROWTYPE;
BEGIN
  -- Get or create user quota record
  SELECT * INTO v_quota FROM user_quotas WHERE user_id = p_user_id;
  
  IF NOT FOUND THEN
    -- Create default quota for new user
    INSERT INTO user_quotas (user_id) VALUES (p_user_id)
    RETURNING * INTO v_quota;
  END IF;
  
  -- Check storage limit
  IF v_quota.storage_used_bytes + p_file_size > v_quota.storage_limit_bytes THEN
    RETURN FALSE;
  END IF;
  
  -- Check asset count limit
  IF v_quota.asset_count >= v_quota.asset_limit THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update user quota after asset creation
CREATE OR REPLACE FUNCTION update_user_quota_on_asset_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- Update quota
  INSERT INTO user_quotas (user_id, storage_used_bytes, asset_count)
  VALUES (NEW.user_id, COALESCE(NEW.size_bytes, 0), 1)
  ON CONFLICT (user_id) DO UPDATE SET
    storage_used_bytes = user_quotas.storage_used_bytes + COALESCE(NEW.size_bytes, 0),
    asset_count = user_quotas.asset_count + 1,
    updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update user quota after asset deletion
CREATE OR REPLACE FUNCTION update_user_quota_on_asset_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- Update quota (only if not soft deleted)
  IF OLD.deleted_at IS NULL THEN
    UPDATE user_quotas SET
      storage_used_bytes = GREATEST(0, storage_used_bytes - COALESCE(OLD.size_bytes, 0)),
      asset_count = GREATEST(0, asset_count - 1),
      updated_at = NOW()
    WHERE user_id = OLD.user_id;
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers for quota management
DROP TRIGGER IF EXISTS trigger_update_quota_on_asset_insert ON assets;
CREATE TRIGGER trigger_update_quota_on_asset_insert
  AFTER INSERT ON assets
  FOR EACH ROW
  EXECUTE FUNCTION update_user_quota_on_asset_insert();

DROP TRIGGER IF EXISTS trigger_update_quota_on_asset_delete ON assets;
CREATE TRIGGER trigger_update_quota_on_asset_delete
  AFTER DELETE ON assets
  FOR EACH ROW
  EXECUTE FUNCTION update_user_quota_on_asset_delete();


-- ============================================================================
-- Soft Delete Functions (Requirement 18.3)
-- ============================================================================

-- Function to soft delete an asset
CREATE OR REPLACE FUNCTION soft_delete_asset(p_asset_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_asset assets%ROWTYPE;
BEGIN
  -- Get asset and verify ownership
  SELECT * INTO v_asset FROM assets 
  WHERE id = p_asset_id AND user_id = auth.uid() AND deleted_at IS NULL;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Mark as soft deleted
  UPDATE assets SET 
    deleted_at = NOW(),
    expires_at = NOW() + INTERVAL '30 days'  -- Auto-cleanup after 30 days
  WHERE id = p_asset_id;
  
  -- Update quota (reduce used storage)
  UPDATE user_quotas SET
    storage_used_bytes = GREATEST(0, storage_used_bytes - COALESCE(v_asset.size_bytes, 0)),
    asset_count = GREATEST(0, asset_count - 1),
    updated_at = NOW()
  WHERE user_id = v_asset.user_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to restore a soft-deleted asset
CREATE OR REPLACE FUNCTION restore_asset(p_asset_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_asset assets%ROWTYPE;
BEGIN
  -- Get soft-deleted asset and verify ownership
  SELECT * INTO v_asset FROM assets 
  WHERE id = p_asset_id AND user_id = auth.uid() AND deleted_at IS NOT NULL;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Check quota before restore
  IF NOT check_user_quota(v_asset.user_id, COALESCE(v_asset.size_bytes, 0)) THEN
    RETURN FALSE;
  END IF;
  
  -- Restore asset
  UPDATE assets SET 
    deleted_at = NULL,
    expires_at = NULL
  WHERE id = p_asset_id;
  
  -- Update quota (add back storage)
  UPDATE user_quotas SET
    storage_used_bytes = storage_used_bytes + COALESCE(v_asset.size_bytes, 0),
    asset_count = asset_count + 1,
    updated_at = NOW()
  WHERE user_id = v_asset.user_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Cleanup Job (Requirement 18.3)
-- Run periodically to permanently delete expired soft-deleted assets
-- ============================================================================

-- Function to cleanup expired assets (called by scheduled job)
CREATE OR REPLACE FUNCTION cleanup_expired_assets()
RETURNS INTEGER AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  -- Delete expired assets from storage (this should be done via Edge Function)
  -- Here we just mark them for deletion and return the count
  
  WITH deleted AS (
    DELETE FROM assets
    WHERE deleted_at IS NOT NULL 
      AND expires_at IS NOT NULL 
      AND expires_at < NOW()
    RETURNING id
  )
  SELECT COUNT(*) INTO v_deleted_count FROM deleted;
  
  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- Signed URL Renewal (Requirement 18.4)
-- Configuration for signed URL expiration and renewal
-- ============================================================================

-- Signed URL configuration is handled at the application level
-- Default expiration: 1 hour (3600 seconds)
-- Renewal: Generate new signed URL before expiration

-- Function to validate asset access for signed URL generation
CREATE OR REPLACE FUNCTION can_generate_signed_url(p_asset_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM assets 
    WHERE id = p_asset_id 
      AND user_id = auth.uid()
      AND deleted_at IS NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Security/Copyright Scan Hooks (Requirement 18.5)
-- Placeholder for content scanning integration
-- ============================================================================

-- Asset scan status table for tracking scan results
CREATE TABLE IF NOT EXISTS asset_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  scan_type TEXT NOT NULL CHECK (scan_type IN ('safety', 'copyright', 'malware')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'passed', 'flagged', 'blocked')),
  result JSONB,
  scanned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for scan lookups
CREATE INDEX IF NOT EXISTS idx_asset_scans_asset_id ON asset_scans(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_scans_status ON asset_scans(status);

-- Enable RLS on asset_scans
ALTER TABLE asset_scans ENABLE ROW LEVEL SECURITY;

-- Users can view scans for their own assets
CREATE POLICY "Users can view own asset scans"
  ON asset_scans FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM assets 
      WHERE assets.id = asset_scans.asset_id 
        AND assets.user_id = auth.uid()
    )
  );

-- Only system can create/update scans
CREATE POLICY "System can manage asset scans"
  ON asset_scans FOR ALL
  USING (auth.role() = 'service_role');

-- Function to check if asset is blocked (for ops validation)
CREATE OR REPLACE FUNCTION is_asset_blocked(p_asset_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM asset_scans 
    WHERE asset_id = p_asset_id 
      AND status = 'blocked'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate asset before adding to ops (Requirement 18.2, 18.5)
-- Returns TRUE if asset is valid and can be used in ops
CREATE OR REPLACE FUNCTION validate_asset_for_ops(
  p_asset_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_asset assets%ROWTYPE;
BEGIN
  -- Check asset exists and belongs to user
  SELECT * INTO v_asset FROM assets 
  WHERE id = p_asset_id 
    AND user_id = p_user_id
    AND deleted_at IS NULL;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Check if asset is blocked by security scan
  IF is_asset_blocked(p_asset_id) THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Ops Validation Trigger (Requirement 18.2)
-- Ensure addImage ops only reference valid, accessible assets
-- ============================================================================

-- Function to validate ops before insert
CREATE OR REPLACE FUNCTION validate_ops_asset_references()
RETURNS TRIGGER AS $$
DECLARE
  v_src TEXT;
  v_asset_id UUID;
  v_user_id UUID;
BEGIN
  -- Only validate addImage ops
  IF NEW.op_type != 'addImage' THEN
    RETURN NEW;
  END IF;
  
  -- Get the src from payload
  v_src := NEW.payload->>'src';
  
  -- Skip validation for external URLs (http/https)
  IF v_src LIKE 'http%' THEN
    RETURN NEW;
  END IF;
  
  -- For storage paths, extract asset_id and validate
  -- Path format: {userId}/{projectId}/{assetId}.{ext}
  BEGIN
    -- Extract asset_id from path (third segment without extension)
    v_asset_id := (regexp_match(v_src, '[^/]+/[^/]+/([^.]+)'))[1]::UUID;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE EXCEPTION 'Invalid asset path format: %', v_src;
  END;
  
  -- Get user_id from document owner
  SELECT p.user_id INTO v_user_id
  FROM documents d
  JOIN projects p ON d.project_id = p.id
  WHERE d.id = NEW.document_id;
  
  -- Validate asset
  IF NOT validate_asset_for_ops(v_asset_id, v_user_id) THEN
    RAISE EXCEPTION 'Asset not accessible or blocked: %', v_asset_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to validate ops asset references
DROP TRIGGER IF EXISTS trigger_validate_ops_assets ON ops;
CREATE TRIGGER trigger_validate_ops_assets
  BEFORE INSERT ON ops
  FOR EACH ROW
  EXECUTE FUNCTION validate_ops_asset_references();
