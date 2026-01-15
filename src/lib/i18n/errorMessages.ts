/**
 * Error Messages Utility
 * Provides mapping from API error codes to localized messages.
 * Requirements: 11.1 - API error code to localized message mapping
 */

'use client';

import { useTranslations } from 'next-intl';
import { useCallback } from 'react';

/**
 * Known API error codes that map to localized messages.
 * These codes are returned by the backend API and Edge Functions.
 */
export type ApiErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'RATE_LIMIT'
  | 'INSUFFICIENT_POINTS'
  | 'GENERATION_FAILED'
  | 'IMAGE_GENERATION_FAILED'
  | 'UPLOAD_FAILED'
  | 'EXPORT_FAILED'
  | 'SESSION_EXPIRED'
  | 'LOAD_MESSAGES_FAILED'
  | 'SEND_MESSAGE_FAILED'
  | 'UNKNOWN';

/**
 * Network error types for client-side error handling.
 */
export type NetworkErrorType =
  | 'OFFLINE'
  | 'TIMEOUT'
  | 'SERVER_ERROR';

/**
 * Validation error types for form validation.
 */
export type ValidationErrorType =
  | 'REQUIRED'
  | 'INVALID_EMAIL'
  | 'INVALID_FORMAT';

/**
 * Mapping from API error codes to translation keys in the errors namespace.
 */
const API_ERROR_KEY_MAP: Record<ApiErrorCode, string> = {
  UNAUTHORIZED: 'api.unauthorized',
  FORBIDDEN: 'api.forbidden',
  NOT_FOUND: 'api.not_found',
  RATE_LIMIT: 'api.rate_limit',
  INSUFFICIENT_POINTS: 'api.insufficient_points',
  GENERATION_FAILED: 'api.generation_failed',
  IMAGE_GENERATION_FAILED: 'api.image_generation_failed',
  UPLOAD_FAILED: 'api.upload_failed',
  EXPORT_FAILED: 'api.export_failed',
  SESSION_EXPIRED: 'api.session_expired',
  LOAD_MESSAGES_FAILED: 'api.load_messages_failed',
  SEND_MESSAGE_FAILED: 'api.send_message_failed',
  UNKNOWN: 'api.unknown',
};

/**
 * Mapping from network error types to translation keys.
 */
const NETWORK_ERROR_KEY_MAP: Record<NetworkErrorType, string> = {
  OFFLINE: 'network.offline',
  TIMEOUT: 'network.timeout',
  SERVER_ERROR: 'network.server_error',
};

/**
 * Mapping from validation error types to translation keys.
 */
const VALIDATION_ERROR_KEY_MAP: Record<ValidationErrorType, string> = {
  REQUIRED: 'validation.required',
  INVALID_EMAIL: 'validation.invalid_email',
  INVALID_FORMAT: 'validation.invalid_format',
};

/**
 * Hook for getting localized error messages.
 * Provides functions to convert error codes to user-friendly messages.
 * 
 * @example
 * ```tsx
 * const { getApiError, getNetworkError } = useErrorMessages();
 * 
 * // In error handler:
 * if (response.status === 401) {
 *   setError(getApiError('UNAUTHORIZED'));
 * }
 * ```
 */
export function useErrorMessages() {
  const t = useTranslations('errors');

  /**
   * Get localized message for an API error code.
   * Falls back to 'unknown' error if code is not recognized.
   */
  const getApiError = useCallback((code: ApiErrorCode | string): string => {
    const key = API_ERROR_KEY_MAP[code as ApiErrorCode] || API_ERROR_KEY_MAP.UNKNOWN;
    return t(key);
  }, [t]);

  /**
   * Get localized message for a network error type.
   */
  const getNetworkError = useCallback((type: NetworkErrorType): string => {
    const key = NETWORK_ERROR_KEY_MAP[type];
    return t(key);
  }, [t]);

  /**
   * Get localized message for a validation error type.
   */
  const getValidationError = useCallback((type: ValidationErrorType): string => {
    const key = VALIDATION_ERROR_KEY_MAP[type];
    return t(key);
  }, [t]);

  /**
   * Parse an error response and return a localized message.
   * Handles various error formats from API responses.
   * 
   * @param error - The error object or response
   * @returns Localized error message
   */
  const parseError = useCallback((error: unknown): string => {
    // Handle Error objects
    if (error instanceof Error) {
      // Check if it's a network error
      if (error.message === 'Failed to fetch' || error.message.includes('network')) {
        return getNetworkError('OFFLINE');
      }
      if (error.message.includes('timeout')) {
        return getNetworkError('TIMEOUT');
      }
      // Return the error message as-is if it's already localized
      return error.message;
    }

    // Handle API error response objects
    if (typeof error === 'object' && error !== null) {
      const errorObj = error as { code?: string; message?: string; error?: { code?: string; message?: string } };
      
      // Check for nested error object (common API response format)
      if (errorObj.error?.code) {
        return getApiError(errorObj.error.code);
      }
      
      // Check for direct code
      if (errorObj.code) {
        return getApiError(errorObj.code);
      }
      
      // Check for message
      if (errorObj.message) {
        return errorObj.message;
      }
    }

    // Handle string errors
    if (typeof error === 'string') {
      return error;
    }

    // Fallback to unknown error
    return getApiError('UNKNOWN');
  }, [getApiError, getNetworkError]);

  /**
   * Get localized message from HTTP status code.
   * Useful for handling fetch response errors.
   */
  const getHttpError = useCallback((status: number): string => {
    switch (status) {
      case 401:
        return getApiError('UNAUTHORIZED');
      case 403:
        return getApiError('FORBIDDEN');
      case 404:
        return getApiError('NOT_FOUND');
      case 429:
        return getApiError('RATE_LIMIT');
      case 500:
      case 502:
      case 503:
      case 504:
        return getNetworkError('SERVER_ERROR');
      default:
        return getApiError('UNKNOWN');
    }
  }, [getApiError, getNetworkError]);

  return {
    getApiError,
    getNetworkError,
    getValidationError,
    parseError,
    getHttpError,
    t, // Expose raw translation function for custom keys
  };
}

/**
 * Type guard to check if an error response has a specific error code.
 */
export function hasErrorCode(error: unknown, code: ApiErrorCode): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  
  const errorObj = error as { code?: string; error?: { code?: string } };
  return errorObj.code === code || errorObj.error?.code === code;
}

/**
 * Extract error code from an error response.
 */
export function getErrorCode(error: unknown): ApiErrorCode | null {
  if (typeof error !== 'object' || error === null) {
    return null;
  }
  
  const errorObj = error as { code?: string; error?: { code?: string } };
  const code = errorObj.code || errorObj.error?.code;
  
  if (code && code in API_ERROR_KEY_MAP) {
    return code as ApiErrorCode;
  }
  
  return null;
}
