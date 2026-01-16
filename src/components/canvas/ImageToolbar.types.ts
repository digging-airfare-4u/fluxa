/**
 * ImageToolbar Type Definitions
 * Type definitions for the Image Toolbar component
 * Requirements: 2.1, 2.2 - Tool buttons layout and visual separators
 */

import type { LucideIcon } from 'lucide-react';

/**
 * Error codes for ImageToolbar operations
 * Requirements: 3.4 - Error handling for export failures
 */
export enum ImageToolbarErrorCode {
  EXPORT_FAILED = 'EXPORT_FAILED',
  COPY_FAILED = 'COPY_FAILED',
  AI_PROCESSING_FAILED = 'AI_PROCESSING_FAILED',
  INSUFFICIENT_POINTS = 'INSUFFICIENT_POINTS',
  NETWORK_ERROR = 'NETWORK_ERROR',
  INVALID_IMAGE = 'INVALID_IMAGE',
}

/**
 * Error object for ImageToolbar operations
 */
export interface ImageToolbarError {
  code: ImageToolbarErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Loading states for async AI operations
 */
export interface ImageToolbarLoadingStates {
  removeBackground: boolean;
  upscale: boolean;
  erase: boolean;
  expand: boolean;
}

/**
 * Tool action configuration
 */
export interface ToolAction {
  /** Unique identifier for the tool */
  id: string;
  /** Lucide icon component */
  icon: LucideIcon;
  /** i18n key for the label */
  label: string;
  /** Click handler */
  onClick?: () => void | Promise<void>;
  /** Whether the tool is disabled */
  disabled?: boolean;
  /** Whether the tool is in loading state */
  loading?: boolean;
  /** Optional badge text (e.g., "HD", "New") */
  badge?: string;
  /** Tool group for visual separation */
  group: 'primary' | 'ai' | 'more';
}

/**
 * Props for the ImageToolbar component
 */
export interface ImageToolbarProps {
  /** Screen X coordinate for positioning */
  x: number;
  /** Screen Y coordinate for positioning */
  y: number;
  /** Selected image width (for positioning calculations) */
  imageWidth: number;
  /** Selected image height (for positioning calculations) */
  imageHeight: number;
  /** Whether toolbar should appear below the image (edge case) */
  positionBelow?: boolean;
  /** Callback when download is clicked */
  onDownload: () => void;
  /** Callback when copy is clicked */
  onCopy: () => void;
  /** Callback when delete is clicked */
  onDelete: () => void;
  /** Callback when remove background is clicked */
  onRemoveBackground: () => Promise<void>;
  /** Callback when upscale is clicked */
  onUpscale: () => Promise<void>;
  /** Callback when erase is clicked */
  onErase: () => void;
  /** Callback when expand is clicked */
  onExpand: () => void;
  /** Callback for layer ordering - bring to front */
  onBringToFront: () => void;
  /** Callback for layer ordering - send to back */
  onSendToBack: () => void;
  /** Callback for layer ordering - bring forward */
  onBringForward: () => void;
  /** Callback for layer ordering - send backward */
  onSendBackward: () => void;
  /** Callback for lock/unlock */
  onToggleLock: () => void;
  /** Whether the image is locked */
  isLocked: boolean;
  /** Loading states for async operations */
  loadingStates: ImageToolbarLoadingStates;
  /** Optional className for styling */
  className?: string;
}

/**
 * Menu item configuration for the "More" dropdown
 */
export interface MoreMenuItem {
  /** Unique identifier */
  id: string;
  /** Item type - 'action' for clickable items, 'divider' for separators */
  type?: 'action' | 'divider';
  /** Lucide icon component */
  icon?: LucideIcon;
  /** i18n key for the label */
  label?: string;
}
