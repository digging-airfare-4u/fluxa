'use client';

import React, { forwardRef } from 'react';

export interface SelectionInfoProps {
  type: string;
  width: number;
  height: number;
  x: number;
  y: number;
}

const typeLabels: Record<string, string> = {
  'i-text': '文本',
  'text': '文本',
  'textbox': '文本',
  'image': '图片',
  'rect': '矩形',
  'circle': '圆形',
  'triangle': '三角形',
  'path': '路径',
  'group': '组合',
};

/**
 * Displays selection info above the selected element - Theme aware
 */
export const SelectionInfo = forwardRef<HTMLDivElement, SelectionInfoProps>(function SelectionInfo(
  { type, width, height, x, y },
  ref
) {
  const label = typeLabels[type] || type;

  return (
    <div
      ref={ref}
      className="absolute pointer-events-none z-50"
      style={{
        left: x,
        top: y - 36,
        transform: 'translateX(-50%)',
      }}
    >
      <div className="selection-info">
        <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>{label}</span>
        <span style={{ color: 'var(--color-text-muted)' }}>|</span>
        <span className="tabular-nums" style={{ color: 'var(--color-text-secondary)' }}>
          {Math.round(width)} × {Math.round(height)}
        </span>
      </div>
    </div>
  );
});

SelectionInfo.displayName = 'SelectionInfo';

/**
 * Displays quick edit hint below the selected element - Dark theme
 */
export const QuickEditHint = forwardRef<HTMLDivElement, { x: number; y: number; height: number }>(
  function QuickEditHint({ x, y, height }, ref) {
    return (
      <div
        ref={ref}
        className="absolute pointer-events-none z-50"
        style={{
          left: x,
          top: y + height + 12,
          transform: 'translateX(-50%)',
        }}
      >
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md whitespace-nowrap"
             style={{
               background: 'rgba(124, 58, 237, 0.9)',
               boxShadow: '0 4px 12px rgba(124, 58, 237, 0.4)',
             }}>
          <span className="text-xs text-white/90">按</span>
          <kbd className="bg-white/20 px-1.5 py-0.5 rounded text-[10px] font-mono text-white">Tab</kbd>
          <span className="text-xs text-white/90">快速编辑</span>
        </div>
      </div>
    );
  }
);

QuickEditHint.displayName = 'QuickEditHint';
