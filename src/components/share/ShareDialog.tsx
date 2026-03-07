'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link2, ImageIcon, Send, Info } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { PublishForm } from './PublishForm';

interface ShareDialogProps { open: boolean; onOpenChange: (open: boolean) => void; conversationId: string; projectId: string; documentId: string; }
export function ShareDialog({ open, onOpenChange, conversationId, projectId, documentId }: ShareDialogProps) {
  const t = useTranslations('common');
  const [showPublishForm, setShowPublishForm] = useState(false);
  const handleCopyLink = () => { navigator.clipboard.writeText(`${window.location.origin}/app/discover`); };
  if (showPublishForm) return <PublishForm open={open} onOpenChange={v=>{if(!v) setShowPublishForm(false); onOpenChange(v);}} conversationId={conversationId} projectId={projectId} documentId={documentId} onSuccess={()=>{setShowPublishForm(false);onOpenChange(false);}}/>;
  return (<Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>{t('share.title')}</DialogTitle></DialogHeader>
    <div className="space-y-4"><div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"><Info className="size-4 text-muted-foreground shrink-0 mt-0.5"/><div><p className="text-sm font-medium">{t('share.public_access')}</p><p className="text-xs text-muted-foreground">{t('share.public_access_desc')}</p></div></div>
      <p className="text-xs text-muted-foreground">{t('share.sync_note')}</p>
      <div className="flex gap-2"><Button variant="outline" className="flex-1 h-10 text-sm gap-2" onClick={handleCopyLink}><Link2 className="size-4"/>{t('share.copy_link')}</Button><Button variant="outline" className="flex-1 h-10 text-sm gap-2" disabled title={t('share.coming_soon')}><ImageIcon className="size-4"/>{t('share.share_image')}</Button><Button className="flex-1 h-10 text-sm gap-2" onClick={()=>setShowPublishForm(true)}><Send className="size-4"/>{t('share.publish')}</Button></div></div>
  </DialogContent></Dialog>);
}
