/**
 * AI Models Query Functions
 */

import { supabase } from '../client';
import { isClassicSelectableModel } from '@/lib/models/classic-model-filter';

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

  return (data as AIModel[]).filter(isClassicSelectableModel);
}

/**
 * Fetch only image generation models
 */
export async function fetchImageModels(): Promise<AIModel[]> {
  const { data, error } = await supabase
    .from('ai_models')
    .select('*')
    .eq('is_enabled', true)
    .eq('type', 'image')
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('Failed to fetch image models:', error);
    return [];
  }

  return (data as AIModel[]).filter(isClassicSelectableModel);
}
