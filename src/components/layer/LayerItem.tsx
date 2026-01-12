'use client';

/**
 * LayerItem Component - Individual layer list item
 * Requirements: 3.2, 3.3, 9.1
 * 
 * Displays a single layer with:
 * - Type icon and name
 * - Visibility toggle (Eye/EyeOff)
 * - Lock toggle (Lock/Unlock)
 * - Double-click to rename
 * - Selected highlight styling
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Square,
  Type,
  Image,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { Layer, LayerType } from '@/lib/canvas/layer.types';

/**
 * Get the icon component for a layer type
 */
function getLayerTypeIcon(type: LayerType) {
  switch (type) {
    case 'rect':
      return <Square className="size-4" strokeWidth={1.5} />;
    case 'text':
      return <Type className="size-4" strokeWidth={1.5} />;
    case 'image':
      return <Image className="size-4" strokeWidth={1.5} />;
    default:
      return <Square className="size-4" strokeWidth={1.5} />;
  }
}

export interface LayerItemProps {
  /** Layer data */
  layer: Layer;
  /** Whether this layer is selected */
  isSelected: boolean;
  /** Callback when layer is clicked for selection */
  onSelect: () => void;
  /** Callback when visibility is toggled */
  onVisibilityToggle: () => void;
  /** Callback when lock is toggled */
  onLockToggle: () => void;
  /** Callback when layer is renamed (double-click to edit) */
  onRename: (name: string) => void;
}

export function LayerItem({
  layer,
  isSelected,
  onSelect,
  onVisibilityToggle,
  onLockToggle,
  onRename,
}: LayerItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(layer.name);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Handle double-click to enter edit mode
  const handleDoubleClick = useCallback(() => {
    setEditName(layer.name);
    setIsEditing(true);
  }, [layer.name]);

  // Handle rename submission
  const handleRenameSubmit = useCallback(() => {
    const trimmedName = editName.trim();
    if (trimmedName && trimmedName !== layer.name) {
      onRename(trimmedName);
    }
    setIsEditing(false);
  }, [editName, layer.name, onRename]);

  // Handle key events in edit mode
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRenameSubmit();
    } else if (e.key === 'Escape') {
      setEditName(layer.name);
      setIsEditing(false);
    }
  }, [handleRenameSubmit, layer.name]);

  // Handle blur to submit rename
  const handleBlur = useCallback(() => {
    handleRenameSubmit();
  }, [handleRenameSubmit]);

  // Determine if layer is interactive (not hidden and not locked)
  const isInteractive = layer.visible && !layer.locked;

  return (
    <div
      className={cn(
        'group flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer',
        'transition-colors duration-150',
        isSelected
          ? 'bg-primary/10 border border-primary/30'
          : 'hover:bg-accent/50 border border-transparent',
        !isInteractive && 'opacity-60'
      )}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      aria-selected={isSelected}
      aria-label={`Layer: ${layer.name}`}
    >
      {/* Layer type icon */}
      <span className="text-muted-foreground shrink-0">
        {getLayerTypeIcon(layer.type)}
      </span>

      {/* Layer name (editable on double-click) */}
      {isEditing ? (
        <Input
          ref={inputRef}
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          onClick={(e) => e.stopPropagation()}
          className="h-6 px-1 py-0 text-sm flex-1 min-w-0"
          aria-label="Edit layer name"
        />
      ) : (
        <span
          className="flex-1 text-sm truncate select-none"
          onDoubleClick={handleDoubleClick}
          title={layer.name}
        >
          {layer.name}
        </span>
      )}

      {/* Action buttons (visible on hover or when active) */}
      <div className={cn(
        'flex items-center gap-0.5 shrink-0',
        'opacity-0 group-hover:opacity-100 transition-opacity duration-150',
        (isSelected || !layer.visible || layer.locked) && 'opacity-100'
      )}>
        {/* Visibility toggle */}
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'size-6 rounded',
            !layer.visible && 'text-muted-foreground'
          )}
          onClick={(e) => {
            e.stopPropagation();
            onVisibilityToggle();
          }}
          aria-label={layer.visible ? 'Hide layer' : 'Show layer'}
        >
          {layer.visible ? (
            <Eye className="size-3.5" strokeWidth={1.5} />
          ) : (
            <EyeOff className="size-3.5" strokeWidth={1.5} />
          )}
        </Button>

        {/* Lock toggle */}
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'size-6 rounded',
            layer.locked && 'text-muted-foreground'
          )}
          onClick={(e) => {
            e.stopPropagation();
            onLockToggle();
          }}
          aria-label={layer.locked ? 'Unlock layer' : 'Lock layer'}
        >
          {layer.locked ? (
            <Lock className="size-3.5" strokeWidth={1.5} />
          ) : (
            <Unlock className="size-3.5" strokeWidth={1.5} />
          )}
        </Button>
      </div>
    </div>
  );
}

export default LayerItem;
