/**
 * AI Models queries
 * Fetches AI model configurations from Supabase
 */

import { supabase } from '@/lib/supabase/client';

export interface AIModel {
  id: string;
  name: string;
  display_name: string;
  provider: string;
  description: string | null;
  type: string; // 'ops' for text generation, 'image' for image generation
  is_default: boolean;
  is_enabled: boolean;
  sort_order: number;
  points_cost: number;
  supports_image_tool?: boolean;
  usage_scope?: 'classic' | 'agent' | 'all';
  is_visible_in_selector?: boolean;
  agent_role?: 'planner' | 'executor' | null;
  supports_tool_calling?: boolean;
  created_at: string;
}

/**
 * Fetch all AI models from database
 */
export async function getAIModels(): Promise<AIModel[]> {
  const { data, error } = await supabase
    .from('ai_models')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('Failed to fetch AI models:', error);
    throw new Error(`Failed to fetch AI models: ${error.message}`);
  }

  return data || [];
}

/**
 * Fetch only enabled AI models
 */
export async function getEnabledAIModels(): Promise<AIModel[]> {
  const { data, error } = await supabase
    .from('ai_models')
    .select('*')
    .eq('is_enabled', true)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('Failed to fetch enabled AI models:', error);
    throw new Error(`Failed to fetch enabled AI models: ${error.message}`);
  }

  return data || [];
}

/**
 * Fetch only image generation models
 * Requirements: 6.1
 */
export async function getImageModels(): Promise<AIModel[]> {
  const { data, error } = await supabase
    .from('ai_models')
    .select('*')
    .eq('is_enabled', true)
    .eq('type', 'image')
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('Failed to fetch image models:', error);
    throw new Error(`Failed to fetch image models: ${error.message}`);
  }

  return data || [];
}
