/**
 * Canvas Ops Schema Validation
 * Requirements: 16.4, 16.5, 16.6, 16.7
 * 
 * Provides validation functions for canvas ops using JSON Schema (ajv)
 */

import Ajv, { ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';
import canvasOpsSchema from './canvas_ops.schema.json';
import type { Op, GenerateOpsResponse } from '@/lib/canvas/ops.types';

// Initialize Ajv with all errors and reasonable strictness
// Note: useDefaults is disabled because strict mode doesn't allow defaults in schema
const ajv = new Ajv({
  allErrors: true,
  strict: true,
  strictSchema: true,
  strictNumbers: true,
  strictTypes: true,
  strictTuples: true,
  strictRequired: true,
  useDefaults: false, // Disabled - defaults are documented in schema but not applied
  coerceTypes: false,
});

// Add format validators (uri, email, etc.)
addFormats(ajv);

// Compile the schema once for performance
const validateSchema = ajv.compile<GenerateOpsResponse>(canvasOpsSchema);

/**
 * Validation result type
 */
export interface ValidationResult<T = GenerateOpsResponse> {
  valid: boolean;
  data?: T;
  errors?: ValidationError[];
}

/**
 * Structured validation error
 */
export interface ValidationError {
  path: string;
  message: string;
  keyword: string;
  params?: Record<string, unknown>;
}

/**
 * Convert Ajv errors to structured ValidationError format
 */
function formatErrors(errors: ErrorObject[] | null | undefined): ValidationError[] {
  if (!errors) return [];
  
  return errors.map((error) => ({
    path: error.instancePath || '/',
    message: error.message || 'Unknown validation error',
    keyword: error.keyword,
    params: error.params as Record<string, unknown>,
  }));
}

/**
 * Validate a complete ops response (plan + ops)
 * 
 * @param data - The data to validate
 * @returns ValidationResult with valid flag and either data or errors
 * 
 * Requirements: 16.5, 16.6
 */
export function validateOpsResponse(data: unknown): ValidationResult<GenerateOpsResponse> {
  // First check if data is an object
  if (data === null || typeof data !== 'object') {
    return {
      valid: false,
      errors: [{
        path: '/',
        message: 'Data must be an object',
        keyword: 'type',
        params: { type: 'object' },
      }],
    };
  }

  const isValid = validateSchema(data);
  
  if (isValid) {
    return {
      valid: true,
      data: data as GenerateOpsResponse,
    };
  }
  
  return {
    valid: false,
    errors: formatErrors(validateSchema.errors),
  };
}

/**
 * Validate a single op
 * 
 * @param op - The op to validate
 * @returns ValidationResult with valid flag and either data or errors
 */
export function validateSingleOp(op: unknown): ValidationResult<Op> {
  // Wrap in a minimal response structure for validation
  const wrapped = {
    plan: 'validation-only',
    ops: [op],
  };
  
  const result = validateOpsResponse(wrapped);
  
  if (result.valid && result.data) {
    return {
      valid: true,
      data: result.data.ops[0],
    };
  }
  
  // Filter errors to only include those related to the op
  const opErrors = result.errors?.filter(
    (e) => e.path.startsWith('/ops/0') || e.path === '/ops'
  ).map((e) => ({
    ...e,
    path: e.path.replace('/ops/0', '').replace('/ops', '') || '/',
  }));
  
  return {
    valid: false,
    errors: opErrors,
  };
}

/**
 * Validate an array of ops
 * 
 * @param ops - The ops array to validate
 * @returns ValidationResult with valid flag and either data or errors
 */
export function validateOpsArray(ops: unknown): ValidationResult<Op[]> {
  // Wrap in a minimal response structure for validation
  const wrapped = {
    plan: 'validation-only',
    ops: ops,
  };
  
  const result = validateOpsResponse(wrapped);
  
  if (result.valid && result.data) {
    return {
      valid: true,
      data: result.data.ops,
    };
  }
  
  // Filter errors to only include those related to ops
  const opsErrors = result.errors?.filter(
    (e) => e.path.startsWith('/ops') || e.path === '/'
  );
  
  return {
    valid: false,
    errors: opsErrors,
  };
}

/**
 * Check if a string is a valid layer ID format
 * Format: layer-<short-uuid>
 */
export function isValidLayerId(id: string): boolean {
  return /^layer-[a-zA-Z0-9-]+$/.test(id);
}

/**
 * Check if a string is a valid hex color
 */
export function isValidHexColor(color: string): boolean {
  return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
}

/**
 * Generate a valid layer ID
 */
export function generateLayerId(): string {
  const uuid = crypto.randomUUID().split('-')[0];
  return `layer-${uuid}`;
}

/**
 * Type guard to check if validation result is successful
 */
export function isValidResult<T>(result: ValidationResult<T>): result is ValidationResult<T> & { valid: true; data: T } {
  return result.valid === true && result.data !== undefined;
}

/**
 * Get human-readable error summary
 */
export function getErrorSummary(errors: ValidationError[]): string {
  if (errors.length === 0) return 'No errors';
  
  return errors
    .map((e) => `${e.path}: ${e.message}`)
    .join('; ');
}

// Re-export types for convenience
export type { Op, GenerateOpsResponse } from '@/lib/canvas/ops.types';
