# Fluxa Storage Documentation

## Overview

Fluxa uses **Tencent Cloud COS** (Cloud Object Storage) via S3-compatible API to manage user assets including uploaded images, AI-generated images, and exported designs. Asset metadata is stored in Supabase PostgreSQL.

## Storage Configuration

### Tencent Cloud COS

| Setting | Value |
|---------|-------|
| **Bucket** | `fluxa-1390058464` |
| **Region** | `ap-tokyo` |
| **Endpoint** | `https://cos.ap-tokyo.myqcloud.com` |
| **Public URL** | `https://fluxa-1390058464.cos.ap-tokyo.myqcloud.com` |
| **Protocol** | S3-compatible API |

### Environment Variables

**Edge Functions (Supabase Secrets):**
```
COS_SECRET_ID=your_tencent_cloud_secret_id
COS_SECRET_KEY=your_tencent_cloud_secret_key
COS_BUCKET=fluxa-1390058464
COS_REGION=ap-tokyo
```

**Frontend (.env):**
```
NEXT_PUBLIC_COS_BUCKET=fluxa-1390058464
NEXT_PUBLIC_COS_REGION=ap-tokyo
```

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

Access control is handled at two levels:

1. **COS Bucket Policy**: Bucket is configured for public read access
2. **Supabase RLS**: Asset metadata in `assets` table is protected by Row Level Security

### Path-based Isolation

- Path format ensures user isolation: `{userId}/{projectId}/{assetId}.{ext}`
- Users can only see their own assets via Supabase RLS on the `assets` table
- Direct COS URLs are public but unpredictable (UUID-based paths)

## Asset Types

Assets are categorized by their `type` field in the `assets` table:

| Type | Description | Source |
|------|-------------|--------|
| `upload` | User-uploaded files | Direct upload via UI |
| `generate` | AI-generated images | `generate-image` Edge Function |
| `export` | Exported designs | Export functionality |

## Usage Examples

### Upload an Asset (Edge Function)

```typescript
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const cosClient = new S3Client({
  region: 'ap-tokyo',
  endpoint: 'https://cos.ap-tokyo.myqcloud.com',
  credentials: {
    accessKeyId: Deno.env.get('COS_SECRET_ID')!,
    secretAccessKey: Deno.env.get('COS_SECRET_KEY')!,
  },
});

async function uploadAsset(
  imageData: ArrayBuffer,
  storagePath: string,
  contentType: string
) {
  const command = new PutObjectCommand({
    Bucket: 'fluxa-1390058464',
    Key: storagePath,
    Body: new Uint8Array(imageData),
    ContentType: contentType,
  });
  await cosClient.send(command);
}
```

### Get Public URL (Frontend)

```typescript
const COS_PUBLIC_URL = 'https://fluxa-1390058464.cos.ap-tokyo.myqcloud.com';

function getAssetUrl(storagePath: string): string {
  return `${COS_PUBLIC_URL}/${storagePath}`;
}
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
