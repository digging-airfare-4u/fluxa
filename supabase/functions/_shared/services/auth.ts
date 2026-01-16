/**
 * Authentication and Authorization Service
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 */

import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2.89.0';
import { AuthError, ERROR_CODES } from '../errors/index.ts';
import type { AuthenticatedUser, UserMembership, ResolutionPreset } from '../types/index.ts';
import { RESOLUTION_PRESETS } from '../types/index.ts';

// Re-export types for convenience
export type { AuthenticatedUser, UserMembership };

/**
 * Authentication and Authorization Service
 * Handles user validation, project/document access, and membership queries
 * Requirements: 3.1
 */
export class AuthService {
  constructor(
    private supabaseUrl: string,
    private supabaseAnonKey: string
  ) {}

  /**
   * Validate user from authorization header
   * Requirements: 3.2
   * 
   * @param authHeader - The Authorization header value
   * @returns Promise with authenticated user and Supabase client
   * @throws AuthError if authentication fails
   */
  async validateUser(
    authHeader: string | null
  ): Promise<{ user: AuthenticatedUser; client: SupabaseClient }> {
    if (!authHeader) {
      throw new AuthError(
        'Missing authorization header',
        ERROR_CODES.MISSING_AUTH,
        401
      );
    }

    const client = createClient(this.supabaseUrl, this.supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error } = await client.auth.getUser();

    if (error || !user) {
      throw new AuthError(
        'Invalid authentication',
        ERROR_CODES.INVALID_AUTH,
        401
      );
    }

    return {
      user: { id: user.id, email: user.email },
      client,
    };
  }


  /**
   * Validate user has access to a project
   * Requirements: 3.3
   * 
   * @param client - Supabase client with user auth
   * @param projectId - Project ID to validate access for
   * @throws AuthError if project not found or access denied
   */
  async validateProjectAccess(
    client: SupabaseClient,
    projectId: string
  ): Promise<void> {
    const { data, error } = await client
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .single();

    if (error || !data) {
      throw new AuthError(
        'Project not found or access denied',
        ERROR_CODES.PROJECT_ACCESS_DENIED,
        403
      );
    }
  }

  /**
   * Validate user has access to a document
   * Requirements: 3.4
   * 
   * @param client - Supabase client with user auth
   * @param documentId - Document ID to validate access for
   * @throws AuthError if document not found
   */
  async validateDocumentAccess(
    client: SupabaseClient,
    documentId: string
  ): Promise<void> {
    const { data, error } = await client
      .from('documents')
      .select('id')
      .eq('id', documentId)
      .single();

    if (error || !data) {
      throw new AuthError(
        'Document not found',
        ERROR_CODES.DOCUMENT_NOT_FOUND,
        404
      );
    }
  }

  /**
   * Get user's membership level and permissions
   * Requirements: 3.5
   * 
   * @param serviceClient - Supabase client with service role key
   * @param userId - User ID to get membership for
   * @returns User membership info with level and max resolution
   */
  async getUserMembership(
    serviceClient: SupabaseClient,
    userId: string
  ): Promise<UserMembership> {
    const { data, error } = await serviceClient
      .from('memberships')
      .select('level, membership_configs!inner(perks)')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      // Default to free tier if no membership found
      return { level: 'free', maxResolution: '1K' };
    }

    const perks = (data.membership_configs as { perks: { max_image_resolution?: string } })?.perks;
    const maxRes = perks?.max_image_resolution as ResolutionPreset | undefined;

    return {
      level: data.level as 'free' | 'pro' | 'team',
      maxResolution: maxRes && maxRes in RESOLUTION_PRESETS ? maxRes : '1K',
    };
  }

  /**
   * Validate resolution against user's membership level
   * Requirements: 3.5
   * 
   * @param requestedResolution - Resolution requested by user
   * @param maxAllowedResolution - Max resolution allowed by membership
   * @returns true if resolution is allowed
   */
  validateResolutionPermission(
    requestedResolution: ResolutionPreset,
    maxAllowedResolution: ResolutionPreset
  ): boolean {
    const requestedPixels = RESOLUTION_PRESETS[requestedResolution];
    const maxPixels = RESOLUTION_PRESETS[maxAllowedResolution];
    return requestedPixels <= maxPixels;
  }
}
