/**
 * Provider Host Allowlist Validator
 * Validates that external provider URLs are on the approved host:port allowlist.
 * Requirements: 4.8, 5.7, 8.2, 8.6
 */

import type { SupabaseClient } from '@supabase/supabase-js';

/** Cache for allowlist with TTL */
let cachedAllowlist: string[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60_000; // 60s

type AllowlistSource = 'system_settings' | 'env' | 'none';

interface CachedAllowlistContext {
  hosts: string[];
  source: AllowlistSource;
  loadedAt: number;
}

let cachedAllowlistContext: CachedAllowlistContext | null = null;

interface ValidateAsyncOptions {
  serviceClient?: SupabaseClient;
}

export type HostValidationFailureCode =
  | 'INVALID_URL'
  | 'ALLOWLIST_EMPTY'
  | 'HOST_NOT_ALLOWED';

export type HostValidationResult =
  | { valid: true; hostPort: string; source: AllowlistSource }
  | { valid: false; code: HostValidationFailureCode; reason: string; hostPort?: string; source: AllowlistSource };

function normalizeHosts(items: string[]): string[] {
  return items
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function parseAllowlistValue(value: unknown): string[] {
  if (Array.isArray(value)) {
    return normalizeHosts(value.filter((item): item is string => typeof item === 'string'));
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return normalizeHosts(parsed.filter((item): item is string => typeof item === 'string'));
        }
      } catch {
        // fall through to comma-separated parsing
      }
    }
    return normalizeHosts(trimmed.split(','));
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.hosts)) {
      return normalizeHosts(record.hosts.filter((item): item is string => typeof item === 'string'));
    }
    if (Array.isArray(record.allowlist)) {
      return normalizeHosts(record.allowlist.filter((item): item is string => typeof item === 'string'));
    }
  }

  return [];
}

/**
 * Normalize a URL to its host:port for allowlist comparison.
 * - Only https is allowed
 * - Default port 443 is appended if not explicit
 * - Rejects IP literals, localhost, and private networks
 */
export function normalizeHostPort(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'https:') {
    return null;
  }

  const hostname = parsed.hostname.toLowerCase();

  // Reject IP literals (IPv4 and IPv6)
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) || hostname.startsWith('[')) {
    return null;
  }

  // Reject localhost
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
    return null;
  }

  // Reject common private/link-local/metadata domains
  if (
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname === 'metadata.google.internal' ||
    hostname === '169.254.169.254'
  ) {
    return null;
  }

  const port = parsed.port || '443';
  return `${hostname}:${port}`;
}

/**
 * Load the allowlist from environment variable.
 * In production, this would also check system_settings table with caching.
 */
export function loadAllowlist(): string[] {
  const now = Date.now();
  if (cachedAllowlist && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedAllowlist;
  }

  const envValue = process.env.PROVIDER_HOST_ALLOWLIST || '';
  const hosts = envValue
    .split(',')
    .map(h => h.trim().toLowerCase())
    .filter(Boolean);

  cachedAllowlist = hosts;
  cacheTimestamp = now;
  return hosts;
}

async function loadAllowlistFromSystemSettings(
  serviceClient?: SupabaseClient,
): Promise<string[] | null> {
  if (!serviceClient) return null;

  try {
    const { data, error } = await serviceClient
      .from('system_settings')
      .select('value')
      .eq('key', 'provider_host_allowlist')
      .single();

    if (error || !data) return null;
    const row = data as { value?: unknown };
    return parseAllowlistValue(row.value);
  } catch {
    return null;
  }
}

/**
 * Load allowlist with source priority: system_settings -> env.
 * Uses 60s cache.
 */
export async function loadAllowlistWithSource(
  options: ValidateAsyncOptions = {},
): Promise<{ hosts: string[]; source: AllowlistSource }> {
  const now = Date.now();
  if (cachedAllowlistContext && now - cachedAllowlistContext.loadedAt < CACHE_TTL_MS) {
    return {
      hosts: cachedAllowlistContext.hosts,
      source: cachedAllowlistContext.source,
    };
  }

  const systemHosts = await loadAllowlistFromSystemSettings(options.serviceClient);
  if (systemHosts !== null) {
    cachedAllowlistContext = {
      hosts: systemHosts,
      source: 'system_settings',
      loadedAt: now,
    };
    return { hosts: systemHosts, source: 'system_settings' };
  }

  const envHosts = loadAllowlist();
  const source: AllowlistSource = envHosts.length > 0 ? 'env' : 'none';
  cachedAllowlistContext = {
    hosts: envHosts,
    source,
    loadedAt: now,
  };
  return { hosts: envHosts, source };
}

/**
 * Validate that a provider URL's host:port is on the allowlist.
 * Returns { valid: true } or { valid: false, reason: string }.
 */
export function validateProviderHost(url: string): { valid: true } | { valid: false; reason: string } {
  const hostPort = normalizeHostPort(url);
  if (!hostPort) {
    return { valid: false, reason: 'Invalid URL: must be https with a valid public hostname' };
  }

  const allowlist = loadAllowlist();
  if (allowlist.length === 0) {
    return { valid: false, reason: 'No provider hosts are configured in the allowlist' };
  }

  if (!allowlist.includes(hostPort)) {
    return { valid: false, reason: `Host ${hostPort} is not in the allowed provider list` };
  }

  return { valid: true };
}

/**
 * Async runtime validation: prefer `system_settings`, fallback to env.
 */
export async function validateProviderHostAsync(
  url: string,
  options: ValidateAsyncOptions = {},
): Promise<HostValidationResult> {
  const hostPort = normalizeHostPort(url);
  if (!hostPort) {
    return {
      valid: false,
      code: 'INVALID_URL',
      reason: 'Invalid URL: must be https with a valid public hostname',
      source: 'none',
    };
  }

  const { hosts, source } = await loadAllowlistWithSource(options);
  if (hosts.length === 0) {
    return {
      valid: false,
      code: 'ALLOWLIST_EMPTY',
      reason: 'No provider hosts are configured in the allowlist',
      hostPort,
      source,
    };
  }

  if (!hosts.includes(hostPort)) {
    return {
      valid: false,
      code: 'HOST_NOT_ALLOWED',
      reason: `Host ${hostPort} is not in the allowed provider list`,
      hostPort,
      source,
    };
  }

  return { valid: true, hostPort, source };
}

/** Reset cache (for testing) */
export function resetAllowlistCache(): void {
  cachedAllowlist = null;
  cacheTimestamp = 0;
  cachedAllowlistContext = null;
}
