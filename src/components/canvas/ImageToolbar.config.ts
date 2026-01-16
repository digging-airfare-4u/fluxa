/**
 * ImageToolbar Configuration
 * Tool definitions and menu items for the Image Toolbar
 * Requirements: 2.1, 2.3, 2.4 - Tool buttons, icon-only/icon-with-label modes, badges
 */

import {
  Download,
  Eraser,
  Expand,
  ImageUp,
  Scissors,
  MoreHorizontal,
  Copy,
  Trash2,
  ArrowUpToLine,
  ArrowDownToLine,
  ArrowUp,
  ArrowDown,
  Lock,
  Unlock,
} from 'lucide-react';
import type { ToolAction, MoreMenuItem } from './ImageToolbar.types';

/**
 * Main toolbar tools configuration
 * Tools are displayed in order, grouped by the 'group' property
 */
export const IMAGE_TOOLBAR_TOOLS: Omit<ToolAction, 'onClick'>[] = [
  {
    id: 'upscale',
    icon: ImageUp,
    label: 'image_toolbar.upscale',
    group: 'ai',
    badge: 'HD',
  },
  {
    id: 'removeBackground',
    icon: Scissors,
    label: 'image_toolbar.remove_background',
    group: 'ai',
  },
  {
    id: 'erase',
    icon: Eraser,
    label: 'image_toolbar.erase',
    group: 'ai',
  },
  {
    id: 'expand',
    icon: Expand,
    label: 'image_toolbar.expand',
    group: 'ai',
  },
  {
    id: 'download',
    icon: Download,
    label: 'image_toolbar.download',
    group: 'primary',
  },
  {
    id: 'more',
    icon: MoreHorizontal,
    label: 'image_toolbar.more',
    group: 'primary',
  },
];

/**
 * More menu items configuration
 * Items with type 'divider' render as visual separators
 */
export const MORE_MENU_ITEMS: MoreMenuItem[] = [
  { id: 'copy', icon: Copy, label: 'image_toolbar.copy' },
  { id: 'delete', icon: Trash2, label: 'image_toolbar.delete' },
  { id: 'divider1', type: 'divider' },
  { id: 'bringToFront', icon: ArrowUpToLine, label: 'image_toolbar.bring_to_front' },
  { id: 'sendToBack', icon: ArrowDownToLine, label: 'image_toolbar.send_to_back' },
  { id: 'bringForward', icon: ArrowUp, label: 'image_toolbar.bring_forward' },
  { id: 'sendBackward', icon: ArrowDown, label: 'image_toolbar.send_backward' },
  { id: 'divider2', type: 'divider' },
  { id: 'toggleLock', icon: Lock, label: 'image_toolbar.lock' },
];

/**
 * Get the appropriate lock icon based on locked state
 */
export function getLockIcon(isLocked: boolean) {
  return isLocked ? Unlock : Lock;
}

/**
 * Get the appropriate lock label based on locked state
 */
export function getLockLabel(isLocked: boolean): string {
  return isLocked ? 'image_toolbar.unlock' : 'image_toolbar.lock';
}

/**
 * Toolbar positioning constants
 */
export const TOOLBAR_OFFSET = {
  /** Vertical offset from image top edge */
  TOP: 12,
  /** Vertical offset from image bottom edge when positioned below */
  BOTTOM: 12,
  /** Minimum distance from viewport edge */
  EDGE_MARGIN: 8,
};
