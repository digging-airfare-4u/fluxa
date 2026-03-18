/**
 * Supabase Server Client
 * Service-role and authenticated request helpers for server-side API routes.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';

let _serviceClient: SupabaseClient | null = null;

export class ApiAuthError extends Error {
  constructor(message: string = 'Authentication required') {
    super(message);
    this.name = 'ApiAuthError';
  }
}

/**
 * Get a Supabase client with service_role privileges.
 */
export function getServiceClient(): SupabaseClient {
  if (_serviceClient) return _serviceClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  _serviceClient = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return _serviceClient;
}

/**
 * Backward-compatible alias used by existing API routes.
 */
export function createServiceClient(): SupabaseClient {
  return getServiceClient();
}

/**
 * Read admin capability flags for a user from user_profiles.
 */
export async function getUserAdminFlags(
  userId: string,
): Promise<{ isSuperAdmin: boolean }> {
  const serviceClient = getServiceClient();
  const { data, error } = await serviceClient
    .from('user_profiles')
    .select('is_super_admin')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return {
    isSuperAdmin: data?.is_super_admin === true,
  };
}

/**
 * Extract authenticated user from Authorization header.
 */
export async function getUserFromAuthHeader(
  authHeader: string | null
): Promise<{ id: string; email?: string } | null> {
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) return null;

  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const {
    data: { user },
    error,
  } = await client.auth.getUser(token);

  if (error || !user) return null;
  return { id: user.id, email: user.email };
}

/**
 * Backward-compatible helper expected by existing API routes.
 */
export async function createAuthenticatedClient(
  request: NextRequest
): Promise<{ client: SupabaseClient; user: { id: string; email?: string } }> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new ApiAuthError('Authentication required');
  }

  const token = authHeader.slice(7);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new ApiAuthError('Supabase auth env is not configured');
  }

  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const {
    data: { user },
    error,
  } = await client.auth.getUser(token);

  if (error || !user) {
    throw new ApiAuthError('Invalid authentication token');
  }

  return { client, user: { id: user.id, email: user.email } };
}
