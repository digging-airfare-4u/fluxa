import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('chat empty state starter prompts contract', () => {
  it('supports controlled draft input in ChatInput', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/chat/ChatInput.tsx'),
      'utf8',
    );

    expect(source).toContain('value?: string');
    expect(source).toContain('onValueChange?: (value: string) => void');
    expect(source).toContain('value: controlledValue');
    expect(source).toContain("typeof controlledValue === 'string' ? controlledValue : internalMessage");
    expect(source).toContain('onValueChange?.(newValue);');
  });

  it('renders starter prompt cards in the ChatPanel empty state and wires them into the draft input', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/chat/ChatPanel.tsx'),
      'utf8',
    );

    expect(source).toContain('const [draftMessage, setDraftMessage] = useState(\'\')');
    expect(source).toContain('const starterPrompts = [');
    expect(source).toContain("chatMode === 'classic'");
    expect(source).toContain("t(`starter_prompts.${chatMode}.");
    expect(source).toContain("t('empty_state.suggestions_title')");
    expect(source).toContain("t('empty_state.suggestions_hint')");
    expect(source).toContain('onClick={() => setDraftMessage(prompt.prompt)}');
    expect(source).toContain('value={draftMessage}');
    expect(source).toContain('onValueChange={setDraftMessage}');
    expect(source).not.toContain(`<Image src="/logo.png" alt={t('panel.title')} width={64} height={64} className="size-16 rounded-2xl mb-4" />`);
    expect(source).not.toContain(`<h3 className="font-semibold mb-2">{t('empty_state.title')}</h3>`);
  });

  it('defines starter prompt translations for both locales', () => {
    const zhSource = readFileSync(
      resolve(process.cwd(), 'src/locales/zh-CN/chat.json'),
      'utf8',
    );
    const enSource = readFileSync(
      resolve(process.cwd(), 'src/locales/en-US/chat.json'),
      'utf8',
    );

    expect(zhSource).toContain('"suggestions_title"');
    expect(zhSource).toContain('"starter_prompts"');
    expect(zhSource).toContain('"classic"');
    expect(zhSource).toContain('"agent"');

    expect(enSource).toContain('"suggestions_title"');
    expect(enSource).toContain('"starter_prompts"');
    expect(enSource).toContain('"classic"');
    expect(enSource).toContain('"agent"');
  });
});
