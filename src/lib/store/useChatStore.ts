/**
 * useChatStore - Zustand store for chat state management
 * Requirements: Shared chat state across components
 */

import { create } from 'zustand';
import type { AIModel } from '@/lib/supabase/queries/models';
import {
  getClassicSelectableModels,
  getDefaultModelValue,
  getDefaultModelValueByType,
  type SelectableModel,
} from '@/lib/models/resolve-selectable-models';

/**
 * Generation phase states for three-phase feedback
 * - idle: No generation in progress
 * - phase-a: Initial state (0-150ms) - Button shows "Generating...", pending message added
 * - phase-b: Waiting for generation - Skeleton placeholder visible
 * - success: Generation completed - Transition to ImageCard
 * - failed: Generation failed - Show inline error
 * - stopped: User cancelled generation
 */
export type GenerationPhase = 'idle' | 'phase-a' | 'phase-b' | 'success' | 'failed' | 'stopped';
export type ChatMode = 'classic' | 'agent';

function getInitialChatMode(): ChatMode {
  return 'agent';
}

export interface ChatState {
  chatMode: ChatMode;

  // Model selection
  selectedModel: string;
  selectedAgentModel: string;
  selectedAgentImageModel: string;
  selectedResolution: '1K' | '2K' | '4K';
  selectedAspectRatio: '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '2:3' | '3:2' | '4:5' | '5:4' | '21:9';
  models: AIModel[];
  /** Unified selectable model list (system + user BYOK) */
  selectableModels: SelectableModel[];

  // Generation state
  generationPhase: GenerationPhase;

  // Error state
  error: string | null;

  // Insufficient points error
  insufficientPointsError: {
    code: string;
    current_balance: number;
    required_points: number;
    model_name?: string;
    membership_level?: 'free' | 'pro' | 'team';
  } | null;

  // User provider config invalid error
  userProviderConfigError: {
    code: string;
    message: string;
  } | null;
}

export interface ChatActions {
  // Mode actions
  setChatMode: (mode: ChatMode) => void;

  // Model actions
  setSelectedModel: (model: string) => void;
  setSelectedAgentModel: (model: string) => void;
  setSelectedAgentImageModel: (model: string) => void;
  setSelectedResolution: (resolution: '1K' | '2K' | '4K') => void;
  setSelectedAspectRatio: (ratio: '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '2:3' | '3:2' | '4:5' | '5:4' | '21:9') => void;
  setModels: (models: AIModel[]) => void;
  setSelectableModels: (models: SelectableModel[]) => void;

  // Generation actions
  setGenerationPhase: (phase: GenerationPhase) => void;
  startGeneration: () => void;
  completeGeneration: () => void;
  failGeneration: (error: string) => void;
  stopGeneration: () => void;

  // Error actions
  setError: (error: string | null) => void;
  clearError: () => void;

  // Insufficient points actions
  setInsufficientPointsError: (error: ChatState['insufficientPointsError']) => void;
  clearInsufficientPointsError: () => void;

  // User provider config invalid actions
  setUserProviderConfigError: (error: ChatState['userProviderConfigError']) => void;
  clearUserProviderConfigError: () => void;

  // Reset
  reset: () => void;
}

export type ChatStore = ChatState & ChatActions;

const initialState: ChatState = {
  chatMode: getInitialChatMode(),
  selectedModel: '',
  selectedAgentModel: '',
  selectedAgentImageModel: '',
  selectedResolution: '1K',
  selectedAspectRatio: '1:1',
  models: [],
  selectableModels: [],
  generationPhase: 'idle',
  error: null,
  insufficientPointsError: null,
  userProviderConfigError: null,
};

export const useChatStore = create<ChatStore>((set) => ({
  ...initialState,

  // Mode actions
  setChatMode: (mode) => set({ chatMode: mode }),

  // Model actions
  setSelectedModel: (model) => set({ selectedModel: model }),
  setSelectedAgentModel: (model) => set({ selectedAgentModel: model }),
  setSelectedAgentImageModel: (model) => set({ selectedAgentImageModel: model }),
  setSelectedResolution: (resolution) => set({ selectedResolution: resolution }),
  setSelectedAspectRatio: (ratio) => set({ selectedAspectRatio: ratio }),
  setModels: (models) => {
    const defaultModel = models.find(m => m.is_default) || models[0];
    set({
      models,
      selectedModel: defaultModel?.name || initialState.selectedModel,
    });
  },
  setSelectableModels: (selectableModels) => {
    const classicSelectableModels = getClassicSelectableModels(selectableModels);
    const defaultModel = getDefaultModelValue(classicSelectableModels);
    const defaultAgentModel = getDefaultModelValueByType(selectableModels, 'ops');
    const defaultAgentImageModel = getDefaultModelValueByType(selectableModels, 'image');
    set((state) => ({
      selectableModels,
      // Keep classic image/text selection stable when possible.
      selectedModel:
        state.selectedModel === initialState.selectedModel ||
        !classicSelectableModels.some((m) => m.value === state.selectedModel)
          ? (defaultModel || state.selectedModel)
          : state.selectedModel,
      selectedAgentModel:
        state.selectedAgentModel === initialState.selectedAgentModel ||
        !selectableModels.some((m) => m.value === state.selectedAgentModel && m.type === 'ops')
          ? (defaultAgentModel || state.selectedAgentModel)
          : state.selectedAgentModel,
      selectedAgentImageModel:
        state.selectedAgentImageModel === initialState.selectedAgentImageModel ||
        !selectableModels.some((m) => m.value === state.selectedAgentImageModel && m.type === 'image')
          ? (defaultAgentImageModel || state.selectedAgentImageModel)
          : state.selectedAgentImageModel,
    }));
  },

  // Generation actions
  setGenerationPhase: (phase) => set({ generationPhase: phase }),
  startGeneration: () => set({ generationPhase: 'phase-a', error: null }),
  completeGeneration: () => {
    set({ generationPhase: 'success' });
    // Reset to idle after a brief moment
    setTimeout(() => set({ generationPhase: 'idle' }), 100);
  },
  failGeneration: (error) => set({ generationPhase: 'failed', error }),
  stopGeneration: () => {
    set({ generationPhase: 'stopped' });
    // Reset to idle after a brief moment
    setTimeout(() => set({ generationPhase: 'idle' }), 100);
  },

  // Error actions
  setError: (error) => set({ error }),
  clearError: () => set({ error: null, generationPhase: 'idle' }),

  // Insufficient points actions
  setInsufficientPointsError: (error) => set({ insufficientPointsError: error }),
  clearInsufficientPointsError: () => set({ insufficientPointsError: null }),

  // User provider config invalid actions
  setUserProviderConfigError: (error) => set({ userProviderConfigError: error }),
  clearUserProviderConfigError: () => set({ userProviderConfigError: null }),

  // Reset
  reset: () => set({
    ...initialState,
    chatMode: getInitialChatMode(),
  }),
}));

// Selector hooks for common use cases
export const useChatMode = () => useChatStore((state) => state.chatMode);
export const useSelectedModel = () => useChatStore((state) => state.selectedModel);
export const useSelectedAgentModel = () => useChatStore((state) => state.selectedAgentModel);
export const useSelectedAgentImageModel = () => useChatStore((state) => state.selectedAgentImageModel);
export const useSelectedResolution = () => useChatStore((state) => state.selectedResolution);
export const useSelectedAspectRatio = () => useChatStore((state) => state.selectedAspectRatio);
export const useModels = () => useChatStore((state) => state.models);
export const useSelectableModels = () => useChatStore((state) => state.selectableModels);
export const useGenerationPhase = () => useChatStore((state) => state.generationPhase);
export const useIsGenerating = () => useChatStore((state) => {
  const phase = state.generationPhase;
  return phase !== 'idle' && phase !== 'success' && phase !== 'failed' && phase !== 'stopped';
});
export const useChatError = () => useChatStore((state) => state.error);
export const useInsufficientPointsError = () => useChatStore((state) => state.insufficientPointsError);
export const useUserProviderConfigError = () => useChatStore((state) => state.userProviderConfigError);
