'use client';

import React, { useEffect, useRef } from 'react';
import {
  Copy,
  Clipboard,
  Trash2,
  ArrowUp,
  ArrowDown,
  ChevronsUp,
  ChevronsDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onDelete: () => void;
  onBringForward: () => void;
  onSendBackward: () => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
  canPaste: boolean;
}

interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
}

function MenuItem({ icon, label, shortcut, onClick, disabled, destructive }: MenuItemProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "relative flex w-full cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none select-none",
        "focus:bg-accent focus:text-accent-foreground",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        destructive && "text-destructive focus:bg-destructive/10 focus:text-destructive",
        "[&_svg]:size-4 [&_svg]:shrink-0"
      )}
      data-disabled={disabled || undefined}
    >
      {icon}
      <span className="flex-1 text-left">{label}</span>
      {shortcut && (
        <span className="ml-auto text-xs tracking-widest text-muted-foreground">{shortcut}</span>
      )}
    </button>
  );
}

function MenuDivider() {
  return <div className="bg-border -mx-1 my-1 h-px" />;
}

function MenuLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2 py-1.5 text-sm font-medium text-foreground">
      {children}
    </div>
  );
}

/**
 * Context menu for canvas elements - using shadcn styling
 */
export function ContextMenu({
  x,
  y,
  onClose,
  onCopy,
  onPaste,
  onDelete,
  onBringForward,
  onSendBackward,
  onBringToFront,
  onSendToBack,
  canPaste,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // Adjust position to stay within viewport
  const adjustedX = Math.min(x, window.innerWidth - 200);
  const adjustedY = Math.min(y, window.innerHeight - 320);

  return (
    <div
      ref={menuRef}
      className={cn(
        "fixed z-[100] min-w-[180px] overflow-hidden rounded-md border p-1 shadow-md",
        "bg-popover text-popover-foreground",
        "animate-in fade-in-0 zoom-in-95 duration-100"
      )}
      style={{
        left: adjustedX,
        top: adjustedY,
      }}
    >
      <MenuItem
        icon={<Copy />}
        label="复制"
        shortcut="⌘C"
        onClick={() => { onCopy(); onClose(); }}
      />
      <MenuItem
        icon={<Clipboard />}
        label="粘贴"
        shortcut="⌘V"
        onClick={() => { onPaste(); onClose(); }}
        disabled={!canPaste}
      />
      
      <MenuDivider />
      
      <MenuLabel>图层</MenuLabel>
      
      <MenuItem
        icon={<ChevronsUp />}
        label="置于顶层"
        onClick={() => { onBringToFront(); onClose(); }}
      />
      <MenuItem
        icon={<ArrowUp />}
        label="上移一层"
        onClick={() => { onBringForward(); onClose(); }}
      />
      <MenuItem
        icon={<ArrowDown />}
        label="下移一层"
        onClick={() => { onSendBackward(); onClose(); }}
      />
      <MenuItem
        icon={<ChevronsDown />}
        label="置于底层"
        onClick={() => { onSendToBack(); onClose(); }}
      />
      
      <MenuDivider />
      
      <MenuItem
        icon={<Trash2 />}
        label="删除"
        shortcut="⌫"
        onClick={() => { onDelete(); onClose(); }}
        destructive
      />
    </div>
  );
}
