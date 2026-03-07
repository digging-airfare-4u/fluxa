import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('inspiration-discovery PublishForm contract', () => {
  it('contains publish/update flow and existing publication detection', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/share/PublishForm.tsx'),
      'utf8'
    );

    expect(source).toContain('fetchExistingPublication');
    expect(source).toContain('publishConversation');
    expect(source).toContain('updatePublicationSnapshot');
    expect(source).toContain("t('share.update_button')");
    expect(source).toContain("t('share.publish_button')");
  });
});
