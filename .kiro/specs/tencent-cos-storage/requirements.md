# Requirements Document

## Introduction

This document specifies the requirements for migrating Fluxa's storage backend from Supabase Storage to Tencent Cloud COS (Cloud Object Storage). The migration affects AI-generated images and user uploads, requiring updates to Edge Functions (Deno runtime) and frontend URL generation logic. Existing data (~50 files, 51MB) will remain on Supabase Storage and does not require migration.

## Glossary

- **COS**: Tencent Cloud Object Storage - a distributed storage service for unstructured data
- **Asset_Service**: The Edge Function service responsible for uploading images and creating asset records
- **Storage_Path**: The file path format used to store assets: `{userId}/{projectId}/{assetId}.{ext}`
- **COS_Signature**: HMAC-SHA1 based authorization signature required for COS REST API requests
- **Edge_Function**: Supabase serverless function running on Deno runtime
- **Asset_Record**: Database record in the `assets` table containing metadata about stored files

## Requirements

### Requirement 1: COS Configuration

**User Story:** As a system administrator, I want to configure Tencent COS credentials, so that Edge Functions can authenticate with the COS service.

#### Acceptance Criteria

1. THE Edge_Function SHALL read COS credentials from environment variables: `COS_SECRET_ID`, `COS_SECRET_KEY`, `COS_BUCKET`, and `COS_REGION`
2. WHEN any required COS environment variable is missing, THE Edge_Function SHALL throw a configuration error with a descriptive message
3. THE Edge_Function SHALL NOT expose COS credentials in logs or error responses

### Requirement 2: COS Signature Generation

**User Story:** As a developer, I want the system to generate valid COS authorization signatures, so that upload requests are authenticated.

#### Acceptance Criteria

1. WHEN uploading to COS, THE Asset_Service SHALL generate an Authorization header using HMAC-SHA1 signature algorithm
2. THE COS_Signature SHALL include: HTTP method, content-MD5 (optional), content-type, date, and canonicalized resource path
3. THE COS_Signature SHALL use the format: `q-sign-algorithm=sha1&q-ak={SecretId}&q-sign-time={KeyTime}&q-key-time={KeyTime}&q-header-list={HeaderList}&q-url-param-list={UrlParamList}&q-signature={Signature}`
4. FOR ALL valid upload requests, generating a signature then using it for upload SHALL result in successful authentication (round-trip property)

### Requirement 3: Image Upload to COS

**User Story:** As a user, I want my generated images to be stored on Tencent COS, so that they are reliably persisted.

#### Acceptance Criteria

1. WHEN uploading an image, THE Asset_Service SHALL send a PUT request to `https://{bucket}.cos.{region}.myqcloud.com/{storagePath}`
2. THE Asset_Service SHALL include the `Content-Type` header matching the image MIME type
3. THE Asset_Service SHALL include the `Authorization` header with a valid COS_Signature
4. THE Asset_Service SHALL maintain the existing Storage_Path format: `{userId}/{projectId}/{assetId}.{ext}`
5. WHEN the COS upload succeeds, THE Asset_Service SHALL create an Asset_Record in the database
6. WHEN the COS upload fails, THE Asset_Service SHALL throw an AssetError with the failure reason
7. IF the COS service returns a non-2xx status, THEN THE Asset_Service SHALL parse the error response and include it in the thrown error

### Requirement 4: Public URL Generation

**User Story:** As a user, I want to access my stored images via public URLs, so that they display correctly in the application.

#### Acceptance Criteria

1. THE Asset_Service SHALL generate public URLs in the format: `https://{bucket}.cos.{region}.myqcloud.com/{storagePath}`
2. WHEN fetching project assets, THE Frontend_Query SHALL construct URLs using the COS URL format
3. THE Frontend_Query SHALL read COS bucket and region from environment variables: `NEXT_PUBLIC_COS_BUCKET` and `NEXT_PUBLIC_COS_REGION`
4. FOR ALL valid storage paths, the generated URL SHALL be a valid HTTPS URL pointing to the COS object

### Requirement 5: Error Handling

**User Story:** As a developer, I want clear error messages when COS operations fail, so that I can diagnose and fix issues.

#### Acceptance Criteria

1. WHEN COS returns an authentication error (403), THE Asset_Service SHALL throw an AssetError with code `COS_AUTH_FAILED`
2. WHEN COS returns a not found error (404), THE Asset_Service SHALL throw an AssetError with code `COS_BUCKET_NOT_FOUND`
3. WHEN COS returns a server error (5xx), THE Asset_Service SHALL throw an AssetError with code `COS_SERVER_ERROR`
4. WHEN network connection to COS fails, THE Asset_Service SHALL throw an AssetError with code `COS_NETWORK_ERROR`
5. THE Asset_Service SHALL log COS errors with request details for debugging (excluding credentials)

### Requirement 6: Backward Compatibility

**User Story:** As a user with existing assets, I want my old images to remain accessible, so that my projects continue to work.

#### Acceptance Criteria

1. THE Frontend_Query SHALL detect whether an asset uses Supabase Storage or COS based on the `storage_path` or a new `storage_provider` field
2. WHEN an asset was uploaded before the migration, THE Frontend_Query SHALL generate a Supabase Storage URL
3. WHEN an asset was uploaded after the migration, THE Frontend_Query SHALL generate a COS URL
4. THE Asset_Record SHALL include a `storage_provider` field with value `supabase` or `cos` to indicate the storage backend
