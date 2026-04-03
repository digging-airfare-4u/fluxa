import { describe, expect, it } from 'vitest';
import {
  buildNanobananaImportPlan,
  inferNanobananaCategorySlug,
  type NanobananaPromptEntry,
} from '../../scripts/inspiration/lib/nanobananas-import.mjs';

const txt2imgEntry: NanobananaPromptEntry = {
  source: 'txt2img',
  id: 1,
  title_zh: '创意涂鸦广告设计',
  title_en: 'Creative Doodle Ad Design',
  prompt_en:
    'Design a minimalist creative advertisement on a pristine white canvas for a coffee brand.',
  prompt_zh:
    '在纯白画布上设计一幅极简创意广告，突出品牌广告文案与产品主体。',
  result_image_url: 'https://img.nanobananas.ai/nano-banana/gallery/txt2img/txt2img-1.webp',
  reference_image_url: null,
  note: '适合广告海报和品牌创意视觉。',
  requires_reference_image: false,
  source_url: 'https://nanobananas.ai/banana-image-prompt',
  slug: 'creative-doodle-ad-design',
  result_local_path: 'images/txt2img/txt2img-1.webp',
  reference_local_path: null,
};

const img2imgEntry: NanobananaPromptEntry = {
  source: 'img2img',
  id: 1,
  title_zh: '复古花园写真3x3网格',
  title_en: 'Vintage Garden Portrait 3x3 Grid',
  prompt_en:
    'Based on the uploaded portrait photo, create an editorial 3x3 photo grid with Pinterest aesthetic.',
  prompt_zh:
    '基于上传的人像参考图，生成 Pinterest 风格的 3x3 竖版写真网格。',
  result_image_url: 'https://img.nanobananas.ai/nano-banana/gallery/img2img/img2img-out1.webp',
  reference_image_url: 'https://img.nanobananas.ai/nano-banana/gallery/img2img/img2img-in1.webp',
  note: 'Upload a portrait photo as reference.',
  requires_reference_image: true,
  source_url: 'https://nanobananas.ai/banana-image-prompt',
  slug: 'vintage-garden-portrait-3x3-grid',
  result_local_path: 'images/img2img/output/img2img-out1.webp',
  reference_local_path: 'images/img2img/input/img2img-in1.webp',
};

const socialEntry: NanobananaPromptEntry = {
  source: 'txt2img',
  id: 2,
  title_zh: '动物三人自拍合照',
  title_en: 'Animal Trio Selfie',
  prompt_en:
    'Capture a charming close-up selfie featuring three pandas displaying distinct expressions in front of the iconic Eiffel Tower during golden hour. Position them intimately with heads touching, mimicking a genuine selfie pose. The backdrop showcases the full architectural magnificence of Eiffel Tower, bathed in warm, cinematic lighting with soft ambient glow. Rendered in a photorealistic cartoon aesthetic with rich detail. Square 1:1 aspect ratio.',
  prompt_zh:
    '捕捉三只熊猫展示不同表情，在标志性埃菲尔铁塔前拍摄的迷人特写自拍，在黄金时段。将它们亲密地放置在一起，头部相互接触，模仿真实的自拍姿势。背景展示埃菲尔铁塔的完整建筑宏伟，沐浴在温暖的电影级灯光和柔和的环境光晕中。以照片级写实的卡通美学渲染，细节丰富。正方形 1:1 纵横比。',
  result_image_url: 'https://img.nanobananas.ai/nano-banana/gallery/txt2img/txt2img-2.webp',
  reference_image_url: null,
  note: '自定义 pandas (动物类型) 和 Eiffel Tower (地标建筑)。例如：熊猫→猫/狗/兔子 | 埃菲尔铁塔→自由女神像/长城/富士山',
  requires_reference_image: false,
  source_url: 'https://nanobananas.ai/banana-image-prompt',
  slug: 'animal-trio-selfie',
  result_local_path: 'images/txt2img/txt2img-2.webp',
  reference_local_path: null,
};

describe('NanoBananas import mapping', () => {
  it('infers category slugs from prompt intent', () => {
    expect(inferNanobananaCategorySlug(txt2imgEntry)).toBe('poster-design');
    expect(inferNanobananaCategorySlug(img2imgEntry)).toBe('social-media');
    expect(inferNanobananaCategorySlug(socialEntry)).toBe('social-media');
  });

  it('builds a replayable import plan for text-to-image prompts', () => {
    const ids = ['project-1', 'document-1', 'conversation-1', 'message-1', 'message-2', 'publication-1', 'snapshot-1', 'op-1', 'layer-1'];
    const plan = buildNanobananaImportPlan(txt2imgEntry, {
      userId: 'user-1',
      categoryId: 'category-illustration',
      publishedAt: '2026-04-02T10:00:00.000Z',
      createId: () => ids.shift() ?? crypto.randomUUID(),
    });

    expect(plan.publication.title).toBe('创意涂鸦广告设计');
    expect(plan.publication.tags).toContain('nanobananas');
    expect(plan.publication.tags).toContain('nanobananas:txt2img:1');
    expect(plan.messages).toHaveLength(2);
    expect(plan.messages[0]).toMatchObject({
      role: 'user',
      content: txt2imgEntry.prompt_zh,
    });
    expect(plan.messages[1]).toMatchObject({
      role: 'assistant',
      content: txt2imgEntry.note,
    });
    expect(plan.messages[1].metadata).toMatchObject({
      imageUrl: txt2imgEntry.result_image_url,
    });
    expect(plan.snapshot.messages_snapshot).toEqual(
      plan.messages.map(({ conversation_id, ...message }) => message),
    );
    expect(plan.snapshot.ops_snapshot).toHaveLength(1);
  });

  it('keeps reference images in replay for image-to-image prompts', () => {
    const ids = ['project-2', 'document-2', 'conversation-2', 'message-3', 'message-4', 'message-5', 'publication-2', 'snapshot-2', 'op-2', 'layer-2'];
    const plan = buildNanobananaImportPlan(img2imgEntry, {
      userId: 'user-2',
      categoryId: 'category-social',
      publishedAt: '2026-04-02T10:00:01.000Z',
      createId: () => ids.shift() ?? crypto.randomUUID(),
    });

    expect(plan.messages).toHaveLength(3);
    expect(plan.messages[0]).toMatchObject({
      role: 'user',
      content: '参考图',
      metadata: {
        imageUrl: img2imgEntry.reference_image_url,
      },
    });
    expect(plan.messages[1].content).toBe(img2imgEntry.prompt_zh);
    expect(plan.publication.description).toBe(img2imgEntry.note);
    expect(plan.publication.cover_image_url).toBe(img2imgEntry.result_image_url);
  });
});
