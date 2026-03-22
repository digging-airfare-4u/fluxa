'use client';

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { PublicationDetailContent } from './PublicationDetailContent';

interface PublicationDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  publicationId: string | null;
  onPublicationChange: (publicationId: string | null) => void;
}

export function PublicationDetailDialog({
  open,
  onOpenChange,
  publicationId,
  onPublicationChange,
}: PublicationDetailDialogProps) {
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      onPublicationChange(null);
    }

    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] p-0 sm:max-w-6xl">
        <DialogTitle className="sr-only">Publication detail</DialogTitle>
        {publicationId ? (
          <PublicationDetailContent
            publicationId={publicationId}
            onOpenPublication={onPublicationChange}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
