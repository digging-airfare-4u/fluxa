'use client';

/**
 * InvalidProviderConfigDialog Component
 * Shows when user tries to generate with invalid BYOK provider config.
 * Requirements: 6.6 - UI behavior on invalid selected user model
 *
 * Guides user to fix their config in settings.
 */

import { Settings, X, AlertCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';

interface InvalidProviderConfigDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog is closed */
  onClose: () => void;
  /** Error message from the API */
  message?: string;
  /** Callback to open settings */
  onOpenSettings?: () => void;
}

/**
 * Dialog shown when user has invalid provider configuration.
 * Requirements: 6.6
 */
export function InvalidProviderConfigDialog({
  open,
  onClose,
  message,
  onOpenSettings,
}: InvalidProviderConfigDialogProps) {
  const t = useTranslations('providerConfig');

  const handleOpenSettings = () => {
    onClose();
    onOpenSettings?.();
  };

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

        {/* Alert icon */}
        <div className="flex justify-center mb-4">
          <div className="size-16 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
            <AlertCircle className="size-8 text-red-500" strokeWidth={1.5} />
          </div>
        </div>

        {/* Title */}
        <DialogTitle className="text-center text-xl font-bold mb-2">
          {t('invalid_config.title')}
        </DialogTitle>

        {/* Description */}
        <DialogDescription className="text-center text-muted-foreground mb-6">
          {message || t('invalid_config.description')}
          <span className="block text-xs mt-2 text-muted-foreground/70">
            {t('invalid_config.hint')}
          </span>
        </DialogDescription>

        {/* Buttons */}
        <div className="flex gap-3 justify-center">
          <Button
            variant="outline"
            onClick={onClose}
            className="px-6 rounded-full bg-muted hover:bg-muted/80 border-0"
          >
            {t('invalid_config.later')}
          </Button>
          <Button
            onClick={handleOpenSettings}
            className="px-6 rounded-full bg-foreground text-background hover:bg-foreground/90"
          >
            <Settings className="size-4 mr-2" />
            {t('invalid_config.go_settings')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default InvalidProviderConfigDialog;
