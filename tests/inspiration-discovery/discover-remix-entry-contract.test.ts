import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildRemixEditorUrl } from '@/lib/inspiration/remix';

describe('inspiration-discovery remix entry contract', () => {
  const discoverPage = readFileSync(
    resolve(process.cwd(), 'src/app/app/discover/page.tsx'),
    'utf8'
  );
  const detailPage = readFileSync(
    resolve(process.cwd(), 'src/app/app/discover/[id]/page.tsx'),
    'utf8'
  );
  const card = readFileSync(
    resolve(process.cwd(), 'src/components/discover/PublicationCard.tsx'),
    'utf8'
  );

  it('wires remix action on discover cards', () => {
    expect(discoverPage).toContain('entry: "card"');
    expect(discoverPage).toContain('onRemix');
    expect(card).toContain("t('discover.remix_cta')");
  });

  it('loads snapshot context before remixing from discover cards', () => {
    expect(discoverPage).toContain('fetchPublicationSnapshot');
    expect(discoverPage).toContain('const snapshot = await fetchPublicationSnapshot(publication.id);');
    expect(discoverPage).toContain('messages: snapshot?.messages_snapshot');
  });

  it('wires remix action on publication detail', () => {
    expect(detailPage).toContain('entry: "detail"');
    expect(detailPage).toContain("t('discover.remix_cta')");
    expect(detailPage).toContain('const [snapshot, setSnapshot] = useState<PublicationSnapshot | null>(null);');
    expect(detailPage).toContain('fetchPublicationSnapshot(id)');
    expect(detailPage).toContain('setSnapshot(snap);');
  });

  it('builds card remix URL metadata with source/entry/ref/prompt', () => {
    const remixUrl = buildRemixEditorUrl({
      projectId: 'p_card',
      prompt: 'card remix prompt',
      entry: 'card',
      publicationId: 'pub_card',
    });

    const parsed = new URL(remixUrl, 'https://example.com');
    const params = parsed.searchParams;

    expect(parsed.pathname).toBe('/app/p/p_card');
    expect(params.get('source')).toBe('discover');
    expect(params.get('entry')).toBe('card');
    expect(params.get('ref')).toBe('pub_card');
    expect(params.get('prompt')).toBe('card remix prompt');
  });

  it('builds detail remix URL metadata with source/entry/ref/prompt', () => {
    const remixUrl = buildRemixEditorUrl({
      projectId: 'p_test',
      prompt: 'detail remix prompt',
      entry: 'detail',
      publicationId: 'pub_test',
    });

    const parsed = new URL(remixUrl, 'https://example.com');
    const params = parsed.searchParams;

    expect(parsed.pathname).toBe('/app/p/p_test');
    expect(params.get('source')).toBe('discover');
    expect(params.get('entry')).toBe('detail');
    expect(params.get('ref')).toBe('pub_test');
    expect(params.get('prompt')).toBe('detail remix prompt');
  });

  it('renders detail remix action near detail interactions', () => {
    expect(detailPage).toContain('handleRemixFromDetail');
    expect(detailPage).toContain('entry: "detail"');
    expect(detailPage).toContain("t('discover.remix_cta')");
  });

  it('logs remix funnel events for click and project creation', () => {
    expect(discoverPage).toContain('discover_remix_click');
    expect(discoverPage).toContain('discover_remix_project_created');
    expect(detailPage).toContain('discover_remix_click');
    expect(detailPage).toContain('discover_remix_project_created');
  });
});
