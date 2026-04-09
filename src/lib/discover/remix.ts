/**
 * Remix prompt helpers
 * Prefer original user prompts captured in publication snapshots before falling back
 * to summary metadata so discover remix can recreate the source work more faithfully.
 */

import {
  getCachedPublicationSnapshotMessages,
  type PublicationSnapshotMessage,
} from '@/lib/discover/publication-snapshot-cache';

export type RemixEntry = 'card' | 'detail';
export type RemixSourceMessage = PublicationSnapshotMessage;

interface BuildRemixPromptInput {
  title: string;
  categoryName?: string | null;
  tags?: string[] | null;
  description?: string | null;
  messages?: RemixSourceMessage[] | null;
  maxLength?: number;
}

interface BuildRemixEditorUrlInput {
  projectId: string;
  prompt: string;
  entry: RemixEntry;
  publicationId: string;
}

const FALLBACK_PROMPT =
  'Generate an editable version inspired by this work, preserving the overall style direction.';
const REFERENCE_IMAGE_LABELS = new Set(['参考图', 'reference image', 'reference']);

function clampPrompt(text: string, maxLength?: number): string {
  const limit = maxLength ?? 700;
  return text.length > limit ? text.slice(0, limit) : text;
}

function hasReferenceImageMetadata(metadata: RemixSourceMessage['metadata']): boolean {
  if (!metadata) return false;

  if (metadata.kind === 'reference-image') return true;
  if (typeof metadata.imageUrl === 'string' && metadata.imageUrl.trim()) return true;
  if (Array.isArray(metadata.images) && metadata.images.length > 0) return true;

  const op = metadata.op;
  if (!op || typeof op !== 'object') return false;

  const payload = (op as { payload?: unknown }).payload;
  if (!payload || typeof payload !== 'object') return false;

  return typeof (payload as { src?: unknown }).src === 'string';
}

function isSubstantiveUserPrompt(message: RemixSourceMessage): boolean {
  if (message.role !== 'user') return false;

  const content = message.content.trim();
  if (!content) return false;

  if (REFERENCE_IMAGE_LABELS.has(content.toLowerCase())) return false;
  if (hasReferenceImageMetadata(message.metadata) && content.length <= 12) return false;

  return true;
}

function getPublicationIdFromLocation(): string | null {
  if (typeof window === 'undefined') return null;

  const match = window.location.pathname.match(/^\/app\/discover\/([^/?#]+)/);
  if (!match?.[1]) return null;

  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function resolveSourceMessages(inputMessages?: RemixSourceMessage[] | null): RemixSourceMessage[] {
  if (inputMessages?.length) {
    return inputMessages;
  }

  const publicationId = getPublicationIdFromLocation();
  if (!publicationId) {
    return [];
  }

  return getCachedPublicationSnapshotMessages(publicationId) ?? [];
}

export function findLatestRemixSourceMessage(
  messages: RemixSourceMessage[] | null | undefined,
): RemixSourceMessage | null {
  if (!messages?.length) return null;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (isSubstantiveUserPrompt(message)) {
      return message;
    }
  }

  return null;
}

export function buildRemixPrompt(input: BuildRemixPromptInput): string {
  const sourceMessage = findLatestRemixSourceMessage(resolveSourceMessages(input.messages));
  if (sourceMessage) {
    return clampPrompt(sourceMessage.content.trim(), input.maxLength);
  }

  const parts: string[] = [];

  if (input.title?.trim()) {
    parts.push(`Title: ${input.title.trim()}`);
  }

  if (input.categoryName?.trim()) {
    parts.push(`Category: ${input.categoryName.trim()}`);
  }

  if (input.tags?.length) {
    const tags = input.tags
      .map((tag) => tag?.trim())
      .filter((tag): tag is string => Boolean(tag));

    if (tags.length > 0) {
      parts.push(`Tags: ${tags.join(', ')}`);
    }
  }

  if (input.description?.trim()) {
    parts.push(`Description: ${input.description.trim()}`);
  }

  if (parts.length === 0) {
    return clampPrompt(FALLBACK_PROMPT, input.maxLength);
  }

  parts.push('Task: Keep the style direction but produce a fresh, editable variant.');

  return clampPrompt(parts.join('\n'), input.maxLength);
}

export function buildRemixEditorUrl(input: BuildRemixEditorUrlInput): string {
  const params = new URLSearchParams({
    prompt: input.prompt,
    source: 'discover',
    entry: input.entry,
    ref: input.publicationId,
  });

  const safeProjectId = encodeURIComponent(input.projectId.trim());
  return `/app/p/${safeProjectId}?${params.toString()}`;
}
