import { describe, expect, it } from 'vitest';
import {
  buildDiscoverImportPlan,
  inferDiscoverCategorySlug,
  normalizeExternalInspirationEntry,
  type ExternalInspirationEntry,
} from '../../scripts/inspiration/lib/discover-import.mjs';

describe('generic discover import mapping', () => {
  it('normalizes NanoBananas-shaped entries into the generic schema', () => {
    const entry = normalizeExternalInspirationEntry({
      source: 'txt2img',
      id: 1,
      title_zh: '创意涂鸦广告设计',
      title_en: 'Creative Doodle Ad Design',
      prompt_zh: '在纯白画布上设计一幅极简创意广告。',
      result_image_url: 'https://img.nanobananas.ai/nano-banana/gallery/txt2img/txt2img-1.webp',
      source_url: 'https://nanobananas.ai/banana-image-prompt',
      slug: 'creative-doodle-ad-design',
      note: '适合广告海报和品牌创意视觉。',
    }, {
      siteKey: '',
      siteName: 'NanoBananas',
    });

    expect(entry.siteKey).toBe('nanobananas');
    expect(entry.entryType).toBe('txt2img');
    expect(entry.externalId).toBe('1');
    expect(entry.importKey).toBe('nanobananas:txt2img:1');
    expect(entry.title).toBe('创意涂鸦广告设计');
    expect(entry.prompt).toBe('在纯白画布上设计一幅极简创意广告。');
    expect(entry.tags).toContain('nanobananas');
  });

  it('prefers explicit generic fields and category hints', () => {
    const entry = normalizeExternalInspirationEntry({
      site_key: 'demo-source',
      site_name: 'Demo Source',
      entry_type: 'template',
      external_id: 'post-1',
      title: 'Holiday Poster',
      prompt: 'Generate a Christmas sale poster.',
      result_image_url: 'https://cdn.example.com/poster.webp',
      source_url: 'https://example.com/poster/1',
      slug: 'holiday-poster',
      category_hint: 'poster-design',
      tags: ['Holiday', 'Seasonal'],
    });

    expect(entry.siteKey).toBe('demo-source');
    expect(entry.tags).toContain('holiday');
    expect(inferDiscoverCategorySlug(entry)).toBe('poster-design');
  });

  it('accepts local-only image entries without a source url', () => {
    const entry = normalizeExternalInspirationEntry({
      site_key: 'local-pack',
      site_name: 'Local Pack',
      entry_type: 'template',
      external_id: '001',
      title: 'Local Poster',
      prompt: '制作一张极简活动海报。',
      result_local_path: 'images/output/local-poster.webp',
      reference_local_path: 'images/input/local-reference.png',
      slug: 'local-poster',
      tags: ['Custom'],
    });

    expect(entry.sourceUrl).toBeNull();
    expect(entry.resultLocalPath).toBe('images/output/local-poster.webp');
    expect(entry.referenceLocalPath).toBe('images/input/local-reference.png');
    expect(entry.resultImageUrl).toBe('');
    expect(entry.tags).toContain('custom');
  });

  it('builds a replayable plan for image-first inspirations', () => {
    const entry: ExternalInspirationEntry = normalizeExternalInspirationEntry({
      site_key: 'demo-source',
      site_name: 'Demo Source',
      entry_type: 'img2img',
      external_id: 'look-7',
      title: 'Vintage Grid Portrait',
      prompt_zh: '基于上传参考图生成 3x3 竖版写真网格。',
      result_image_url: 'https://cdn.example.com/output.webp',
      reference_image_url: 'https://cdn.example.com/reference.webp',
      source_url: 'https://example.com/look-7',
      slug: 'vintage-grid-portrait',
      note: '需要先上传一张半身人像参考图。',
    });
    const ids = ['project-1', 'document-1', 'conversation-1', 'message-1', 'message-2', 'message-3', 'publication-1', 'snapshot-1', 'op-1', 'layer-1'];
    const plan = buildDiscoverImportPlan(entry, {
      userId: 'user-1',
      categoryId: 'category-social',
      publishedAt: '2026-04-03T10:00:00.000Z',
      createId: () => ids.shift() ?? crypto.randomUUID(),
    });

    expect(plan.importKey).toBe('demo-source:img2img:look-7');
    expect(plan.publication.cover_image_url).toBe('https://cdn.example.com/output.webp');
    expect(plan.publication.tags).toContain('demo-source:img2img:look-7');
    expect(plan.messages).toHaveLength(3);
    expect(plan.messages[0]).toMatchObject({
      role: 'user',
      metadata: {
        imageUrl: 'https://cdn.example.com/reference.webp',
      },
    });
    expect(plan.snapshot.messages_snapshot).toEqual(
      plan.messages.map(({ conversation_id, ...message }) => message),
    );
    expect(plan.snapshot.ops_snapshot[0]).toMatchObject({
      op_type: 'addImage',
      payload: {
        src: 'https://cdn.example.com/output.webp',
      },
    });
  });

  it('omits sourceUrl metadata when the item has no web source', () => {
    const entry: ExternalInspirationEntry = {
      ...normalizeExternalInspirationEntry({
        site_key: 'local-pack',
        site_name: 'Local Pack',
        entry_type: 'template',
        external_id: 'poster-2',
        title: 'Local Poster Two',
        prompt: '制作一张活动海报。',
        result_image_url: 'https://cdn.example.com/local-poster-two.webp',
        slug: 'local-poster-two',
      }),
      sourceUrl: null,
    };
    const ids = ['project-3', 'document-3', 'conversation-3', 'message-6', 'message-7', 'publication-3', 'snapshot-3', 'op-3', 'layer-3'];
    const plan = buildDiscoverImportPlan(entry, {
      userId: 'user-3',
      categoryId: 'category-poster',
      publishedAt: '2026-04-03T10:00:02.000Z',
      createId: () => ids.shift() ?? crypto.randomUUID(),
    });

    expect(plan.messages[1].metadata).not.toHaveProperty('sourceUrl');
  });
});
