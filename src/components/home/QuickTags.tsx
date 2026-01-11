'use client';

/**
 * Quick Tags Component
 * Requirements: 5.1 - Quick tags below the input for common design categories
 */

import { cn } from '@/lib/utils';

interface QuickTag {
  id: string;
  label: string;
  prompt?: string;
  icon?: string;
}

const DEFAULT_TAGS: QuickTag[] = [
  { id: 'design', label: '设计', icon: '🎨' },
  { id: 'branding', label: '品牌', icon: '✨' },
  { id: 'illustration', label: '插画', icon: '🖼️' },
  { id: 'ecommerce', label: '电商', icon: '🛒' },
  { id: 'video', label: '视频', icon: '🎬' },
  { id: 'poster', label: '海报', icon: '📄' },
  { id: 'social', label: '社媒', icon: '📱' },
];

interface QuickTagsProps {
  tags?: QuickTag[];
  onTagClick?: (tag: QuickTag) => void;
  selectedTagId?: string;
}

export function QuickTags({
  tags = DEFAULT_TAGS,
  onTagClick,
  selectedTagId,
}: QuickTagsProps) {
  return (
    <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="快捷标签">
      {tags.map((tag) => (
        <button
          key={tag.id}
          type="button"
          className={cn(
            "quick-tag",
            selectedTagId === tag.id && "active"
          )}
          onClick={() => onTagClick?.(tag)}
        >
          {tag.icon && <span className="mr-1">{tag.icon}</span>}
          {tag.label}
        </button>
      ))}
    </div>
  );
}

export default QuickTags;
