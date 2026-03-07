'use client';

/**
 * InsufficientPointsDialog Component
 * Requirements: 4.1, 4.2, 4.3, 4.4 - Display insufficient points message
 * 
 * Shows upgrade offer with gift icon style.
 * Non-blocking - user can dismiss and continue browsing.
 */

import { Gift, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
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
 * Dialog shown when user has insufficient points for an operation.
 * Requirements: 4.1-4.4
 */
export function InsufficientPointsDialog({
  open,
  onClose,
  currentBalance,
  requiredPoints,
  modelName,
}: InsufficientPointsDialogProps) {
  const pointsNeeded = requiredPoints - currentBalance;
  const t = useTranslations('points');

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-sm p-6 rounded-2xl border-0 shadow-lg bg-background backdrop-blur-sm">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="size-5" />
        </button>

        {/* Gift icon */}
        <div className="flex justify-center mb-4">
          <div className="size-16 rounded-full bg-muted flex items-center justify-center">
            <Gift className="size-8 text-foreground" strokeWidth={1.5} />
          </div>
        </div>

        {/* Title */}
        <DialogTitle className="text-center text-xl font-bold mb-2">
          {t('insufficient.title')}
        </DialogTitle>

        {/* Description */}
        <DialogDescription className="text-center text-muted-foreground mb-6">
          {t('insufficient.description')}
          {modelName && <><br />{t('insufficient.model_specific', { modelName })}</>}
          {!modelName && <><br />{t('insufficient.all_models')}</>}
          ！
          <span className="block text-xs mt-2 text-muted-foreground/70">
            {t('insufficient.current_balance', { balance: currentBalance, needed: pointsNeeded })}
          </span>
        </DialogDescription>

        {/* Buttons */}
        <div className="flex gap-3 justify-center">
          <Button
            variant="outline"
            onClick={onClose}
            className="px-6 rounded-full bg-muted hover:bg-muted/80 border-0"
          >
            {t('insufficient.later')}
          </Button>
          <Button
            variant="outline"
            onClick={onClose}
            className="px-6 rounded-full bg-muted hover:bg-muted/80 border-0"
          >
            {t('insufficient.upgrade')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
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
