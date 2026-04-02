/**
 * Feature: canvas-image-description
 * Property 1: Selection label resolves image descriptions
 * Validates: Image selection info displays a persisted custom description
 */

import { describe, expect, it } from 'vitest';
import { getSelectionDisplayLabel } from '@/lib/canvas/selectionLabel';

describe('getSelectionDisplayLabel', () => {
  it('should prefer a custom image description when provided', () => {
    expect(
      getSelectionDisplayLabel({
        type: 'image',
        label: '首页英雄图',
      })
    ).toBe('首页英雄图');
  });

  it('should fall back to built-in labels when no custom description exists', () => {
    expect(
      getSelectionDisplayLabel({
        type: 'image',
      })
    ).toBe('图片');

    expect(
      getSelectionDisplayLabel({
        type: 'textbox',
      })
    ).toBe('文本');
  });
});
