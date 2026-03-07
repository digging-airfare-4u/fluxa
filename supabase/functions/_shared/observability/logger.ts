/**
 * Structured Logger for Edge Functions
 * Provides consistent log fields and API key sanitization in Deno runtime.
 * Requirements: 8.1
 */

// ============================================================================
// Types
// ============================================================================

export interface LogContext {
  user_id?: string;
  provider?: string;
  model_name?: string;
  request_id?: string;
  config_id?: string;
  [key: string]: unknown;
}

type LogLevel = 'info' | 'warn' | 'error';

// ============================================================================
// Sanitization
// ============================================================================

const SENSITIVE_PATTERNS = [
  /Bearer\s+[A-Za-z0-9\-._~+/]+=*/g,
  /\b(sk-|key-|api-)[A-Za-z0-9\-._]{8,}\b/g,
  /Authorization:\s*[^\s,}]+/gi,
  /api_key['":\s]*[A-Za-z0-9\-._~+/]{8,}/gi,
  /apiKey['":\s]*[A-Za-z0-9\-._~+/]{8,}/gi,
];

export function sanitize(value: string): string {
  let result = value;
  for (const pattern of SENSITIVE_PATTERNS) {
    result = result.replace(pattern, '[REDACTED]');
  }
  return result;
}

function sanitizeObject(obj: unknown): unknown {
  if (typeof obj === 'string') return sanitize(obj);
  if (Array.isArray(obj)) return obj.map(sanitizeObject);
  if (obj && typeof obj === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (/api_?key|secret|password|token|encrypted/i.test(k)) {
        out[k] = '[REDACTED]';
      } else {
        out[k] = sanitizeObject(v);
      }
    }
    return out;
  }
  return obj;
}

// ============================================================================
// Logger
// ============================================================================

function emit(level: LogLevel, prefix: string, message: string, ctx?: LogContext) {
  const safeCtx = ctx ? sanitizeObject(ctx) : undefined;
  const payload = safeCtx ? `${message} ${JSON.stringify(safeCtx)}` : message;

  switch (level) {
    case 'info':
      console.log(`[${prefix}] ${payload}`);
      break;
    case 'warn':
      console.warn(`[${prefix}] ${payload}`);
      break;
    case 'error':
      console.error(`[${prefix}] ${payload}`);
      break;
  }
}

export function createLogger(prefix: string) {
  return {
    info: (message: string, ctx?: LogContext) => emit('info', prefix, message, ctx),
    warn: (message: string, ctx?: LogContext) => emit('warn', prefix, message, ctx),
    error: (message: string, ctx?: LogContext) => emit('error', prefix, message, ctx),
  };
}
