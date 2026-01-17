'use client';

/**
 * TextToolbar Component - Floating toolbar for text editing
 * Appears when a text object is selected or being edited
 * Requirements: 13.1 - Translate all aria-label attributes
 */

import { useState, useCallback, useEffect, forwardRef } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  ChevronDown,
} from 'lucide-react';
import { Toggle } from '@/components/ui/toggle';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n/hooks';

export interface TextProperties {
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  fontStyle: string;
  fill: string;
  textAlign: string;
  underline: boolean;
  linethrough: boolean;
}

interface TextToolbarProps {
  x: number;
  y: number;
  properties: TextProperties;
  onPropertyChange: (property: keyof TextProperties, value: string | number | boolean) => void;
  className?: string;
}

const FONT_FAMILIES = [
  { value: 'Inter', label: 'Inter' },
  { value: 'Arial', label: 'Arial' },
  { value: 'Helvetica', label: 'Helvetica' },
  { value: 'Times New Roman', label: 'Times New Roman' },
  { value: 'Georgia', label: 'Georgia' },
  { value: 'Courier New', label: 'Courier New' },
  { value: 'Verdana', label: 'Verdana' },
  { value: 'Noto Sans SC', label: '思源黑体' },
  { value: 'Noto Serif SC', label: '思源宋体' },
];

const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 64, 72, 96];

const PRESET_COLORS = [
  '#000000', '#FFFFFF', '#F44336', '#E91E63', '#9C27B0',
  '#673AB7', '#3F51B5', '#2196F3', '#03A9F4', '#00BCD4',
  '#009688', '#4CAF50', '#8BC34A', '#CDDC39', '#FFEB3B',
  '#FFC107', '#FF9800', '#FF5722', '#795548', '#9E9E9E',
];

export const TextToolbar = forwardRef<HTMLDivElement, TextToolbarProps>(function TextToolbar(
  { 
    x,
    y,
    properties,
    onPropertyChange,
    className,
  },
  ref
) {
  const t = useT('editor');
  const [colorPickerOpen, setColorPickerOpen] = useState(false);

  const handleBoldToggle = useCallback(() => {
    const newWeight = properties.fontWeight === 'bold' ? 'normal' : 'bold';
    onPropertyChange('fontWeight', newWeight);
  }, [properties.fontWeight, onPropertyChange]);

  const handleItalicToggle = useCallback(() => {
    const newStyle = properties.fontStyle === 'italic' ? 'normal' : 'italic';
    onPropertyChange('fontStyle', newStyle);
  }, [properties.fontStyle, onPropertyChange]);

  const handleUnderlineToggle = useCallback(() => {
    onPropertyChange('underline', !properties.underline);
  }, [properties.underline, onPropertyChange]);

  const handleLinethroughToggle = useCallback(() => {
    onPropertyChange('linethrough', !properties.linethrough);
  }, [properties.linethrough, onPropertyChange]);

  return (
    <div
      ref={ref}
      className={cn(
        'absolute z-50 pointer-events-auto',
        'animate-in fade-in-0 duration-150',
        className
      )}
      style={{
        left: x,
        top: y - 52,
        transform: 'translateX(-50%)',
      }}
    >
        <div
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg shadow-lg"
          style={{
            background: 'var(--color-surface)',
          }}
        >

        {/* Font Family */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs font-normal gap-1 min-w-[80px] justify-between"
            >
              <span className="truncate max-w-[60px]">
                {FONT_FAMILIES.find(f => f.value === properties.fontFamily)?.label || properties.fontFamily}
              </span>
              <ChevronDown className="size-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-[300px] overflow-y-auto">
            {FONT_FAMILIES.map((font) => (
              <DropdownMenuItem
                key={font.value}
                onClick={() => onPropertyChange('fontFamily', font.value)}
                className={cn(
                  'text-xs',
                  properties.fontFamily === font.value && 'bg-accent'
                )}
                style={{ fontFamily: font.value }}
              >
                {font.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="w-px h-4 bg-border mx-0.5" />

        {/* Font Size */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs font-normal gap-1 min-w-[50px] justify-between"
            >
              <span>{properties.fontSize}</span>
              <ChevronDown className="size-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-[300px] overflow-y-auto">
            {FONT_SIZES.map((size) => (
              <DropdownMenuItem
                key={size}
                onClick={() => onPropertyChange('fontSize', size)}
                className={cn(
                  'text-xs',
                  properties.fontSize === size && 'bg-accent'
                )}
              >
                {size}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="w-px h-4 bg-border mx-0.5" />

        {/* Bold */}
        <Toggle
          size="sm"
          pressed={properties.fontWeight === 'bold'}
          onPressedChange={handleBoldToggle}
          className="h-7 w-7 p-0"
          aria-label={t('text_toolbar.bold')}
        >
          <Bold className="size-3.5" />
        </Toggle>

        {/* Italic */}
        <Toggle
          size="sm"
          pressed={properties.fontStyle === 'italic'}
          onPressedChange={handleItalicToggle}
          className="h-7 w-7 p-0"
          aria-label={t('text_toolbar.italic')}
        >
          <Italic className="size-3.5" />
        </Toggle>

        {/* Underline */}
        <Toggle
          size="sm"
          pressed={properties.underline}
          onPressedChange={handleUnderlineToggle}
          className="h-7 w-7 p-0"
          aria-label={t('text_toolbar.underline')}
        >
          <Underline className="size-3.5" />
        </Toggle>

        {/* Strikethrough */}
        <Toggle
          size="sm"
          pressed={properties.linethrough}
          onPressedChange={handleLinethroughToggle}
          className="h-7 w-7 p-0"
          aria-label={t('text_toolbar.strikethrough')}
        >
          <Strikethrough className="size-3.5" />
        </Toggle>

        <div className="w-px h-4 bg-border mx-0.5" />

        {/* Text Align */}
        <Toggle
          size="sm"
          pressed={properties.textAlign === 'left'}
          onPressedChange={() => onPropertyChange('textAlign', 'left')}
          className="h-7 w-7 p-0"
          aria-label={t('text_toolbar.align_left')}
        >
          <AlignLeft className="size-3.5" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={properties.textAlign === 'center'}
          onPressedChange={() => onPropertyChange('textAlign', 'center')}
          className="h-7 w-7 p-0"
          aria-label={t('text_toolbar.align_center')}
        >
          <AlignCenter className="size-3.5" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={properties.textAlign === 'right'}
          onPressedChange={() => onPropertyChange('textAlign', 'right')}
          className="h-7 w-7 p-0"
          aria-label={t('text_toolbar.align_right')}
        >
          <AlignRight className="size-3.5" />
        </Toggle>

        <div className="w-px h-4 bg-border mx-0.5" />

        {/* Color Picker */}
        <Popover open={colorPickerOpen} onOpenChange={setColorPickerOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              aria-label={t('text_toolbar.color')}
            >
              <div
                className="size-4 rounded border border-border"
                style={{ backgroundColor: properties.fill }}
              />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" align="center">
            <div className="grid grid-cols-5 gap-1">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  className={cn(
                    'size-6 rounded border transition-transform hover:scale-110',
                    properties.fill === color ? 'ring-2 ring-primary ring-offset-1' : 'border-border'
                  )}
                  style={{ backgroundColor: color }}
                  onClick={() => {
                    onPropertyChange('fill', color);
                    setColorPickerOpen(false);
                  }}
                  aria-label={t('text_toolbar.color_option', { color })}
                />
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
    );
});

TextToolbar.displayName = 'TextToolbar';

export default TextToolbar;
