/**
 * Streaming Markdown helpers
 * Splits content into a stable markdown prefix and a still-streaming tail so
 * the UI can avoid reparsing incomplete markdown constructs on every token.
 */

export interface StableMarkdownParts {
  stable: string;
  tail: string;
}

const FENCE_OPEN_RE = /^(\s*)(`{3,}|~{3,})/;

export function splitStableMarkdown(content: string): StableMarkdownParts {
  if (!content) {
    return { stable: '', tail: '' };
  }

  const lines = content.split('\n');
  let cursor = 0;
  let stableEnd = 0;
  let activeFenceChar: '`' | '~' | null = null;
  let activeFenceLength = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const lineWithBreak = index < lines.length - 1 ? `${line}\n` : line;
    const fenceMatch = line.match(FENCE_OPEN_RE);
    let justClosedFence = false;

    if (fenceMatch) {
      const marker = fenceMatch[2];
      const markerChar = marker[0] as '`' | '~';

      if (!activeFenceChar) {
        activeFenceChar = markerChar;
        activeFenceLength = marker.length;
      } else if (markerChar === activeFenceChar && marker.length >= activeFenceLength) {
        activeFenceChar = null;
        activeFenceLength = 0;
        justClosedFence = true;
      }
    }

    cursor += lineWithBreak.length;

    if (!activeFenceChar && line.trim() === '') {
      stableEnd = cursor;
      continue;
    }

    if (justClosedFence) {
      stableEnd = cursor;
    }
  }

  return {
    stable: content.slice(0, stableEnd),
    tail: content.slice(stableEnd),
  };
}
