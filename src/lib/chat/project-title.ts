/**
 * Project title helpers.
 * Generates a short, human-friendly project title from the first chat prompt.
 */

const DEFAULT_PROJECT_NAMES = new Set([
  'untitled',
  'untitled project',
  'new project',
  '未命名',
  '未命名项目',
  '新项目',
]);

const TITLE_PREFIX_PATTERNS: RegExp[] = [
  /^请帮我\s*/u,
  /^帮我做一个\s*/u,
  /^帮我设计一个\s*/u,
  /^帮我生成一个\s*/u,
  /^帮我\s*/u,
  /^请\s*/u,
  /^我想要\s*/u,
  /^我想\s*/u,
  /^我需要\s*/u,
  /^给我\s*/u,
  /^做一个\s*/u,
  /^设计一个\s*/u,
  /^生成一个\s*/u,
  /^创建一个\s*/u,
  /^please\s+/iu,
  /^help me\s+/iu,
  /^i want\s+/iu,
  /^i need\s+/iu,
  /^make me\s+/iu,
  /^create\s+/iu,
  /^design\s+/iu,
  /^build\s+/iu,
];

const TITLE_SPLIT_PATTERN = /[。！？!?；;，,]/u;
const MAX_PROJECT_TITLE_LENGTH = 32;
const MIN_PROJECT_TITLE_LENGTH = 2;
const MAX_PROJECT_TITLE_WORDS = 6;

function normalizePrompt(prompt: string): string {
  return prompt
    .replace(/\s+/gu, ' ')
    .replace(/[“”‘’"'`]/gu, '')
    .trim();
}

function stripLeadIns(text: string): string {
  let current = text;

  for (const pattern of TITLE_PREFIX_PATTERNS) {
    current = current.replace(pattern, '');
  }

  return current.trim();
}

function truncateAtWordBoundary(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  const raw = text.slice(0, maxLength);
  const sliced = raw.trimEnd();
  const endsOnBoundary = /[\s,，。！？!?；;:：-]$/u.test(raw);

  if (endsOnBoundary) {
    return sliced;
  }

  const lastSpace = sliced.lastIndexOf(' ');

  if (lastSpace >= Math.floor(maxLength * 0.6)) {
    return sliced.slice(0, lastSpace).trimEnd();
  }

  return sliced;
}

export function isDefaultProjectName(name: string): boolean {
  const normalized = name.trim().toLowerCase();
  return DEFAULT_PROJECT_NAMES.has(normalized);
}

export function deriveProjectTitleFromPrompt(prompt: string): string {
  const normalized = normalizePrompt(prompt);

  if (!normalized) {
    return 'Project';
  }

  const leadInStripped = stripLeadIns(normalized);
  const firstClause = leadInStripped.split(TITLE_SPLIT_PATTERN)[0]?.trim() ?? '';
  const baseCandidate = firstClause || leadInStripped || normalized;
  const articleStrippedCandidate = baseCandidate.replace(/^(?:a|an|the)\s+/iu, '');
  const wordCandidate = /^[A-Za-z]/u.test(articleStrippedCandidate)
    ? articleStrippedCandidate.split(/\s+/u).filter(Boolean).slice(0, MAX_PROJECT_TITLE_WORDS).join(' ')
    : baseCandidate;
  const candidate = wordCandidate || baseCandidate;
  const trimmedCandidate = truncateAtWordBoundary(candidate, MAX_PROJECT_TITLE_LENGTH)
    .replace(/^[\s,，。！？!?；;:：-]+/gu, '')
    .replace(/^(?:a|an|the)\s+/iu, '')
    .replace(/[\s,，。！？!?；;:：-]+$/gu, '')
    .trim();

  if (trimmedCandidate.length < MIN_PROJECT_TITLE_LENGTH) {
    return 'Project';
  }

  return trimmedCandidate;
}
