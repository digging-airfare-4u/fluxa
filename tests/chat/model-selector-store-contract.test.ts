import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('model selector shared store contract', () => {
  it('uses the shared selectable model store instead of fetching provider configs on mount', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/chat/ModelSelector.tsx'),
      'utf8',
    );

    expect(source).toContain("from '@/lib/store/useChatStore'");
    expect(source).toContain('useSelectableModels()');
    expect(source).not.toContain('fetchModels');
    expect(source).not.toContain('fetchUserProviderConfigs');
    expect(source).not.toContain('loadModels = useCallback');
  });
});
