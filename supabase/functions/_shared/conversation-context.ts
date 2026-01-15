/**
 * Conversation Context Manager
 * Manages multi-turn image editing context for AI providers
 * Requirements: 2.1, 2.2, 2.5, 2.6, 2.7
 */

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.89.0';

/**
 * Provider-specific context stored in conversations.provider_context
 */
export interface ProviderContext {
  gemini?: {
    thought_signature?: string;
    updated_at?: string;
  };
  volcengine?: {
    task_id?: string;
    updated_at?: string;
  };
}

/**
 * Conversation context for multi-turn image editing
 * Requirements: 2.6, 2.7
 */
export interface ConversationContext {
  conversationId: string;
  lastGeneratedAssetId: string | null;
  providerContext: ProviderContext;
}

/**
 * Asset information for reference image
 */
export interface AssetInfo {
  id: string;
  storagePath: string;
  userId: string;
  mimeType: string;
}

/**
 * Get conversation context for multi-turn editing
 * Requirements: 2.1, 2.2, 2.6, 2.7
 * 
 * @param supabase - Supabase client
 * @param conversationId - Conversation ID
 * @returns Conversation context or null if not found
 */
export async function getConversationContext(
  supabase: SupabaseClient,
  conversationId: string
): Promise<ConversationContext | null> {
  const { data, error } = await supabase
    .from('conversations')
    .select('id, last_generated_asset_id, provider_context')
    .eq('id', conversationId)
    .single();

  if (error || !data) {
    console.log(`[ConversationContext] Conversation ${conversationId} not found or error:`, error?.message);
    return null;
  }

  return {
    conversationId: data.id,
    lastGeneratedAssetId: data.last_generated_asset_id,
    providerContext: (data.provider_context as ProviderContext) || {},
  };
}

/**
 * Update conversation context after image generation
 * Requirements: 2.6, 2.7
 * 
 * @param supabase - Supabase client
 * @param conversationId - Conversation ID
 * @param updates - Partial updates to apply
 */
export async function updateConversationContext(
  supabase: SupabaseClient,
  conversationId: string,
  updates: {
    lastGeneratedAssetId?: string;
    providerContext?: Partial<ProviderContext>;
  }
): Promise<void> {
  const updateData: Record<string, unknown> = {};

  if (updates.lastGeneratedAssetId !== undefined) {
    updateData.last_generated_asset_id = updates.lastGeneratedAssetId;
  }

  if (updates.providerContext) {
    // Get existing context first to merge
    const { data: existing } = await supabase
      .from('conversations')
      .select('provider_context')
      .eq('id', conversationId)
      .single();

    const existingContext = (existing?.provider_context as ProviderContext) || {};
    
    // Deep merge provider context
    updateData.provider_context = {
      ...existingContext,
      ...updates.providerContext,
    };
  }

  if (Object.keys(updateData).length === 0) {
    return;
  }

  const { error } = await supabase
    .from('conversations')
    .update(updateData)
    .eq('id', conversationId);

  if (error) {
    console.error(`[ConversationContext] Failed to update conversation ${conversationId}:`, error.message);
    throw new Error(`Failed to update conversation context: ${error.message}`);
  }

  console.log(`[ConversationContext] Updated conversation ${conversationId}:`, updateData);
}

/**
 * Get asset info for reference image from last generation
 * Requirements: 2.3, 2.7
 * 
 * @param supabase - Supabase client
 * @param assetId - Asset ID
 * @returns Asset info or null if not found
 */
export async function getAssetInfo(
  supabase: SupabaseClient,
  assetId: string
): Promise<AssetInfo | null> {
  const { data, error } = await supabase
    .from('assets')
    .select('id, storage_path, user_id, mime_type')
    .eq('id', assetId)
    .single();

  if (error || !data) {
    console.log(`[ConversationContext] Asset ${assetId} not found:`, error?.message);
    return null;
  }

  return {
    id: data.id,
    storagePath: data.storage_path,
    userId: data.user_id,
    mimeType: data.mime_type || 'image/png',
  };
}

/**
 * Get reference image as base64 from last generated asset
 * Requirements: 2.3, 2.7
 * 
 * @param supabase - Supabase client
 * @param assetId - Asset ID
 * @param requestingUserId - User ID making the request (for ownership validation)
 * @returns Base64 image data or null if not found/unauthorized
 */
export async function getLastGeneratedImageAsBase64(
  supabase: SupabaseClient,
  assetId: string,
  requestingUserId: string
): Promise<{ base64: string; mimeType: string } | null> {
  // Get asset info
  const assetInfo = await getAssetInfo(supabase, assetId);
  if (!assetInfo) {
    return null;
  }

  // Validate ownership - user can only access their own assets
  // Requirements: 1.8
  if (assetInfo.userId !== requestingUserId) {
    console.warn(`[ConversationContext] User ${requestingUserId} attempted to access asset owned by ${assetInfo.userId}`);
    return null;
  }

  // Download from storage
  const { data, error } = await supabase.storage
    .from('assets')
    .download(assetInfo.storagePath);

  if (error || !data) {
    console.error(`[ConversationContext] Failed to download asset ${assetId}:`, error?.message);
    return null;
  }

  // Convert to base64
  const arrayBuffer = await data.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);

  return {
    base64,
    mimeType: assetInfo.mimeType,
  };
}

/**
 * Initialize or get conversation context for a new request
 * Requirements: 2.1, 2.5
 * 
 * @param supabase - Supabase client
 * @param conversationId - Conversation ID (optional)
 * @returns Conversation context or null for new conversation
 */
export async function initializeConversationContext(
  supabase: SupabaseClient,
  conversationId?: string
): Promise<ConversationContext | null> {
  if (!conversationId) {
    // New conversation - start with fresh context
    // Requirements: 2.5
    console.log('[ConversationContext] No conversationId provided, starting fresh context');
    return null;
  }

  return getConversationContext(supabase, conversationId);
}
