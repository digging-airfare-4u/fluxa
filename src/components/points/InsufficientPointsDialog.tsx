'use client';

/**
 * InsufficientPointsDialog Component
 * Requirements: 4.1, 4.2, 4.3, 4.4 - Display insufficient points message
 * 
 * Shows current balance, required points, and hints about future upgrade options.
 * Non-blocking - user can dismiss and continue browsing.
 */

import { AlertCircle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { InsufficientPointsError, MembershipLevel } from '@/lib/supabase/types/points';

interface InsufficientPointsDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog is closed */
  onClose: () => void;
  /** Current points balance */
  currentBalance: number;
  /** Points required for the operation */
  requiredPoints: number;
  /** Model name that was attempted */
  modelName?: string;
  /** User's membership level */
  membershipLevel?: MembershipLevel;
}

/**
 * Get display name for membership level
 */
function getMembershipDisplayName(level: MembershipLevel): string {
  const names: Record<MembershipLevel, string> = {
    free: '免费版',
    pro: '专业版',
    team: '团队版',
  };
  return names[level] || level;
}

/**
 * Dialog shown when user has insufficient points for an operation.
 * Requirements: 4.1-4.4
 */
export function InsufficientPointsDialog({
  open,
  onClose,
  currentBalance,
  requiredPoints,
  modelName,
  membershipLevel = 'free',
}: InsufficientPointsDialogProps) {
  const pointsNeeded = requiredPoints - currentBalance;

  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <AlertDialogContent className="max-w-xs p-4">
        <AlertDialogHeader className="pb-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 text-muted-foreground" />
            <AlertDialogTitle className="text-base">点数不足</AlertDialogTitle>
          </div>
        </AlertDialogHeader>
        <AlertDialogDescription asChild>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">当前余额</span>
              <span className="text-foreground">{currentBalance.toLocaleString()} 点</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{modelName ? `${modelName}` : '本次操作'}需要</span>
              <span className="text-foreground">{requiredPoints.toLocaleString()} 点</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">还需</span>
              <span className="text-foreground">+{pointsNeeded.toLocaleString()} 点</span>
            </div>
            <p className="text-muted-foreground text-xs pt-2">
              当前为{getMembershipDisplayName(membershipLevel)}，升级可获得更多点数
            </p>
          </div>
        </AlertDialogDescription>
        <AlertDialogFooter className="pt-3">
          <AlertDialogAction onClick={onClose}>
            好的
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Props type for creating dialog from error response
 */
export interface InsufficientPointsDialogFromErrorProps {
  open: boolean;
  onClose: () => void;
  error: InsufficientPointsError | null;
}

/**
 * Helper component that accepts InsufficientPointsError directly
 */
export function InsufficientPointsDialogFromError({
  open,
  onClose,
  error,
}: InsufficientPointsDialogFromErrorProps) {
  if (!error) return null;

  return (
    <InsufficientPointsDialog
      open={open}
      onClose={onClose}
      currentBalance={error.current_balance}
      requiredPoints={error.required_points}
      modelName={error.model_name}
      membershipLevel={error.membership_level}
    />
  );
}

export default InsufficientPointsDialog;
