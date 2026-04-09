/**
 * Generic external inspiration import helpers.
 * Builds fake project/conversation/publication rows so external inspiration
 * libraries can reuse the current discovery UI without frontend changes.
 */

const DEFAULT_WIDTH = 1080;
const DEFAULT_HEIGHT = 1350;

/**
 * @typedef {Object} ExternalInspirationEntry
 * @property {string} siteKey
 * @property {string} siteName
 * @property {string} entryType
 * @property {string} externalId
 * @property {string} importKey
 * @property {string} title
 * @property {string} titleZh
 * @property {string} titleEn
 * @property {string} prompt
 * @property {string} promptZh
 * @property {string} promptEn
 * @property {string} resultImageUrl
 * @property {string} resultLocalPath
 * @property {string|null} referenceImageUrl
 * @property {string} referenceLocalPath
 * @property {string} note
 * @property {boolean} requiresReferenceImage
 * @property {string|null} sourceUrl
 * @property {string} slug
 * @property {string[]} tags
 * @property {string} categoryHint
 * @property {string|null} publishedAt
 */

/**
 * @typedef {Object} NormalizeExternalInspirationOptions
 * @property {string} [siteKey]
 * @property {string} [siteName]
 * @property {string} [sourceUrl]
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

function normalizeSlug(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function buildFallbackTitle(siteName, externalId) {
  return [siteName, externalId].filter(Boolean).join(' ').trim() || 'Imported inspiration';
}

function truncateTitle(entry) {
  const preferred = unique([
    normalizeText(entry.title),
    normalizeText(entry.titleZh),
    normalizeText(entry.titleEn),
  ])[0] ?? buildFallbackTitle(entry.siteName, entry.externalId);

  return preferred.slice(0, 50);
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return unique(value.map((item) => normalizeSlug(String(item))));
}

function normalizeLocalPath(value) {
  return normalizeText(value);
}

function maybeUrl(value) {
  const normalized = normalizeText(value);

  if (!normalized) {
    return '';
  }

  try {
    return new URL(normalized).toString();
  } catch {
    return '';
  }
}

function inferSiteKeyFromUrl(value) {
  const normalizedUrl = maybeUrl(value);

  if (!normalizedUrl) {
    return '';
  }

  try {
    const { hostname } = new URL(normalizedUrl);
    const parts = hostname
      .split('.')
      .map((part) => normalizeSlug(part))
      .filter(Boolean);

    if (parts.length >= 2) {
      return parts.at(-2) ?? '';
    }

    return parts[0] ?? '';
  } catch {
    return '';
  }
}

function coerceBoolean(value, fallback = false) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes'].includes(normalized)) {
      return true;
    }
    if (['false', '0', 'no'].includes(normalized)) {
      return false;
    }
  }

  return fallback;
}

function normalizeDate(value) {
  const normalized = normalizeText(value);

  if (!normalized) {
    return null;
  }

  const parsed = new Date(normalized);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

function shiftIsoDate(iso, seconds) {
  const base = new Date(iso);
  return new Date(base.getTime() + seconds * 1000).toISOString();
}

function buildSearchText(entry) {
  return [
    entry.entryType,
    entry.title,
    entry.titleZh,
    entry.titleEn,
    entry.prompt,
    entry.promptZh,
    entry.promptEn,
    entry.note,
    entry.slug,
    ...(entry.tags ?? []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function includesAny(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword));
}

function buildLayerId(rawId) {
  return `layer-${String(rawId).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24) || 'imported'}`;
}

function assertRequired(value, label, rawEntry) {
  if (!value) {
    const rawId = rawEntry?.external_id ?? rawEntry?.id ?? rawEntry?.slug ?? 'unknown';
    throw new Error(`Missing ${label} for entry ${rawId}`);
  }
}

/**
 * Normalize arbitrary scraped inspiration data into the generic import schema.
 *
 * Accepts both generic keys (`site_key`, `entry_type`, `external_id`) and the
 * legacy NanoBananas-shaped keys (`source`, `id`, `title_zh`, `result_image_url`).
 *
 * @param {Record<string, unknown>} rawEntry
 * @param {NormalizeExternalInspirationOptions} [options]
 * @returns {ExternalInspirationEntry}
 */
export function normalizeExternalInspirationEntry(rawEntry, options = {}) {
  const sourceUrl = maybeUrl(
    rawEntry.source_url
      ?? rawEntry.sourceUrl
      ?? rawEntry.url
      ?? options.sourceUrl
      ?? '',
  ) || null;
  const siteKey = normalizeSlug(rawEntry.site_key ?? rawEntry.siteKey ?? '')
    || normalizeSlug(options.siteKey)
    || inferSiteKeyFromUrl(sourceUrl);
  const siteName = normalizeText(rawEntry.site_name ?? rawEntry.siteName ?? '')
    || normalizeText(options.siteName)
    || siteKey;
  const entryType = normalizeSlug(
    rawEntry.entry_type
      ?? rawEntry.entryType
      ?? rawEntry.source
      ?? rawEntry.type
      ?? 'item',
  ) || 'item';
  const externalId = normalizeText(
    String(
      rawEntry.external_id
        ?? rawEntry.externalId
        ?? rawEntry.id
        ?? rawEntry.slug
        ?? '',
    ),
  );
  const title = normalizeText(rawEntry.title ?? rawEntry.title_zh ?? rawEntry.title_en ?? '');
  const titleZh = normalizeText(rawEntry.title_zh ?? rawEntry.titleZh ?? '');
  const titleEn = normalizeText(rawEntry.title_en ?? rawEntry.titleEn ?? '');
  const prompt = normalizeText(rawEntry.prompt ?? rawEntry.prompt_zh ?? rawEntry.prompt_en ?? '');
  const promptZh = normalizeText(rawEntry.prompt_zh ?? rawEntry.promptZh ?? '');
  const promptEn = normalizeText(rawEntry.prompt_en ?? rawEntry.promptEn ?? '');
  const resultImageUrl = maybeUrl(
    rawEntry.result_image_url
      ?? rawEntry.resultImageUrl
      ?? rawEntry.cover_image_url
      ?? rawEntry.coverImageUrl
      ?? rawEntry.image_url
      ?? rawEntry.imageUrl
      ?? '',
  );
  const resultLocalPath = normalizeLocalPath(
    rawEntry.result_local_path
      ?? rawEntry.resultLocalPath
      ?? rawEntry.cover_local_path
      ?? rawEntry.coverLocalPath
      ?? rawEntry.image_local_path
      ?? rawEntry.imageLocalPath
      ?? '',
  );
  const referenceImageUrl = maybeUrl(
    rawEntry.reference_image_url
      ?? rawEntry.referenceImageUrl
      ?? rawEntry.reference_url
      ?? rawEntry.referenceUrl
      ?? '',
  ) || null;
  const referenceLocalPath = normalizeLocalPath(
    rawEntry.reference_local_path
      ?? rawEntry.referenceLocalPath
      ?? '',
  );
  const note = normalizeText(rawEntry.note ?? rawEntry.description ?? '');
  const requiresReferenceImage = coerceBoolean(
    rawEntry.requires_reference_image ?? rawEntry.requiresReferenceImage,
    Boolean(referenceImageUrl),
  );
  const slug = normalizeSlug(
    rawEntry.slug
      ?? rawEntry.item_slug
      ?? rawEntry.itemSlug
      ?? title
      ?? `${entryType}-${externalId}`,
  );
  const categoryHint = normalizeSlug(
    rawEntry.category_hint
      ?? rawEntry.categoryHint
      ?? rawEntry.category_slug
      ?? rawEntry.categorySlug
      ?? '',
  );
  const publishedAt = normalizeDate(rawEntry.published_at ?? rawEntry.created_at ?? '');

  assertRequired(siteKey, 'site_key', rawEntry);
  assertRequired(externalId, 'external_id', rawEntry);
  if (!resultImageUrl && !resultLocalPath) {
    assertRequired('', 'result_image_url or result_local_path', rawEntry);
  }
  assertRequired(slug, 'slug', rawEntry);

  const normalizedTitle = title || titleZh || titleEn || buildFallbackTitle(siteName, externalId);
  const normalizedPrompt = prompt || promptZh || promptEn || normalizedTitle;
  const importKey = `${siteKey}:${entryType}:${externalId}`;
  const tags = unique([
    siteKey,
    entryType,
    slug,
    importKey,
    requiresReferenceImage ? 'reference-image' : '',
    ...normalizeStringArray(rawEntry.tags),
  ]);

  return {
    siteKey,
    siteName: siteName || siteKey,
    entryType,
    externalId,
    importKey,
    title: normalizedTitle,
    titleZh,
    titleEn,
    prompt: normalizedPrompt,
    promptZh,
    promptEn,
    resultImageUrl,
    resultLocalPath,
    referenceImageUrl,
    referenceLocalPath,
    note,
    requiresReferenceImage,
    sourceUrl,
    slug,
    tags,
    categoryHint,
    publishedAt,
  };
}

/**
 * Infer a discovery category slug from an external inspiration entry.
 *
 * @param {ExternalInspirationEntry} entry
 * @returns {string}
 */
export function inferDiscoverCategorySlug(entry) {
  if (entry.categoryHint) {
    return entry.categoryHint;
  }

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

function buildPromptText(entry) {
  return unique([
    normalizeText(entry.promptZh),
    normalizeText(entry.promptEn),
    normalizeText(entry.prompt),
    truncateTitle(entry),
  ])[0];
}

function buildAssistantText(entry) {
  return normalizeText(entry.note)
    || `${entry.siteName} inspiration sample result.`;
}

/**
 * Build related fake rows for a normalized inspiration entry so it can be rendered by
 * the existing discovery/publication pages.
 *
 * @param {ExternalInspirationEntry} entry
 * @param {BuildImportPlanOptions} options
 */
export function buildDiscoverImportPlan(entry, options) {
  const createId = options.createId ?? (() => crypto.randomUUID());
  const title = truncateTitle(entry);
  const projectId = createId();
  const documentId = createId();
  const conversationId = createId();
  const referenceMessageId = entry.referenceImageUrl ? createId() : null;
  const promptMessageId = createId();
  const assistantMessageId = createId();
  const publicationId = createId();
  const snapshotId = createId();
  const opId = createId();
  const layerId = buildLayerId(createId());
  const categorySlug = inferDiscoverCategorySlug(entry);
  const description = normalizeText(entry.note) || `${entry.siteName} prompt template.`;
  const promptText = buildPromptText(entry);
  const assistantText = buildAssistantText(entry);
  const tags = unique([
    ...entry.tags,
    categorySlug,
  ]);
  const addImagePayload = {
    id: layerId,
    src: entry.resultImageUrl,
    x: 0,
    y: 0,
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
  };

  const messages = [];

  if (entry.referenceImageUrl && referenceMessageId) {
    messages.push({
      id: referenceMessageId,
      conversation_id: conversationId,
      role: 'user',
      content: '参考图',
      metadata: {
        imageUrl: entry.referenceImageUrl,
        source: entry.siteKey,
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

  const assistantMetadata = {
    imageUrl: entry.resultImageUrl,
    source: entry.siteKey,
    modelName: entry.siteName,
    op: {
      type: 'addImage',
      payload: addImagePayload,
    },
  };

  if (entry.sourceUrl) {
    assistantMetadata.sourceUrl = entry.sourceUrl;
  }

  messages.push({
    id: assistantMessageId,
    conversation_id: conversationId,
    role: 'assistant',
    content: assistantText,
    metadata: assistantMetadata,
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
    importKey: entry.importKey,
    categorySlug,
    project: {
      id: projectId,
      user_id: options.userId,
      name: `${entry.siteName} / ${title}`.slice(0, 120),
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
        source: entry.siteKey,
        importKey: entry.importKey,
        requiresReferenceImage: entry.requiresReferenceImage,
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
      cover_image_url: entry.resultImageUrl,
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
