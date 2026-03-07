/**
 * Resolve Selectable Models
 * Merges system AI models with user-configured provider models into a unified list.
 * Used by ChatPanel, ModelSelector, and useChatStore to avoid model source divergence.
 * Requirements: 6.1-6.5
 */

import type { AIModel } from '@/lib/supabase/queries/models';
import type { UserProviderConfig } from '@/lib/api/provider-configs';

/** A selectable model entry for the UI */
export interface SelectableModel {
  /** Unique value passed to generation APIs: system model_name or user:{configId} */
  value: string;
  /** Display name shown in the selector */
  displayName: string;
  /** Model type: 'image' or 'ops' */
  type: 'image' | 'ops';
  /** Whether this is a user-configured (BYOK) model */
  isByok: boolean;
  /** Points cost (0 for BYOK) */
  pointsCost: number;
  /** Optional description */
  description?: string | null;
  /** Whether this is the system default model */
  isDefault: boolean;
  /** Provider name for grouping */
  provider: string;
}

/**
 * Check if a system model is an image generation model.
 */
function isImageModel(model: AIModel): boolean {
  if (model.type === 'image') return true;
  return (
    model.name.includes('seedream') ||
    model.name.includes('dall-e') ||
    (model.name.includes('gemini') && model.name.includes('image'))
  );
}

/**
 * Merge system models and user provider configs into a single selectable list.
 *
 * - System models use `model.name` as value
 * - User models use `user:{config.id}` as value
 * - Only enabled user configs are included
 * - Gemini is always visible (system model)
 */
export function resolveSelectableModels(
  systemModels: AIModel[],
  userConfigs: UserProviderConfig[],
): SelectableModel[] {
  const result: SelectableModel[] = [];

  // System models
  for (const model of systemModels) {
    result.push({
      value: model.name,
      displayName: model.display_name,
      type: isImageModel(model) ? 'image' : 'ops',
      isByok: false,
      pointsCost: model.points_cost,
      description: model.description,
      isDefault: model.is_default,
      provider: model.provider,
    });
  }

  // User-configured models (only enabled ones)
  for (const config of userConfigs) {
    if (!config.is_enabled) continue;
    result.push({
      value: config.model_identifier,
      displayName: config.display_name,
      type: 'image', // user configs are always image providers
      isByok: true,
      pointsCost: 0,
      description: null,
      isDefault: false,
      provider: config.provider,
    });
  }

  return result;
}

/**
 * Find the default model value from a selectable list.
 * Prefers the system default, falls back to first model.
 */
export function getDefaultModelValue(models: SelectableModel[]): string | undefined {
  const defaultModel = models.find((m) => m.isDefault);
  return defaultModel?.value ?? models[0]?.value;
}

/**
 * Check if a selectable model value represents an image model.
 * Works for both system models (by lookup) and user models (always image).
 */
export function isSelectableImageModel(
  value: string,
  models: SelectableModel[],
): boolean {
  // user:{configId} is always an image model
  if (value.startsWith('user:')) return true;
  const found = models.find((m) => m.value === value);
  return found?.type === 'image';
}
