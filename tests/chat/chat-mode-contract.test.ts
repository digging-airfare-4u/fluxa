import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('chat mode contract', () => {
  it('adds a classic/agent mode selector in ChatInput and only exposes the image selector in agent mode', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/chat/ChatInput.tsx'),
      'utf8',
    );

    expect(source).toContain("chatMode?: 'classic' | 'agent'");
    expect(source).toContain('onChatModeChange?: (mode: ChatMode) => void');
    expect(source).toContain('selectedAgentImageModel?: string');
    expect(source).toContain('onAgentImageModelChange?: (model: string) => void');
    expect(source).toContain("['classic', 'agent']");
    expect(source).toContain("chatMode === 'classic' ? (");
    expect(source).toContain("allowedTypes={['image']}");
    expect(source).not.toContain("tooltipLabel={t('model_selector.agent_brain')}");
    expect(source).toContain('showPricing={false}');
  });

  it('routes agent mode through the new agent generation path in ChatPanel', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/chat/ChatPanel.tsx'),
      'utf8',
    );

    expect(source).toContain('chatMode');
    expect(source).toContain('startAgentGeneration');
    expect(source).toContain("if (chatMode === 'agent')");
    expect(source).toContain("imageModel: chatMode === 'agent' ? selectedAgentImageModel : undefined");
    expect(source).toContain('onPendingUpdated: updateMessage');
  });

  it('forces agent mode when entering the project chat panel', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/chat/ChatPanel.tsx'),
      'utf8',
    );

    expect(source).toMatch(/useEffect\(\(\) => \{\s*setChatMode\('agent'\);\s*\}, \[conversationId, setChatMode\]\);/);
  });

  it('does not forward the hidden agent brain selection in agent mode requests', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/chat/ChatPanel.tsx'),
      'utf8',
    );

    expect(source).toContain("model: chatMode === 'agent' ? undefined : currentModel");
  });

  it('exits loading state when agent or classic generation hits a generic transport error', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/chat/ChatPanel.tsx'),
      'utf8',
    );

    expect(source).toContain('failGeneration(err instanceof Error ? err.message : \'Failed to send message\')');
    expect(source).toContain('clearPendingMessages();');
  });
});
