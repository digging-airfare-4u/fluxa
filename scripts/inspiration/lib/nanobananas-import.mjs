/**
 * NanoBananas prompt import helpers.
 * Builds fake project/conversation/publication rows so prompts can reuse
 * the current discovery UI without frontend changes.
 */

const DEFAULT_WIDTH = 1080;
const DEFAULT_HEIGHT = 1350;

/**
 * @typedef {Object} NanobananaPromptEntry
 * @property {'txt2img'|'img2img'} source
 * @property {number} id
 * @property {string} title_zh
 * @property {string} title_en
 * @property {string} prompt_en
 * @property {string} prompt_zh
 * @property {string} result_image_url
 * @property {string|null} reference_image_url
 * @property {string|null} note
 * @property {boolean} requires_reference_image
 * @property {string} source_url
 * @property {string} slug
 * @property {string} result_local_path
 * @property {string|null} reference_local_path
 */

/**
 * @typedef {Object} BuildImportPlanOptions
 * @property {string} userId
 * @property {string} categoryId
 * @property {string} publishedAt
 * @property {() => string} [createId]
 */

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function truncateTitle(entry) {
  const preferred = normalizeText(entry.title_zh) || normalizeText(entry.title_en) || `NanoBananas ${entry.id}`;
  return preferred.slice(0, 50);
}

function buildImportKey(entry) {
  return `nanobananas:${entry.source}:${entry.id}`;
}

function shiftIsoDate(iso, seconds) {
  const base = new Date(iso);
  return new Date(base.getTime() + seconds * 1000).toISOString();
}

function buildSearchText(entry) {
  return [
    entry.source,
    entry.title_zh,
    entry.title_en,
    entry.prompt_zh,
    entry.prompt_en,
    entry.note,
    entry.slug,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function includesAny(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword));
}

function buildPromptText(entry) {
  return normalizeText(entry.prompt_zh) || normalizeText(entry.prompt_en) || truncateTitle(entry);
}

function buildAssistantText(entry) {
  return normalizeText(entry.note)
    || (entry.source === 'img2img'
      ? 'NanoBananas image-to-image prompt sample result.'
      : 'NanoBananas text-to-image prompt sample result.');
}

function buildLayerId(rawId) {
  return `layer-${String(rawId).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24) || 'imported'}`;
}

/**
 * Infer a discovery category slug from the prompt content.
 *
 * @param {NanobananaPromptEntry} entry
 * @returns {string}
 */
export function inferNanobananaCategorySlug(entry) {
  const text = buildSearchText(entry);

  if (includesAny(text, ['holiday', 'christmas', 'new year', 'festival', '节日', '贺卡'])) {
    return 'holiday-card';
  }

  if (includesAny(text, ['invitation', 'invite', '邀请函', '请柬'])) {
    return 'invitation';
  }

  if (includesAny(text, ['poster', 'advertisement', 'ad design', '海报', '广告'])) {
    return 'poster-design';
  }

  if (includesAny(text, ['business card', 'brand', 'logo', 'branding', '名片', '品牌', '品牌标志'])) {
    return 'branding';
  }

  if (includesAny(text, ['product', 'e-commerce', 'ecommerce', 'wrist rest', 'pendant', 'packaging', '商品', '电商', '产品'])) {
    return 'ecommerce';
  }

  if (includesAny(text, ['selfie', 'photo grid', 'grid', 'pinterest', 'editorial', 'social media', '自拍', '写真', '网格', '社交'])) {
    return 'social-media';
  }

  return 'illustration';
}

/**
 * Build related fake rows for a NanoBananas prompt so it can be rendered by
 * the existing discovery/publication pages.
 *
 * @param {NanobananaPromptEntry} entry
 * @param {BuildImportPlanOptions} options
 */
export function buildNanobananaImportPlan(entry, options) {
  const createId = options.createId ?? (() => crypto.randomUUID());
  const importKey = buildImportKey(entry);
  const title = truncateTitle(entry);
  const projectId = createId();
  const documentId = createId();
  const conversationId = createId();
  const referenceMessageId = entry.reference_image_url ? createId() : null;
  const promptMessageId = createId();
  const assistantMessageId = createId();
  const publicationId = createId();
  const snapshotId = createId();
  const opId = createId();
  const layerId = buildLayerId(createId());
  const categorySlug = inferNanobananaCategorySlug(entry);
  const tags = unique([
    'nanobananas',
    entry.source,
    categorySlug,
    entry.slug,
    importKey,
    entry.requires_reference_image ? 'reference-image' : '',
  ]);
  const description = normalizeText(entry.note) || `${entry.source} prompt template from NanoBananas.`;
  const promptText = buildPromptText(entry);
  const assistantText = buildAssistantText(entry);
  const addImagePayload = {
    id: layerId,
    src: entry.result_image_url,
    x: 0,
    y: 0,
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
  };

  const messages = [];

  if (entry.reference_image_url && referenceMessageId) {
    messages.push({
      id: referenceMessageId,
      conversation_id: conversationId,
      role: 'user',
      content: '参考图',
      metadata: {
        imageUrl: entry.reference_image_url,
        source: 'nanobananas',
        kind: 'reference-image',
      },
      created_at: shiftIsoDate(options.publishedAt, 0),
    });
  }

  messages.push({
    id: promptMessageId,
    conversation_id: conversationId,
    role: 'user',
    content: promptText,
    metadata: null,
    created_at: shiftIsoDate(options.publishedAt, messages.length),
  });

  messages.push({
    id: assistantMessageId,
    conversation_id: conversationId,
    role: 'assistant',
    content: assistantText,
    metadata: {
      imageUrl: entry.result_image_url,
      source: 'nanobananas',
      sourceUrl: entry.source_url,
      modelName: 'NanoBananas',
      op: {
        type: 'addImage',
        payload: addImagePayload,
      },
    },
    created_at: shiftIsoDate(options.publishedAt, messages.length),
  });

  const snapshotMessages = messages.map(({ conversation_id, ...message }) => message);

  const ops = [
    {
      id: opId,
      document_id: documentId,
      conversation_id: conversationId,
      message_id: assistantMessageId,
      seq: 1,
      op_type: 'addImage',
      payload: addImagePayload,
      created_at: shiftIsoDate(options.publishedAt, messages.length),
    },
  ];

  return {
    importKey,
    categorySlug,
    project: {
      id: projectId,
      user_id: options.userId,
      name: `NanoBananas / ${title}`.slice(0, 120),
      created_at: options.publishedAt,
      updated_at: options.publishedAt,
    },
    document: {
      id: documentId,
      project_id: projectId,
      name: title,
      canvas_state: null,
      width: DEFAULT_WIDTH,
      height: DEFAULT_HEIGHT,
      created_at: options.publishedAt,
      updated_at: options.publishedAt,
    },
    conversation: {
      id: conversationId,
      project_id: projectId,
      document_id: documentId,
      created_at: options.publishedAt,
      last_generated_asset_id: null,
      provider_context: {
        source: 'nanobananas',
        importKey,
        requiresReferenceImage: entry.requires_reference_image,
      },
    },
    messages,
    ops,
    publication: {
      id: publicationId,
      user_id: options.userId,
      project_id: projectId,
      document_id: documentId,
      conversation_id: conversationId,
      title,
      description,
      cover_image_url: entry.result_image_url,
      category_id: options.categoryId,
      tags,
      status: 'published',
      view_count: 0,
      like_count: 0,
      comment_count: 0,
      bookmark_count: 0,
      published_at: options.publishedAt,
      created_at: options.publishedAt,
      updated_at: options.publishedAt,
    },
    snapshot: {
      id: snapshotId,
      publication_id: publicationId,
      messages_snapshot: snapshotMessages,
      ops_snapshot: ops.map(({ document_id, conversation_id, message_id, ...op }) => op),
      canvas_state_snapshot: null,
      canvas_width: DEFAULT_WIDTH,
      canvas_height: DEFAULT_HEIGHT,
      created_at: options.publishedAt,
    },
  };
}
