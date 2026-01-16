/**
 * Feature: image-generation-refactor
 * Checkpoint 2: Verify Basic Modules
 * Validates: Requirements 7.1, 7.2, 7.3, 7.4, 9.1, 9.2
 *
 * Verifies that the shared types and error handling modules are correctly
 * implemented and can be imported and used.
 */

import { describe, it, expect } from 'vitest';

// Import types
import {
  RESOLUTION_PRESETS,
  SUPPORTED_ASPECT_RATIOS,
  isValidAspectRatio,
  isValidResolution,
  isValidJobStatus,
  type ResolutionPreset,
  type AspectRatio,
  type ImageGenerateRequest,
  type ImageGenerateResponse,
  type JobOutput,
  type JobStatus,
  type Job,
  type DeductPointsResult,
  type AuthenticatedUser,
  type UserMembership,
  type AssetRecord,
} from '../../supabase/functions/_shared/types/index';

// Import errors
import {
  ERROR_CODES,
  AppError,
  ValidationError,
  AuthError,
  ProviderError,
  InsufficientPointsError,
  PointsError,
  AssetError,
  JobError,
  InternalError,
  errorToResponse,
  isAppError,
  isValidationError,
  isAuthError,
  isProviderError,
  isInsufficientPointsError,
} from '../../supabase/functions/_shared/errors/index';

// ============================================================================
// Types Module Verification
// ============================================================================

describe('Types Module Verification', () => {
  describe('Resolution Presets', () => {
    it('should define all resolution presets', () => {
      expect(RESOLUTION_PRESETS['1K']).toBe(1024);
      expect(RESOLUTION_PRESETS['2K']).toBe(2048);
      expect(RESOLUTION_PRESETS['4K']).toBe(4096);
    });

    it('should validate resolution presets correctly', () => {
      expect(isValidResolution('1K')).toBe(true);
      expect(isValidResolution('2K')).toBe(true);
      expect(isValidResolution('4K')).toBe(true);
      expect(isValidResolution('8K')).toBe(false);
      expect(isValidResolution('')).toBe(false);
      expect(isValidResolution(null)).toBe(false);
      expect(isValidResolution(undefined)).toBe(false);
    });
  });

  describe('Aspect Ratios', () => {
    it('should define all supported aspect ratios', () => {
      expect(SUPPORTED_ASPECT_RATIOS).toContain('1:1');
      expect(SUPPORTED_ASPECT_RATIOS).toContain('16:9');
      expect(SUPPORTED_ASPECT_RATIOS).toContain('9:16');
      expect(SUPPORTED_ASPECT_RATIOS).toContain('4:3');
      expect(SUPPORTED_ASPECT_RATIOS).toContain('3:4');
      expect(SUPPORTED_ASPECT_RATIOS.length).toBe(10);
    });

    it('should validate aspect ratios correctly', () => {
      expect(isValidAspectRatio('1:1')).toBe(true);
      expect(isValidAspectRatio('16:9')).toBe(true);
      expect(isValidAspectRatio('invalid')).toBe(false);
      expect(isValidAspectRatio('')).toBe(false);
      expect(isValidAspectRatio(null)).toBe(false);
    });
  });

  describe('Job Status', () => {
    it('should validate job status correctly', () => {
      expect(isValidJobStatus('queued')).toBe(true);
      expect(isValidJobStatus('processing')).toBe(true);
      expect(isValidJobStatus('done')).toBe(true);
      expect(isValidJobStatus('failed')).toBe(true);
      expect(isValidJobStatus('pending')).toBe(false);
      expect(isValidJobStatus('')).toBe(false);
    });
  });

  describe('Type Structures', () => {
    it('should allow creating valid ImageGenerateRequest', () => {
      const request: ImageGenerateRequest = {
        projectId: 'proj-123',
        documentId: 'doc-456',
        prompt: 'Generate a beautiful sunset',
        model: 'gemini-2.5-flash-image',
        width: 1024,
        height: 1024,
        aspectRatio: '16:9',
        resolution: '2K',
      };
      expect(request.projectId).toBe('proj-123');
      expect(request.aspectRatio).toBe('16:9');
    });

    it('should allow creating valid ImageGenerateResponse', () => {
      const response: ImageGenerateResponse = {
        jobId: 'job-789',
        pointsDeducted: 30,
        remainingPoints: 970,
        modelUsed: 'gemini-2.5-flash-image',
      };
      expect(response.jobId).toBe('job-789');
      expect(response.pointsDeducted).toBe(30);
    });

    it('should allow creating valid JobOutput', () => {
      const output: JobOutput = {
        assetId: 'asset-123',
        storagePath: 'user/project/asset.png',
        publicUrl: 'https://example.com/storage/asset.png',
        layerId: 'layer-abc123',
        op: {
          type: 'addImage',
          payload: {
            id: 'layer-abc123',
            src: 'https://example.com/storage/asset.png',
            x: 100,
            y: 100,
            width: 512,
            height: 512,
          },
        },
        model: 'gemini-2.5-flash-image',
        resolution: '2K',
        aspectRatio: '1:1',
      };
      expect(output.assetId).toBe('asset-123');
      expect(output.op.type).toBe('addImage');
    });
  });
});

// ============================================================================
// Errors Module Verification
// ============================================================================

describe('Errors Module Verification', () => {
  describe('Error Codes', () => {
    it('should define all required error codes', () => {
      expect(ERROR_CODES.INVALID_REQUEST).toBe('INVALID_REQUEST');
      expect(ERROR_CODES.UNAUTHORIZED).toBe('UNAUTHORIZED');
      expect(ERROR_CODES.INSUFFICIENT_POINTS).toBe('INSUFFICIENT_POINTS');
      expect(ERROR_CODES.PROVIDER_ERROR).toBe('PROVIDER_ERROR');
      expect(ERROR_CODES.INTERNAL_ERROR).toBe('INTERNAL_ERROR');
    });
  });

  describe('ValidationError', () => {
    it('should create ValidationError with correct properties', () => {
      const error = new ValidationError('Invalid input', ['field1 is required', 'field2 must be a number']);
      
      expect(error.message).toBe('Invalid input');
      expect(error.code).toBe('INVALID_REQUEST');
      expect(error.statusCode).toBe(400);
      expect(error.fieldErrors).toEqual(['field1 is required', 'field2 must be a number']);
      expect(error.name).toBe('ValidationError');
    });

    it('should serialize to JSON correctly', () => {
      const error = new ValidationError('Invalid input', ['field1 is required']);
      const json = error.toJSON();
      
      expect(json.code).toBe('INVALID_REQUEST');
      expect(json.message).toBe('Invalid input');
      expect(json.field_errors).toEqual(['field1 is required']);
    });
  });

  describe('AuthError', () => {
    it('should create AuthError with default code', () => {
      const error = new AuthError('Not authenticated');
      
      expect(error.message).toBe('Not authenticated');
      expect(error.code).toBe('UNAUTHORIZED');
      expect(error.statusCode).toBe(401);
    });

    it('should create AuthError with custom code', () => {
      const error = new AuthError('Missing token', 'MISSING_AUTH');
      
      expect(error.code).toBe('MISSING_AUTH');
    });
  });

  describe('ProviderError', () => {
    it('should create ProviderError with provider code', () => {
      const error = new ProviderError('API failed', 'API_ERROR', { response: 'timeout' });
      
      expect(error.message).toBe('API failed');
      expect(error.code).toBe('PROVIDER_ERROR');
      expect(error.statusCode).toBe(502);
      expect(error.providerCode).toBe('API_ERROR');
    });

    it('should serialize to JSON with provider code', () => {
      const error = new ProviderError('API failed', 'API_ERROR');
      const json = error.toJSON();
      
      expect(json.provider_code).toBe('API_ERROR');
    });
  });

  describe('InsufficientPointsError', () => {
    it('should create InsufficientPointsError with balance details', () => {
      const error = new InsufficientPointsError(10, 30, 'gemini-2.5-flash-image');
      
      expect(error.currentBalance).toBe(10);
      expect(error.requiredPoints).toBe(30);
      expect(error.modelName).toBe('gemini-2.5-flash-image');
      expect(error.code).toBe('INSUFFICIENT_POINTS');
      expect(error.statusCode).toBe(402);
    });

    it('should serialize to JSON with balance details', () => {
      const error = new InsufficientPointsError(10, 30, 'gemini-2.5-flash-image');
      const json = error.toJSON();
      
      expect(json.current_balance).toBe(10);
      expect(json.required_points).toBe(30);
      expect(json.model_name).toBe('gemini-2.5-flash-image');
    });
  });

  describe('Other Error Classes', () => {
    it('should create PointsError', () => {
      const error = new PointsError('Deduction failed', 'DEDUCTION_FAILED');
      expect(error.code).toBe('DEDUCTION_FAILED');
      expect(error.statusCode).toBe(500);
    });

    it('should create AssetError', () => {
      const error = new AssetError('Upload failed', 'UPLOAD_FAILED');
      expect(error.code).toBe('UPLOAD_FAILED');
      expect(error.statusCode).toBe(500);
    });

    it('should create JobError', () => {
      const error = new JobError('Job creation failed', 'CREATE_FAILED');
      expect(error.code).toBe('CREATE_FAILED');
      expect(error.statusCode).toBe(500);
    });

    it('should create InternalError', () => {
      const error = new InternalError('Something went wrong');
      expect(error.code).toBe('INTERNAL_ERROR');
      expect(error.statusCode).toBe(500);
    });
  });

  describe('errorToResponse', () => {
    it('should convert ValidationError to Response', () => {
      const error = new ValidationError('Invalid input', ['field1 is required']);
      const response = errorToResponse(error, { 'Access-Control-Allow-Origin': '*' });
      
      expect(response.status).toBe(400);
      expect(response.headers.get('Content-Type')).toBe('application/json');
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });

    it('should convert AuthError to Response', () => {
      const error = new AuthError('Unauthorized');
      const response = errorToResponse(error);
      
      expect(response.status).toBe(401);
    });

    it('should convert InsufficientPointsError to Response', () => {
      const error = new InsufficientPointsError(10, 30, 'model');
      const response = errorToResponse(error);
      
      expect(response.status).toBe(402);
    });

    it('should convert ProviderError to Response', () => {
      const error = new ProviderError('API failed');
      const response = errorToResponse(error);
      
      expect(response.status).toBe(502);
    });

    it('should convert InternalError to Response', () => {
      const error = new InternalError();
      const response = errorToResponse(error);
      
      expect(response.status).toBe(500);
    });

    it('should convert unknown errors to 500 Response', () => {
      const error = new Error('Unknown error');
      const response = errorToResponse(error);
      
      expect(response.status).toBe(500);
    });

    it('should handle non-Error objects', () => {
      const response = errorToResponse('string error');
      
      expect(response.status).toBe(500);
    });
  });

  describe('Type Guards', () => {
    it('should identify AppError instances', () => {
      expect(isAppError(new ValidationError('test'))).toBe(true);
      expect(isAppError(new AuthError('test'))).toBe(true);
      expect(isAppError(new Error('test'))).toBe(false);
      expect(isAppError('string')).toBe(false);
    });

    it('should identify ValidationError instances', () => {
      expect(isValidationError(new ValidationError('test'))).toBe(true);
      expect(isValidationError(new AuthError('test'))).toBe(false);
    });

    it('should identify AuthError instances', () => {
      expect(isAuthError(new AuthError('test'))).toBe(true);
      expect(isAuthError(new ValidationError('test'))).toBe(false);
    });

    it('should identify ProviderError instances', () => {
      expect(isProviderError(new ProviderError('test'))).toBe(true);
      expect(isProviderError(new AuthError('test'))).toBe(false);
    });

    it('should identify InsufficientPointsError instances', () => {
      expect(isInsufficientPointsError(new InsufficientPointsError(0, 10, 'model'))).toBe(true);
      expect(isInsufficientPointsError(new AuthError('test'))).toBe(false);
    });
  });
});
