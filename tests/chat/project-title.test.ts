import { describe, expect, it } from 'vitest';
import { deriveProjectTitleFromPrompt, isDefaultProjectName } from '@/lib/chat/project-title';

describe('project title helpers', () => {
  it('detects default untitled project names', () => {
    expect(isDefaultProjectName('Untitled Project')).toBe(true);
    expect(isDefaultProjectName('未命名项目')).toBe(true);
    expect(isDefaultProjectName('My Poster')).toBe(false);
  });

  it('derives a compact title from the first chat prompt', () => {
    expect(deriveProjectTitleFromPrompt('请帮我设计一个科技感海报，主题是 AI 发布会')).toBe('科技感海报');
    expect(deriveProjectTitleFromPrompt('help me design a landing page for a coffee brand with warm colors')).toBe('landing page for a coffee brand');
  });
});
