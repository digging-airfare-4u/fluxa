/**
 * ChatMessage Component
 * Redesigned to match reference UI with clean layout, collapsible sections, and quote cards
 */

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import Image from 'next/image';
import { Copy, Check, ChevronDown, Search, X, ExternalLink, Sparkles, Globe, ImageIcon, CircleDashed, CheckCircle2 } from 'lucide-react';
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
import type { AgentProcessDecision, AgentProcessStep, AgentToolActivity, Message, MessageMetadata } from '@/lib/supabase/queries/messages';

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
  const [thinkingOpen, setThinkingOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewSize, setPreviewSize] = useState<{ width: number; height: number } | null>(null);
  const previewImgRef = useRef<HTMLImageElement>(null);

  // Reset size when dialog closes so stale dimensions don't flash on next open
  useEffect(() => {
    if (!previewOpen) setPreviewSize(null);
  }, [previewOpen]);
  
  const isAI = message.role === 'assistant';
  const metadata = message.metadata as MessageMetadata | undefined;
  const isPending = metadata?.isPending === true;
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

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(message.content).catch(console.error);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [message.content]);

  const handleDownload = useCallback(() => {
    if (primaryImageUrl) {
      onImageDownload?.(primaryImageUrl);
      if (!onImageDownload) {
        const link = document.createElement('a');
        link.href = primaryImageUrl;
        link.download = `generated-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    }
  }, [primaryImageUrl, onImageDownload]);

  const handleAddToCanvas = useCallback(() => {
    if (primaryImageUrl) {
      onAddToCanvas?.(primaryImageUrl);
    }
  }, [primaryImageUrl, onAddToCanvas]);

  const handleImageClick = useCallback(() => {
    console.log('[ChatMessage] handleImageClick called', { primaryImageUrl });
    if (primaryImageUrl) {
      onImageClick?.(primaryImageUrl, layerId);
      setPreviewOpen(true);
    }
  }, [primaryImageUrl, onImageClick, layerId]);

  const renderStepStatus = (step: AgentProcessStep) => {
    if (step.status === 'completed') {
      return <CheckCircle2 className="size-3.5 text-emerald-600" />;
    }

    return <CircleDashed className="size-3.5 text-[#888]" />;
  };

  const renderDecisionText = (decision: AgentProcessDecision) => {
    if (decision.key === 'needs_search') {
      return decision.value ? t('message.search_required') : t('message.search_not_required');
    }

    return decision.value ? t('message.image_search_required') : t('message.image_search_not_required');
  };

  const renderToolStatus = (tool: AgentToolActivity) => (
    tool.status === 'completed'
      ? t('message.tool_status_completed')
      : t('message.tool_status_running')
  );

  const cleanAgentContent = (text: string): string => {
    let cleaned = text
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

      {/* Agent process panel — shown BEFORE the answer for agent messages */}
      {processPanelVisible && (
        <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen} className="mb-2">
          <CollapsibleTrigger className={cn(
            "chat-collapsible-trigger w-full",
            isPending && isAgentMessage && "agent-status-glow"
          )}>
            <Sparkles className={cn(
              "size-3.5",
              isPending && isAgentMessage && "animate-[pulse_2s_ease-in-out_infinite]"
            )} />
            <span className={cn(
              isPending && isAgentMessage && "animate-[pulse_2s_ease-in-out_infinite]"
            )}>{getAgentStatusText()}</span>
            <ChevronDown className={cn(
              "size-3 ml-auto transition-transform",
              detailsOpen && "rotate-180"
            )} />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="chat-quote-card space-y-4">
              {(agentProcess?.label || metadata?.processSummary) && (
                <div className="space-y-1">
                  {agentProcess?.label && (
                    <div className="inline-flex items-center rounded-full bg-black/[0.04] px-2 py-1 text-[11px] font-medium text-[#555] dark:bg-white/[0.08] dark:text-white/80">
                      {t('message.phase_label', { phase: agentProcess.label })}
                    </div>
                  )}
                  {metadata?.processSummary && (
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                      {metadata.processSummary}
                    </p>
                  )}
                </div>
              )}

              {agentProcess?.steps && agentProcess.steps.length > 0 && (
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#666] dark:text-white/60">
                    {t('message.process_steps')}
                  </p>
                  <div className="space-y-2">
                    {agentProcess.steps.map((step) => (
                      <div key={step.id} className="flex items-start gap-2 rounded-lg border border-black/[0.06] px-2.5 py-2 dark:border-white/10">
                        {renderStepStatus(step)}
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-foreground">{step.title}</p>
                          {step.summary && (
                            <p className="mt-0.5 text-xs text-muted-foreground">{step.summary}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {agentProcess?.decisions && agentProcess.decisions.length > 0 && (
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#666] dark:text-white/60">
                    {t('message.process_decisions')}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {agentProcess.decisions.map((decision) => (
                      <span
                        key={decision.key}
                        className="rounded-full border border-black/[0.08] px-2 py-1 text-[11px] text-[#555] dark:border-white/10 dark:text-white/80"
                      >
                        {renderDecisionText(decision)}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {agentProcess?.tools && agentProcess.tools.length > 0 && (
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#666] dark:text-white/60">
                    {t('message.process_tools')}
                  </p>
                  <div className="space-y-2">
                    {agentProcess.tools.map((tool, index) => (
                      <div key={`${tool.tool}-${index}`} className="rounded-lg border border-black/[0.06] px-2.5 py-2 dark:border-white/10">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs font-medium text-foreground">{tool.tool}</p>
                          <span className="text-[11px] text-muted-foreground">{renderToolStatus(tool)}</span>
                        </div>
                        {(tool.inputSummary || tool.resultSummary) && (
                          <p className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap">
                            {tool.resultSummary || tool.inputSummary}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {citations.length > 0 && (
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#666] dark:text-white/60">
                    {t('message.citations')}
                  </p>
                  <div className="space-y-2">
                    {citations.map((citation, index) => (
                      <a
                        key={`${citation.url}-${index}`}
                        href={citation.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between gap-3 rounded-lg border border-black/[0.06] px-2.5 py-2 text-xs transition-colors hover:bg-black/[0.03] dark:border-white/10 dark:hover:bg-white/[0.04]"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">{citation.title}</p>
                          <p className="truncate text-muted-foreground">{citation.domain}</p>
                        </div>
                        <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" />
                      </a>
                    ))}
                  </div>
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

      {generatedImages.length > 1 && (
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
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
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
