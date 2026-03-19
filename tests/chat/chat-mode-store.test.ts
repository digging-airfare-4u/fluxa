import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('chat mode store', () => {
  beforeEach(() => {
    vi.resetModules();
    const storage = new Map<string, string>();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value);
        },
        removeItem: (key: string) => {
          storage.delete(key);
        },
      },
    });
  });

  it('defaults to classic mode and persists agent mode changes', async () => {
    const { useChatStore, CHAT_MODE_STORAGE_KEY } = await import('@/lib/store/useChatStore');

    useChatStore.getState().reset();
    expect(useChatStore.getState().chatMode).toBe('classic');

    useChatStore.getState().setChatMode('agent');

    expect(useChatStore.getState().chatMode).toBe('agent');
    expect(window.localStorage.getItem(CHAT_MODE_STORAGE_KEY)).toBe('agent');
  });

  it('restores chat mode from persisted storage during reset', async () => {
    const { CHAT_MODE_STORAGE_KEY, useChatStore } = await import('@/lib/store/useChatStore');

    window.localStorage.setItem(CHAT_MODE_STORAGE_KEY, 'agent');
    useChatStore.getState().reset();

    expect(useChatStore.getState().chatMode).toBe('agent');
  });

  it('maintains a separate agent image model selection alongside the agent brain model', async () => {
    const { useChatStore } = await import('@/lib/store/useChatStore');

    useChatStore.getState().setSelectableModels([
      {
        value: 'gpt-4o-mini',
        displayName: 'GPT-4o mini',
        type: 'ops',
        isByok: false,
        pointsCost: 10,
        isDefault: true,
        provider: 'openai',
      },
      {
        value: 'gemini-3-pro-image-preview',
        displayName: 'Nano Banana Pro',
        type: 'image',
        isByok: false,
        pointsCost: 40,
        isDefault: false,
        provider: 'google',
      },
    ]);

    useChatStore.getState().setSelectedAgentModel('gpt-4o-mini');
    useChatStore.getState().setSelectedAgentImageModel('gemini-3-pro-image-preview');

    expect(useChatStore.getState().selectedAgentModel).toBe('gpt-4o-mini');
    expect(useChatStore.getState().selectedAgentImageModel).toBe('gemini-3-pro-image-preview');
  });

  it('keeps agent-only anthropic-compatible configs available for agent brain while resetting classic selection to a classic-safe model', async () => {
    const { useChatStore } = await import('@/lib/store/useChatStore');

    useChatStore.getState().reset();
    useChatStore.getState().setSelectedModel('user:cfg-brain');
    useChatStore.getState().setSelectableModels([
      {
        value: 'user:cfg-brain',
        displayName: 'MiniMax Brain',
        type: 'ops',
        isByok: true,
        pointsCost: 0,
        isDefault: false,
        provider: 'anthropic-compatible',
      },
      {
        value: 'gemini-3-pro-image-preview',
        displayName: 'Nano Banana Pro',
        type: 'image',
        isByok: false,
        pointsCost: 40,
        isDefault: true,
        provider: 'google',
      },
    ]);

    expect(useChatStore.getState().selectedModel).toBe('gemini-3-pro-image-preview');
    expect(useChatStore.getState().selectedAgentModel).toBe('user:cfg-brain');
  });
});
