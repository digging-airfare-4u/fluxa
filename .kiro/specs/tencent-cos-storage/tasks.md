# Implementation Plan: Tencent COS Storage Migration

## Overview

This plan implements the migration from Supabase Storage to Tencent Cloud COS for new uploads. The implementation uses COS REST API directly (no SDK) since Edge Functions run on Deno runtime. Existing assets remain on Supabase Storage.

## Tasks

- [ ] 1. Database schema update
  - [ ] 1.1 Add storage_provider column to assets table
    - Add column with default 'supabase' for existing records
    - Add CHECK constraint for valid values ('supabase', 'cos')
    - Execute via Supabase MCP
    - _Requirements: 6.4_

- [ ] 2. Implement COS signature generation
  - [ ] 2.1 Create SignatureGenerator class
    - Create `supabase/functions/_shared/cos/signature.ts`
    - Implement HMAC-SHA1 signature algorithm per Tencent COS spec
    - Generate q-sign-algorithm, q-ak, q-sign-time, q-key-time, q-header-list, q-url-param-list, q-signature
    - _Requirements: 2.1, 2.2, 2.3_
  
  - [ ] 2.2 Write property test for signature format
    - **Property 4: Signature Format Validation**
    - **Validates: Requirements 2.2, 2.3**

- [ ] 3. Implement COSClient
  - [ ] 3.1 Create COSClient class
    - Create `supabase/functions/_shared/cos/client.ts`
    - Implement config loading from environment variables
    - Implement upload method using fetch with PUT request
    - Implement getPublicUrl method
    - _Requirements: 1.1, 3.1, 3.2, 3.3, 4.1_
  
  - [ ] 3.2 Create COSError class
    - Create `supabase/functions/_shared/cos/errors.ts`
    - Define error codes: COS_AUTH_FAILED, COS_BUCKET_NOT_FOUND, COS_SERVER_ERROR, COS_NETWORK_ERROR, COS_CONFIG_ERROR
    - Implement XML error response parsing
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  
  - [ ] 3.3 Write property tests for COSClient
    - **Property 1: Configuration Loading**
    - **Property 2: Missing Configuration Error**
    - **Property 5: COS URL Construction**
    - **Validates: Requirements 1.1, 1.2, 3.1, 4.1, 4.4**

- [ ] 4. Checkpoint - Verify COS module
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Update AssetService
  - [ ] 5.1 Modify AssetService to use COSClient
    - Update constructor to accept COSClient instead of supabaseUrl
    - Update uploadImage to use COSClient.upload
    - Update getPublicUrl to delegate to COSClient
    - Set storage_provider='cos' in asset record insert
    - _Requirements: 3.4, 3.5, 3.6, 3.7_
  
  - [ ] 5.2 Update Edge Functions to instantiate COSClient
    - Update `supabase/functions/generate-image/index.ts`
    - Update any other functions using AssetService
    - Load COS config from Deno.env
    - _Requirements: 1.1_
  
  - [ ] 5.3 Write property tests for AssetService
    - **Property 3: Credentials Not Exposed**
    - **Property 7: Storage Path Format**
    - **Property 8: Upload Creates Record**
    - **Property 9: Upload Error Handling**
    - **Validates: Requirements 1.3, 3.4, 3.5, 3.6, 3.7, 5.5**

- [ ] 6. Update frontend URL generation
  - [ ] 6.1 Update assets.ts query
    - Add NEXT_PUBLIC_COS_BUCKET and NEXT_PUBLIC_COS_REGION env vars
    - Implement getAssetUrl function that checks storage_provider
    - Update fetchProjectAssets to use getAssetUrl
    - _Requirements: 4.2, 4.3, 6.1, 6.2, 6.3_
  
  - [ ] 6.2 Write property tests for URL generation
    - **Property 11: URL Generation by Storage Provider**
    - **Validates: Requirements 6.1, 6.2, 6.3**

- [ ] 7. Checkpoint - Verify integration
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Create barrel exports and types
  - [ ] 8.1 Create COS module index
    - Create `supabase/functions/_shared/cos/index.ts`
    - Export COSClient, SignatureGenerator, COSError, types
    - _Requirements: N/A (code organization)_
  
  - [ ] 8.2 Update shared types
    - Update AssetRecord type to include storageProvider field
    - _Requirements: 6.4_

- [ ] 9. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- All tasks including property tests are required
- COS credentials must be configured in Supabase Edge Function Secrets before testing
- Frontend env vars must be added to `.env` and Vercel environment
- Existing assets (~50 files) will continue to work via Supabase Storage URLs
