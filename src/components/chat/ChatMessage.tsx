/**
 * ChatMessage Component
 * Redesigned to match reference UI with clean layout, collapsible sections, and quote cards
 */

'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import { Copy, Check, ChevronDown, Search, X, Globe, ImageIcon, CircleDashed, CheckCircle2 } from 'lucide-react';
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
import { ChatMarkdown } from './ChatMarkdown';
import type { Message, MessageMetadata } from '@/lib/supabase/queries/messages';
import { sanitizeAgentProcessStepTitle } from './chat-pending-ui';

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
  const metadata = message.metadata as MessageMetadata | undefined;
  const isPending = metadata?.isPending === true;
  const [isHovered, setIsHovered] = useState(false);
  const [copied, setCopied] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [thinkingOpen, setThinkingOpen] = useState(false);
  const [agentProcessOpen, setAgentProcessOpen] = useState(isPending);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewSize, setPreviewSize] = useState<{ width: number; height: number } | null>(null);
  const previewImgRef = useRef<HTMLImageElement>(null);

  const isAI = message.role === 'assistant';
  const isAgentMessage = metadata?.mode === 'agent';
  const displayModelName = isAgentMessage
    ? 'Fluxa Agent'
    : (modelName || metadata?.modelName || 'AI Assistant');
  const agentProcess = metadata?.agentProcess;
  const generatedImages = metadata?.generatedImages || [];
  const citations = metadata?.citations || [];
  const processPanelVisible = isAgentMessage && (
    Boolean(metadata?.processSummary) ||
    Boolean(agentProcess?.label) ||
    Boolean(agentProcess?.steps?.length) ||
    Boolean(agentProcess?.decisions?.length) ||
    Boolean(agentProcess?.tools?.length) ||
    citations.length > 0 ||
    generatedImages.length > 0
  );
  
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
  const layerId = (metadata?.op as { payload?: { id?: string } })?.payload?.id;
  const primaryImageUrl = imageUrl || generatedImages[0]?.imageUrl;
  
  // Get referenced image from user message
  const referencedImage = metadata?.referencedImage as { id: string; url: string; filename: string } | undefined;

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content).catch(console.error);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (primaryImageUrl) {
      onImageDownload?.(primaryImageUrl);
      if (!onImageDownload) {
        const link = document.createElement('a');
        link.href = primaryImageUrl;
        link.download = `generated-${message.id}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    }
  };

  const handleAddToCanvas = () => {
    if (primaryImageUrl) {
      onAddToCanvas?.(primaryImageUrl);
    }
  };

  const handleImageClick = () => {
    console.log('[ChatMessage] handleImageClick called', { primaryImageUrl });
    if (primaryImageUrl) {
      onImageClick?.(primaryImageUrl, layerId);
      setPreviewOpen(true);
    }
  };

  const handlePreviewOpenChange = (open: boolean) => {
    setPreviewOpen(open);
    if (!open) {
      setPreviewSize(null);
    }
  };

  const cleanAgentContent = (text: string): string => {
    const cleaned = text
      .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
      .replace(/(?:^|\n)https?:\/\/\S+(?:\n|$)/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    return cleaned;
  };

  const getAgentStatusText = (): string => {
    if (!isPending || !isAgentMessage) {
      return t('message.agent_process');
    }

    const runningTool = agentProcess?.tools?.find((tool) => tool.status === 'running');
    if (runningTool) {
      switch (runningTool.tool) {
        case 'web_search': return t('message.status_web_searching');
        case 'image_search': return t('message.status_image_searching');
        case 'fetch_url': return t('message.status_verifying');
        case 'generate_image': return t('message.status_generating_image');
        default: return t('message.status_processing');
      }
    }

    const phase = agentProcess?.phase;
    if (phase === 'planning' || phase === 'understanding') {
      return t('message.status_thinking');
    }
    if (phase === 'searching') {
      return t('message.status_web_searching');
    }
    if (phase === 'executing') {
      return t('message.status_processing');
    }
    if (phase === 'finalizing') {
      return t('message.status_finalizing');
    }

    return t('message.status_thinking');
  };

  // User message - simple clean style
  if (!isAI) {
    return (
      <div 
        className="chat-message-wrapper relative mb-5 flex flex-col items-end"
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
            <div className="relative size-10 rounded-lg overflow-hidden cursor-pointer">
              <Image
                src={referencedImage.url}
                alt={t('assets.reference_image')}
                fill
                unoptimized
                sizes="40px"
                className="object-cover"
              />
            </div>
            {/* Hover preview */}
            <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block z-50">
              <div className="p-1 bg-white dark:bg-[#1A1028] rounded-lg shadow-lg border border-black/10 dark:border-white/10">
                <Image
                  src={referencedImage.url}
                  alt={t('assets.reference_image')}
                  width={200}
                  height={200}
                  unoptimized
                  className="max-w-[200px] max-h-[200px] rounded object-contain"
                />
              </div>
            </div>
          </div>
        )}

        <p
          className={cn(
            "inline-block max-w-[88%] whitespace-pre-wrap break-words",
            "rounded-xl border px-4 py-3",
            "text-sm leading-relaxed",
            "text-[#1f1f23] bg-[#f0f0f2] border-black/[0.06]",
            "shadow-[0_1px_0_rgba(15,23,42,0.06)]",
            "dark:text-white/95 dark:bg-white/10 dark:border-white/15 dark:shadow-[0_1px_0_rgba(0,0,0,0.28)]"
          )}
        >
          {message.content}
        </p>
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

      {/* Agent thinking steps */}
      {isAgentMessage && processPanelVisible && (
        <Collapsible open={agentProcessOpen} onOpenChange={setAgentProcessOpen} className="mt-3">
          <CollapsibleTrigger className="chat-collapsible-trigger w-full">
            {isPending ? (
              <CircleDashed className="size-3.5 animate-[pulse_1.5s_ease-in-out_infinite]" />
            ) : (
              <CheckCircle2 className="size-3.5 text-muted-foreground/70" />
            )}
            <span>{isPending ? getAgentStatusText() : t('message.agent_process')}</span>
            <ChevronDown className={cn(
              "size-3 ml-auto transition-transform",
              agentProcessOpen && "rotate-180"
            )} />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 space-y-2">
              {agentProcess?.steps && agentProcess.steps.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[11px] font-medium text-muted-foreground">{t('message.process_steps')}</p>
                  {agentProcess.steps.map((step) => {
                    const isDone = !isPending || step.status === 'completed';
                    const stepTitle = sanitizeAgentProcessStepTitle(
                      step.title,
                      t('message.status_processing'),
                    );

                    return (
                      <div key={step.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                        {isDone ? (
                          <CheckCircle2 className="size-3.5 text-muted-foreground/70" />
                        ) : (
                          <CircleDashed className="size-3.5 animate-[pulse_1.5s_ease-in-out_infinite] text-muted-foreground/70" />
                        )}
                        <span className={cn(!isDone && "animate-[pulse_1.5s_ease-in-out_infinite]")}>
                          {stepTitle}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {agentProcess?.decisions && agentProcess.decisions.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[11px] font-medium text-muted-foreground">{t('message.process_decisions')}</p>
                  {agentProcess.decisions.map((decision) => {
                    const decisionLabel = decision.key === 'needs_search'
                      ? (decision.value ? t('message.search_required') : t('message.search_not_required'))
                      : (decision.value ? t('message.image_search_required') : t('message.image_search_not_required'));

                    return (
                      <p key={decision.key} className="text-xs text-muted-foreground">
                        {decisionLabel}
                      </p>
                    );
                  })}
                </div>
              )}

              {agentProcess?.tools && agentProcess.tools.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[11px] font-medium text-muted-foreground">{t('message.process_tools')}</p>
                  {agentProcess.tools.map((tool, index) => {
                    const toolStatus = tool.status === 'completed'
                      ? t('message.tool_status_completed')
                      : t('message.tool_status_running');
                    const toolSummary = tool.resultSummary || tool.inputSummary || tool.tool;

                    return (
                      <p key={`${tool.tool}-${index}`} className="text-xs text-muted-foreground">
                        {toolStatus} · {toolSummary}
                      </p>
                    );
                  })}
                </div>
              )}

              {citations.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[11px] font-medium text-muted-foreground">{t('message.citations')}</p>
                  {citations.slice(0, 3).map((citation) => (
                    <p key={citation.url} className="text-xs text-muted-foreground truncate">
                      {citation.title}
                    </p>
                  ))}
                </div>
              )}

              {isPending && (!agentProcess?.steps || agentProcess.steps.length === 0) && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CircleDashed className="size-3.5 animate-[pulse_1.5s_ease-in-out_infinite] text-muted-foreground/70" />
                  <span className="animate-[pulse_1.5s_ease-in-out_infinite]">{getAgentStatusText()}</span>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Message content */}
      <div className="chat-message-ai">
        <ChatMarkdown content={isAgentMessage ? cleanAgentContent(message.content) : message.content} />
      </div>

      {/* Optional reasoning/thinking summary (classic mode only) */}
      {!isAgentMessage && metadata?.thinking && (
        <Collapsible open={thinkingOpen} onOpenChange={setThinkingOpen} className="mt-3">
          <CollapsibleTrigger className="chat-collapsible-trigger w-full">
            <Search className="size-3.5" />
            <span>{t('message.view_thinking_process')}</span>
            <ChevronDown className={cn(
              "size-3 ml-auto transition-transform",
              thinkingOpen && "rotate-180"
            )} />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="chat-quote-card">
              <p className="text-xs text-foreground mb-2 font-medium">{t('message.thinking_details')}</p>
              <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                {metadata.thinking}
              </p>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

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
      {primaryImageUrl && (
        <div className="mt-3 max-w-[85%]" onClick={handleImageClick}>
          <ImageCard
            src={primaryImageUrl}
            alt="Generated design"
            prompt={metadata?.plan}
            onDownload={handleDownload}
            onAddToCanvas={onAddToCanvas ? handleAddToCanvas : undefined}
          />
        </div>
      )}

      {!isAgentMessage && generatedImages.length > 1 && (
        <div className="mt-3 space-y-2 max-w-[85%]">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
            <ImageIcon className="size-3.5" />
            <span>{t('message.generated_images')}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {generatedImages.slice(primaryImageUrl ? 1 : 0).map((generatedImage, index) => (
              <div
                key={`${generatedImage.imageUrl}-${index}`}
                className="overflow-hidden rounded-lg border border-black/[0.06] dark:border-white/10"
              >
                <ImageCard
                  src={generatedImage.imageUrl}
                  alt="Generated design"
                  prompt={generatedImage.prompt}
                  onDownload={() => {
                    onImageDownload?.(generatedImage.imageUrl);
                  }}
                  onAddToCanvas={onAddToCanvas ? () => onAddToCanvas(generatedImage.imageUrl) : undefined}
                  className="h-full"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {isAgentMessage && citations.length > 0 && (
        <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Globe className="size-3.5" />
          <span>{t('message.citations_count', { count: citations.length })}</span>
        </div>
      )}

      {/* Image preview dialog — sized to fit the image */}
      <Dialog open={previewOpen} onOpenChange={handlePreviewOpenChange}>
        <DialogContent
          showCloseButton={false}
          className="p-0 bg-black/92 border-none overflow-hidden gap-0 rounded-xl"
          style={previewSize ? {
            width: previewSize.width,
            height: previewSize.height,
            maxWidth: '92vw',
            maxHeight: '88vh',
          } : {
            width: 'auto',
            maxWidth: '92vw',
            maxHeight: '88vh',
          }}
        >
          <VisuallyHidden>
            <DialogTitle>{t('message.image_preview')}</DialogTitle>
          </VisuallyHidden>
          <button
            onClick={() => setPreviewOpen(false)}
            className="absolute top-3 right-3 z-50 p-1.5 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors"
          >
            <X className="size-4" />
          </button>
          {primaryImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              ref={previewImgRef}
              src={primaryImageUrl}
              alt="Preview"
              className="block max-w-[92vw] max-h-[88vh] object-contain"
              onLoad={(e) => {
                const img = e.currentTarget;
                const natW = img.naturalWidth;
                const natH = img.naturalHeight;
                // Fit within viewport with padding
                const maxW = window.innerWidth * 0.92;
                const maxH = window.innerHeight * 0.88;
                const scale = Math.min(1, maxW / natW, maxH / natH);
                setPreviewSize({
                  width: Math.round(natW * scale),
                  height: Math.round(natH * scale),
                });
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ChatMessage;
