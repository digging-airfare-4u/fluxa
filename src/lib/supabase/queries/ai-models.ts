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
  is_default: boolean;
  is_enabled: boolean;
  sort_order: number;
  points_cost: number;
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
