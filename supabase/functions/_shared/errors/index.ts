/**
 * Unified Error Handling Module
 * Requirements: 7.1, 7.2, 7.3, 7.4
 */

// ============================================================================
// Error Codes
// ============================================================================

/**
 * Standard error codes for API responses
 */
export const ERROR_CODES = {
  INVALID_REQUEST: 'INVALID_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  MISSING_AUTH: 'MISSING_AUTH',
  INVALID_AUTH: 'INVALID_AUTH',
  PROJECT_ACCESS_DENIED: 'PROJECT_ACCESS_DENIED',
  DOCUMENT_NOT_FOUND: 'DOCUMENT_NOT_FOUND',
  INSUFFICIENT_POINTS: 'INSUFFICIENT_POINTS',
  PROVIDER_ERROR: 'PROVIDER_ERROR',
  USER_PROVIDER_CONFIG_INVALID: 'USER_PROVIDER_CONFIG_INVALID',
  CONFIG_ERROR: 'CONFIG_ERROR',
  API_ERROR: 'API_ERROR',
  PARSE_ERROR: 'PARSE_ERROR',
  MODEL_NOT_SUPPORTED: 'MODEL_NOT_SUPPORTED',
  RESOLUTION_NOT_ALLOWED: 'RESOLUTION_NOT_ALLOWED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

// ============================================================================
// Base Error Class
// ============================================================================

/**
 * Base error class for all application errors
 * Requirements: 7.1
 */
export abstract class AppError extends Error {
  abstract readonly code: string;
  abstract readonly statusCode: number;

  constructor(message: string, public readonly details?: unknown) {
    super(message);
    this.name = this.constructor.name;
    // Maintain proper stack trace in V8 environments
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Convert error to JSON-serializable object
   */
  toJSON(): Record<string, unknown> {
    return {
      code: this.code,
      message: this.message,
      ...(this.details !== undefined && { details: this.details }),
    };
  }
}

// ============================================================================
// Specific Error Classes
// ============================================================================

/**
 * Validation error for invalid request data
 * Requirements: 7.2
 */
export class ValidationError extends AppError {
  readonly code = ERROR_CODES.INVALID_REQUEST;
  readonly statusCode = 400;

  constructor(message: string, public readonly fieldErrors?: string[]) {
    super(message, fieldErrors ? { fields: fieldErrors } : undefined);
  }

  toJSON(): Record<string, unknown> {
    return {
      code: this.code,
      message: this.message,
      ...(this.fieldErrors && { field_errors: this.fieldErrors }),
    };
  }
}

/**
 * Authentication/Authorization error
 * Requirements: 7.2
 */
export class AuthError extends AppError {
  readonly code: string;
  readonly statusCode: number;

  constructor(
    message: string,
    code: string = ERROR_CODES.UNAUTHORIZED,
    statusCode: number = 401
  ) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
  }
}

/**
 * Provider/API error for external service failures
 * Requirements: 7.2, 8.1, 8.2, 8.3, 8.4
 */
export class ProviderError extends AppError {
  readonly code = ERROR_CODES.PROVIDER_ERROR;
  readonly statusCode = 502;

  constructor(
    message: string,
    public readonly providerCode?: string,
    details?: unknown,
    public readonly providerName?: string,
    public readonly modelName?: string,
    public readonly httpStatus?: number
  ) {
    super(message, details);
  }

  toJSON(): Record<string, unknown> {
    return {
      code: this.code,
      message: this.message,
      ...(this.providerCode && { provider_code: this.providerCode }),
      ...(this.providerName && { provider_name: this.providerName }),
      ...(this.modelName && { model_name: this.modelName }),
      ...(this.httpStatus !== undefined && { http_status: this.httpStatus }),
      ...(this.details !== undefined && { details: this.details }),
    };
  }
}

/**
 * Invalid user provider config (missing/disabled/deleted).
 * Returns stable error contract for `user:{configId}` invalid routes.
 */
export class UserProviderConfigInvalidError extends AppError {
  readonly code = ERROR_CODES.USER_PROVIDER_CONFIG_INVALID;
  readonly statusCode = 400;

  constructor(message: string, details?: unknown) {
    super(message, details);
  }
}

/**
 * Insufficient points error for billing failures
 * Requirements: 7.2
 */
export class InsufficientPointsError extends AppError {
  readonly code = ERROR_CODES.INSUFFICIENT_POINTS;
  readonly statusCode = 402;

  constructor(
    public readonly currentBalance: number,
    public readonly requiredPoints: number,
    public readonly modelName: string
  ) {
    super(
      `Insufficient points: current=${currentBalance}, required=${requiredPoints}`
    );
  }

  toJSON(): Record<string, unknown> {
    return {
      code: this.code,
      message: this.message,
      current_balance: this.currentBalance,
      required_points: this.requiredPoints,
      model_name: this.modelName,
    };
  }
}

/**
 * Points-related error (non-insufficient)
 */
export class PointsError extends AppError {
  readonly code: string;
  readonly statusCode = 500;

  constructor(message: string, code: string = 'POINTS_ERROR') {
    super(message);
    this.code = code;
  }
}

/**
 * Asset-related error
 */
export class AssetError extends AppError {
  readonly code: string;
  readonly statusCode = 500;

  constructor(message: string, code: string = 'ASSET_ERROR') {
    super(message);
    this.code = code;
  }
}

/**
 * Job-related error
 */
export class JobError extends AppError {
  readonly code: string;
  readonly statusCode = 500;

  constructor(message: string, code: string = 'JOB_ERROR') {
    super(message);
    this.code = code;
  }
}

/**
 * Internal server error for unexpected failures
 * Requirements: 7.2
 */
export class InternalError extends AppError {
  readonly code = ERROR_CODES.INTERNAL_ERROR;
  readonly statusCode = 500;

  constructor(message: string = 'Internal server error', details?: unknown) {
    super(message, details);
  }
}

// ============================================================================
// Error Response Conversion
// ============================================================================

/**
 * Convert any error to an HTTP Response
 * Requirements: 7.3
 * 
 * @param error - The error to convert
 * @param corsHeaders - CORS headers to include in response
 * @returns HTTP Response with appropriate status code and JSON body
 */
export function errorToResponse(
  error: unknown,
  corsHeaders: Record<string, string> = {}
): Response {
  const headers = {
    ...corsHeaders,
    'Content-Type': 'application/json',
  };

  // Handle AppError instances
  if (error instanceof AppError) {
    return new Response(
      JSON.stringify({ error: error.toJSON() }),
      {
        status: error.statusCode,
        headers,
      }
    );
  }

  // Handle standard Error instances
  if (error instanceof Error) {
    console.error('[ErrorHandler] Unexpected error:', error.message, error.stack);
    return new Response(
      JSON.stringify({
        error: {
          code: ERROR_CODES.INTERNAL_ERROR,
          message: 'Internal server error',
        },
      }),
      {
        status: 500,
        headers,
      }
    );
  }

  // Handle unknown error types
  console.error('[ErrorHandler] Unknown error type:', error);
  return new Response(
    JSON.stringify({
      error: {
        code: ERROR_CODES.INTERNAL_ERROR,
        message: 'Internal server error',
      },
    }),
    {
      status: 500,
      headers,
    }
  );
}

// ============================================================================
// Error Type Guards
// ============================================================================

/**
 * Check if an error is an AppError instance
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Check if an error is a ValidationError
 */
export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

/**
 * Check if an error is an AuthError
 */
export function isAuthError(error: unknown): error is AuthError {
  return error instanceof AuthError;
}

/**
 * Check if an error is a ProviderError
 */
export function isProviderError(error: unknown): error is ProviderError {
  return error instanceof ProviderError;
}

/**
 * Check if an error is an InsufficientPointsError
 */
export function isInsufficientPointsError(error: unknown): error is InsufficientPointsError {
  return error instanceof InsufficientPointsError;
}
