/**
 * Classic model filter
 * Shared visibility rule used by classic selector queries and UI resolution.
 */

import type { AIModel } from '@/lib/supabase/queries/models';

export function isClassicSelectableModel(model: AIModel): boolean {
  const usageScope = model.usage_scope ?? 'classic';
  const isVisibleInSelector = model.is_visible_in_selector ?? true;

  return isVisibleInSelector && usageScope !== 'agent';
}
