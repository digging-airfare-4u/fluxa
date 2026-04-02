'use client';

import React, { forwardRef, useCallback, useEffect, useRef, useState } from 'react';
import { getSelectionDisplayLabel } from '@/lib/canvas/selectionLabel';

export interface SelectionInfoProps {
  type: string;
  label?: string;
  width: number;
  height: number;
  x: number;
  y: number;
  attachedToImageBorder?: boolean;
  attachedWidth?: number;
  editable?: boolean;
  onLabelChange?: (value: string) => void;
}

/**
 * Displays selection info above the selected element - Theme aware
 */
export const SelectionInfo = forwardRef<HTMLDivElement, SelectionInfoProps>(function SelectionInfo(
  { type, label, width, height, x, y, attachedToImageBorder = false, attachedWidth, editable = false, onLabelChange },
  ref
) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const displayLabel = getSelectionDisplayLabel({ type, label });
  const isAttached = attachedToImageBorder && type === 'image';
  const barWidth = attachedWidth ? Math.max(110, attachedWidth) : 110;
  const [isEditing, setIsEditing] = useState(false);
  const [draftLabel, setDraftLabel] = useState(displayLabel);

  useEffect(() => {
    setDraftLabel(displayLabel);
  }, [displayLabel]);

  useEffect(() => {
    if (!editable && isEditing) {
      setIsEditing(false);
      return;
    }

    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editable, isEditing]);

  const startEditing = useCallback((event: React.MouseEvent | React.PointerEvent) => {
    event.stopPropagation();
    if (!editable) return;
    setDraftLabel(displayLabel);
    setIsEditing(true);
  }, [displayLabel, editable]);

  const handleSubmit = useCallback(() => {
    const trimmedLabel = draftLabel.trim();
    if (trimmedLabel && trimmedLabel !== displayLabel) {
      onLabelChange?.(trimmedLabel);
    }

    setDraftLabel(trimmedLabel || displayLabel);
    setIsEditing(false);
  }, [displayLabel, draftLabel, onLabelChange]);

  const handleCancel = useCallback(() => {
    setDraftLabel(displayLabel);
    setIsEditing(false);
  }, [displayLabel]);

  const renderImageLabel = () => {
    if (!editable) {
      return (
        <span
          className="truncate font-medium"
          style={{ color: '#1D4ED8', maxWidth: '64%', textShadow: '0 1px 0 rgba(255,255,255,0.45)' }}
        >
          {displayLabel}
        </span>
      );
    }

    if (isEditing) {
      return (
        <input
          ref={inputRef}
          value={draftLabel}
          onChange={(event) => setDraftLabel(event.target.value)}
          onBlur={handleSubmit}
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              handleSubmit();
            }

            if (event.key === 'Escape') {
              event.preventDefault();
              handleCancel();
            }
          }}
          className="pointer-events-auto h-5 min-w-0 flex-1 rounded-sm border border-[#93C5FD] bg-white/95 px-1.5 text-[9px] font-medium text-[#1D4ED8] outline-none"
          style={{ maxWidth: '64%', boxShadow: '0 1px 0 rgba(255,255,255,0.45)' }}
        />
      );
    }

    return (
      <button
        type="button"
        onClick={startEditing}
        onPointerDown={(event) => event.stopPropagation()}
        className="pointer-events-auto truncate text-left font-medium outline-none"
        style={{ color: '#1D4ED8', maxWidth: '64%', textShadow: '0 1px 0 rgba(255,255,255,0.45)' }}
        title="点击修改图片描述"
      >
        {displayLabel}
      </button>
    );
  };

  return (
    <div
      ref={ref}
      className="absolute pointer-events-none z-50"
      style={{
        left: x,
        top: isAttached ? y + 1 : y - 36,
        transform: isAttached ? 'translateX(-50%) translateY(-100%)' : 'translateX(-50%)',
      }}
    >
      <div
        className="selection-info"
        style={isAttached ? {
          width: barWidth,
          minWidth: 110,
          border: 'none',
          borderRadius: 0,
          background: 'transparent',
          boxShadow: 'none',
          backdropFilter: 'none',
          WebkitBackdropFilter: 'none',
          padding: '0 2px',
          fontSize: 9,
          lineHeight: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 4,
        } : undefined}
      >
        {isAttached ? (
          <>
            {renderImageLabel()}
            <span className="tabular-nums shrink-0" style={{ color: '#1D4ED8', textShadow: '0 1px 0 rgba(255,255,255,0.45)' }}>
              {Math.round(width)} × {Math.round(height)}
            </span>
          </>
        ) : (
          <>
            <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>{displayLabel}</span>
            <span style={{ color: 'var(--color-text-muted)' }}>|</span>
            <span className="tabular-nums" style={{ color: 'var(--color-text-secondary)' }}>
              {Math.round(width)} × {Math.round(height)}
            </span>
          </>
        )}
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
