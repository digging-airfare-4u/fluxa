# ChatCanvas Storage Documentation

## Overview

ChatCanvas uses Supabase Storage to manage user assets including uploaded images, AI-generated images, and exported designs.

## Storage Bucket

### Configuration

- **Bucket Name**: `assets`
- **Visibility**: Private (requires authentication)
- **Max File Size**: 10MB
- **Allowed MIME Types**:
  - `image/png`
  - `image/jpeg`
  - `image/webp`
  - `image/gif`

## Path Format

All assets follow a strict path format:

```
{userId}/{projectId}/{assetId}.{ext}
```

### Components

| Component | Description | Format |
|-----------|-------------|--------|
| `userId` | The authenticated user's UUID | UUID v4 |
| `projectId` | The project's UUID | UUID v4 |
| `assetId` | The asset's UUID | UUID v4 |
| `ext` | File extension | `png`, `jpg`, `jpeg`, `webp`, `gif` |

### Example Paths

```
550e8400-e29b-41d4-a716-446655440000/6ba7b810-9dad-11d1-80b4-00c04fd430c8/f47ac10b-58cc-4372-a567-0e02b2c3d479.png
```

## Access Control

### Row Level Security (RLS)

Storage access is controlled by RLS policies that ensure:

1. **Upload**: Users can only upload to paths starting with their own `userId`
2. **Download**: Users can only download from paths starting with their own `userId`
3. **Update**: Users can only update files in their own folder
4. **Delete**: Users can only delete files in their own folder

### Cross-User Isolation

- Users cannot access files belonging to other users
- Path validation ensures the first segment matches `auth.uid()`
- Invalid paths are rejected at the policy level

## Signed URLs

For temporary access to assets (e.g., sharing, embedding), use signed URLs:

```typescript
const { data, error } = await supabase.storage
  .from('assets')
  .createSignedUrl(path, 3600); // 1 hour expiration

if (data) {
  console.log('Signed URL:', data.signedUrl);
}
```

### Configuration

- **Default Expiration**: 1 hour (3600 seconds)
- **Renewal**: Generate a new signed URL before expiration
- **Security**: Signed URLs bypass RLS but are time-limited

## Asset Types

Assets are categorized by their `type` field in the `assets` table:

| Type | Description | Source |
|------|-------------|--------|
| `upload` | User-uploaded files | Direct upload via UI |
| `generate` | AI-generated images | `generate-image` Edge Function |
| `export` | Exported designs | Export functionality |

## Usage Examples

### Upload an Asset

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function uploadAsset(
  file: File,
  userId: string,
  projectId: string,
  assetId: string
) {
  const ext = file.name.split('.').pop();
  const path = `${userId}/${projectId}/${assetId}.${ext}`;

  const { data, error } = await supabase.storage
    .from('assets')
    .upload(path, file, {
      contentType: file.type,
      upsert: false,
    });

  if (error) throw error;
  return data;
}
```

### Download an Asset

```typescript
async function downloadAsset(path: string) {
  const { data, error } = await supabase.storage
    .from('assets')
    .download(path);

  if (error) throw error;
  return data; // Blob
}
```

### Get Public URL (for authenticated users)

```typescript
async function getAssetUrl(path: string) {
  const { data } = supabase.storage
    .from('assets')
    .getPublicUrl(path);

  return data.publicUrl;
}
```

### Delete an Asset

```typescript
async function deleteAsset(path: string) {
  const { error } = await supabase.storage
    .from('assets')
    .remove([path]);

  if (error) throw error;
}
```

## Edge Function Access

Edge Functions using the `service_role` key have full access to storage, bypassing RLS policies. This is used for:

- AI image generation (writing generated images)
- Export functionality (writing exported PNGs)
- Asset cleanup jobs

```typescript
// In Edge Function
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

// Full access to storage
await supabase.storage.from('assets').upload(path, file);
```

## Best Practices

1. **Always validate paths** before upload/download operations
2. **Use signed URLs** for temporary sharing instead of making files public
3. **Clean up unused assets** to manage storage costs
4. **Set appropriate expiration** for signed URLs based on use case
5. **Handle errors gracefully** - storage operations can fail due to network issues


## Asset Lifecycle & Governance

### Asset Metadata Schema

Each asset's `metadata` JSONB column should follow this structure:

```typescript
interface AssetMetadata {
  source: {
    type: 'upload' | 'generate' | 'export';
    origin: 'user_upload' | 'ai_generation' | 'canvas_export';
    timestamp: string; // ISO8601
  };
  exif?: {
    width: number;
    height: number;
    format: string;
    colorSpace?: string;
    // ... other EXIF data
  };
  copyright: {
    status: 'unknown' | 'user_owned' | 'ai_generated' | 'licensed';
    license?: string;
    attribution?: string;
  };
  generation?: {
    model?: string;      // e.g., "dall-e-3"
    prompt?: string;
    parameters?: object;
    seed?: number;
  };
  scan: {
    status: 'pending' | 'passed' | 'flagged' | 'blocked';
    scannedAt?: string;  // ISO8601
    flags?: string[];
  };
}
```

### User Quotas

Each user has storage and asset count limits:

| Quota Type | Default Limit | Description |
|------------|---------------|-------------|
| Storage | 100 MB | Total storage used by all assets |
| Asset Count | 500 | Maximum number of assets |

#### Checking Quota

```typescript
// Check if user has quota for new upload
const { data, error } = await supabase.rpc('check_user_quota', {
  p_user_id: userId,
  p_file_size: fileSize,
});

if (!data) {
  throw new Error('Quota exceeded');
}
```

### Soft Delete

Assets support soft delete with automatic cleanup:

1. **Soft Delete**: Asset is marked as deleted but not removed
2. **Grace Period**: 30 days to restore
3. **Auto Cleanup**: Permanently deleted after grace period

```typescript
// Soft delete an asset
const { data } = await supabase.rpc('soft_delete_asset', {
  p_asset_id: assetId,
});

// Restore a soft-deleted asset
const { data } = await supabase.rpc('restore_asset', {
  p_asset_id: assetId,
});
```

### Security Scanning

Assets are scanned for safety and copyright issues:

| Scan Type | Description |
|-----------|-------------|
| `safety` | Content safety (NSFW, violence, etc.) |
| `copyright` | Copyright/trademark detection |
| `malware` | Malicious content detection |

#### Scan Status

| Status | Description |
|--------|-------------|
| `pending` | Awaiting scan |
| `passed` | Scan passed, asset is safe |
| `flagged` | Potential issues, requires review |
| `blocked` | Asset blocked from use |

**Blocked assets cannot be used in ops** - the system will reject any `addImage` op referencing a blocked asset.

### Ops Asset Validation

When creating an `addImage` op, the system validates:

1. Asset exists and belongs to the user
2. Asset is not soft-deleted
3. Asset is not blocked by security scan

```typescript
// This validation happens automatically via database trigger
// Invalid ops will be rejected with an error
```
