/**
 * ChatMessage Component
 * Redesigned to match reference UI with clean layout, collapsible sections, and quote cards
 */

'use client';

import { useState, useCallback } from 'react';
import { Copy, Check, ChevronDown, Search, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { ImageCard } from './ImageCard';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { cn } from '@/lib/utils';
import type { Message, MessageMetadata } from '@/lib/supabase/queries/messages';

interface ChatMessageProps {
  message: Message;
  modelName?: string;
  onImageClick?: (imageUrl: string, layerId?: string) => void;
  onImageDownload?: (imageUrl: string) => void;
  onAddToCanvas?: (imageUrl: string) => void;
}

export function ChatMessage({ 
  message, 
  modelName,
  onImageClick,
  onImageDownload,
  onAddToCanvas,
}: ChatMessageProps) {
  const t = useTranslations('chat');
  const [isHovered, setIsHovered] = useState(false);
  const [copied, setCopied] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  
  const isAI = message.role === 'assistant';
  const metadata = message.metadata as MessageMetadata | undefined;
  const displayModelName = modelName || metadata?.modelName || 'AI Assistant';
  
  // Format time for display
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };
  const formatFullDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };
  const messageTime = formatTime(message.created_at);
  const fullDateTime = formatFullDateTime(message.created_at);
  
  // Get image URL from metadata.imageUrl or metadata.op.payload.src
  const imageUrl = metadata?.imageUrl || (metadata?.op as { payload?: { src?: string } })?.payload?.src;
  
  // Get layer ID from metadata.op.payload.id
  const layerId = (metadata?.op as { payload?: { id?: string } })?.payload?.id;
  
  // Get referenced image from user message
  const referencedImage = metadata?.referencedImage as { id: string; url: string; filename: string } | undefined;

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(message.content).catch(console.error);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [message.content]);

  const handleDownload = useCallback(() => {
    if (imageUrl) {
      onImageDownload?.(imageUrl);
      if (!onImageDownload) {
        const link = document.createElement('a');
        link.href = imageUrl;
        link.download = `generated-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    }
  }, [imageUrl, onImageDownload]);

  const handleAddToCanvas = useCallback(() => {
    if (imageUrl) {
      onAddToCanvas?.(imageUrl);
    }
  }, [imageUrl, onAddToCanvas]);

  const handleImageClick = useCallback(() => {
    console.log('[ChatMessage] handleImageClick called', { imageUrl });
    // Always open preview dialog for chat history images
    if (imageUrl) {
      setPreviewOpen(true);
    }
  }, [imageUrl]);

  // User message - simple clean style
  if (!isAI) {
    return (
      <div 
        className="chat-message-wrapper relative mb-5"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Action buttons */}
        <div className={cn(
          "absolute -top-1 right-0 flex items-center gap-0.5 transition-opacity",
          isHovered ? "opacity-100" : "opacity-0 pointer-events-none"
        )}>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 rounded-md hover:bg-muted"
            onClick={handleCopy}
          >
            {copied ? (
              <Check className="h-3 w-3 text-green-500" />
            ) : (
              <Copy className="h-3 w-3 text-muted-foreground" />
            )}
          </Button>
        </div>

        {/* Referenced image preview */}
        {referencedImage && (
          <div className="mb-2 group relative inline-block">
            <img
              src={referencedImage.url}
              alt=""
              className="size-10 rounded-lg object-cover cursor-pointer"
            />
            {/* Hover preview */}
            <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block z-50">
              <div className="p-1 bg-white dark:bg-[#1A1028] rounded-lg shadow-lg border border-black/10 dark:border-white/10">
                <img
                  src={referencedImage.url}
                  alt=""
                  className="max-w-[200px] max-h-[200px] rounded object-contain"
                />
              </div>
            </div>
          </div>
        )}

        <p className="chat-message-user pr-8 font-medium">{message.content}</p>
        <span 
          className="text-[10px] text-muted-foreground/60 mt-1 block text-right cursor-default"
          title={fullDateTime}
        >
          {messageTime}
        </span>
      </div>
    );
  }

  // AI message - with model indicator, collapsible sections, quote cards
  return (
    <div className="chat-message-wrapper mb-5">
      {/* Model indicator */}
      <div className="chat-model-indicator">
        <span>{displayModelName}</span>
        <span 
          className="text-[10px] text-muted-foreground/60 ml-2 cursor-default"
          title={fullDateTime}
        >
          {messageTime}
        </span>
      </div>

      {/* Message content first */}
      <div className="chat-message-ai">
        <p className="whitespace-pre-wrap font-medium">{message.content}</p>
      </div>

      {/* Collapsible info section (if there's a plan/process) */}
      {metadata?.plan && (
        <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen} className="mt-3">
          <CollapsibleTrigger className="chat-collapsible-trigger w-full">
            <Search className="size-3.5" />
            <span>{t('message.view_full_report')}</span>
            <ChevronDown className={cn(
              "size-3 ml-auto transition-transform",
              detailsOpen && "rotate-180"
            )} />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="chat-quote-card">
              <p className="text-xs text-foreground mb-2 font-medium">{t('message.design_details')}</p>
              <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                {metadata.plan}
              </p>
              {metadata.ops && metadata.ops.length > 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  • {t('message.ops_count', { count: metadata.ops.length })}
                </p>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Generated image - no rounded corners, left aligned with max width */}
      {imageUrl && (
        <div className="mt-3 max-w-[85%]" onClick={handleImageClick}>
          <ImageCard
            src={imageUrl}
            alt="Generated design"
            prompt={metadata?.plan}
            onDownload={handleDownload}
            onAddToCanvas={onAddToCanvas ? handleAddToCanvas : undefined}
          />
        </div>
      )}

      {/* Image preview dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 bg-black/90 border-none">
          <VisuallyHidden>
            <DialogTitle>{t('message.image_preview')}</DialogTitle>
          </VisuallyHidden>
          <button
            onClick={() => setPreviewOpen(false)}
            className="absolute top-4 right-4 z-50 p-2 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors"
          >
            <X className="size-5" />
          </button>
          {imageUrl && (
            <img
              src={imageUrl}
              alt="Preview"
              className="w-full h-full max-h-[85vh] object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ChatMessage;
