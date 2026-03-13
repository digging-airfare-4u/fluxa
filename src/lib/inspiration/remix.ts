export type RemixEntry = 'card' | 'detail';

interface BuildRemixPromptInput {
  title: string;
  categoryName?: string | null;
  tags?: string[] | null;
  description?: string | null;
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

function clampPrompt(text: string, maxLength?: number): string {
  const limit = maxLength ?? 700;
  return text.length > limit ? text.slice(0, limit) : text;
}

export function buildRemixPrompt(input: BuildRemixPromptInput): string {
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

  const prompt = parts.join('\n');
  return clampPrompt(prompt, input.maxLength);
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
