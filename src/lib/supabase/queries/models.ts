/**
 * AI Models Query Functions
 */

import { supabase } from '../client';

export interface AIModel {
  id: string;
  name: string;
  display_name: string;
  provider: string;
  description: string | null;
  is_default: boolean;
  is_enabled: boolean;
  sort_order: number;
}

/**
 * Fetch all enabled AI models from database
 */
export async function fetchModels(): Promise<AIModel[]> {
  const { data, error } = await supabase
    .from('ai_models')
    .select('*')
    .eq('is_enabled', true)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('Failed to fetch models:', error);
    return [];
  }

  return data as AIModel[];
}
