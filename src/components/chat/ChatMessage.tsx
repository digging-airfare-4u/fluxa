/**
 * ChatMessage Component
 * Renders chat turns with lightweight reasoning summaries, agent process details,
 * and generated image previews.
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import {
  BrainIcon,
  Check,
  CheckCircle2,
  CircleDashed,
  Copy,
  Globe,
  ImageIcon,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { ImageCard } from './ImageCard';
import { Reasoning, ReasoningContent, ReasoningTrigger } from './Reasoning';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { cn } from '@/lib/utils';
import { ChatMarkdown } from './ChatMarkdown';
import type { Message, MessageMetadata } from '@/lib/supabase/queries/messages';
import {
  type AgentToolUiPart,
  buildAgentToolUiParts,
  formatAgentThinkingDuration,
  getAgentStatusMetrics,
  isMeaningfulAgentProcessStepTitle,
  sanitizeAgentProcessStepTitle,
} from './chat-pending-ui';

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
  const [pendingElapsedMs, setPendingElapsedMs] = useState(0);
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
  const agentToolUiParts = buildAgentToolUiParts(agentProcess?.tools);
  const statusMetrics = getAgentStatusMetrics(metadata);
  const processPanelVisible = isAgentMessage && (
    Boolean(metadata?.processSummary) ||
    Boolean(agentProcess?.label) ||
    Boolean(agentProcess?.steps?.length) ||
    Boolean(agentProcess?.tools?.length) ||
    citations.length > 0 ||
    generatedImages.length > 0
  );

  useEffect(() => {
    if (!isPending || !isAgentMessage) {
      return;
    }

    const updateElapsed = () => {
      const startedAtMs = new Date(message.created_at).getTime();
      setPendingElapsedMs(Math.max(0, Date.now() - startedAtMs));
    };

    updateElapsed();
    const timerId = window.setInterval(updateElapsed, 1000);

    return () => {
      window.clearInterval(timerId);
    };
  }, [isAgentMessage, isPending, message.created_at]);
  
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
      return t('message.status_complete');
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

  const durationText = isAgentMessage
    ? formatAgentThinkingDuration(isPending ? pendingElapsedMs : agentProcess?.thinkingDurationMs)
    : null;

  const formatThoughtSummary = (durationMs?: number): string => {
    if (typeof durationMs !== 'number' || durationMs <= 0) {
      return t('message.thought_done');
    }

    const totalSeconds = Math.ceil(durationMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    if (minutes > 0) {
      return t('message.thought_for_minutes', { minutes, seconds });
    }

    return t('message.thought_for_seconds', { seconds });
  };

  const getToolTitle = (tool: AgentToolUiPart['tool']): string => {
    switch (tool) {
      case 'web_search':
        return t('message.tool_web_search');
      case 'fetch_url':
        return t('message.tool_fetch_url');
      case 'image_search':
        return t('message.tool_image_search');
      case 'generate_image':
        return t('message.tool_generate_image');
    }
  };

  const getToolIcon = (tool: AgentToolUiPart['tool']) => {
    switch (tool) {
      case 'web_search':
        return <Globe className="size-3.5" />;
      case 'fetch_url':
        return <Search className="size-3.5" />;
      case 'image_search':
        return <ImageIcon className="size-3.5" />;
      case 'generate_image':
        return <Sparkles className="size-3.5" />;
    }
  };

  const getAgentStepTitle = (title: string): string | null => {
    const cleanedTitle = sanitizeAgentProcessStepTitle(title, '');
    if (!isMeaningfulAgentProcessStepTitle(cleanedTitle)) {
      return null;
    }

    if (/^(understand(?:ing)? request|analy[sz]e request|review request)$/iu.test(cleanedTitle)) {
      return t('message.step_understand_request');
    }
    if (/^(planning|plan response|create plan|draft plan)$/iu.test(cleanedTitle)) {
      return t('message.step_plan_response');
    }
    if (/^(search references|search web|web search|research|gather references)$/iu.test(cleanedTitle)) {
      return t('message.step_search_references');
    }
    if (/^(search images|image search|find visual references|search image references)$/iu.test(cleanedTitle)) {
      return t('message.step_search_images');
    }
    if (/^(verify sources?|verify source|fetch url|source verification)$/iu.test(cleanedTitle)) {
      return t('message.step_verify_sources');
    }
    if (/^(draft layout|draft concept|propose layout|design direction)$/iu.test(cleanedTitle)) {
      return t('message.step_draft_layout');
    }
    if (/^(generate image|create image|image generation)$/iu.test(cleanedTitle)) {
      return t('message.step_generate_image');
    }
    if (/^(respond to user|write answer|draft response|finali[sz]e response|polish copy|summari[sz]e findings|summari[sz]e results?|wrap up)$/iu.test(cleanedTitle)) {
      return t('message.step_compose_answer');
    }

    return cleanedTitle;
  };

  const visibleAgentSteps = (agentProcess?.steps ?? [])
    .map((step) => {
      const displayTitle = getAgentStepTitle(step.title);
      if (!displayTitle) {
        return null;
      }

      return {
        ...step,
        displayTitle,
      };
    })
    .filter((step): step is NonNullable<typeof step> => step !== null);

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
            <div className="pointer-events-none absolute right-0 bottom-full z-50 mb-2 hidden w-max group-hover:block">
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
      <div className="mb-2 flex items-center gap-2 text-[11px]">
        <span className="font-medium tracking-[0.02em] text-slate-700 dark:text-white/85">
          {displayModelName}
        </span>
        <span
          className="cursor-default tabular-nums text-slate-400 dark:text-white/45"
          title={fullDateTime}
        >
          {messageTime}
        </span>
      </div>

      {/* Agent thinking steps */}
      {isAgentMessage && processPanelVisible && (
        <Reasoning className="mb-3 mt-2" isStreaming={isPending} defaultOpen={isPending} durationMs={isPending ? pendingElapsedMs : agentProcess?.thinkingDurationMs}>
          <ReasoningTrigger aria-label={t('message.agent_process')}>
            <BrainIcon className="size-4 shrink-0" />
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-sm text-slate-600 dark:text-white/68">
                {isPending ? getAgentStatusText() : formatThoughtSummary(agentProcess?.thinkingDurationMs)}
              </span>
              {durationText && (
                <span className="text-[11px] tabular-nums text-slate-400 dark:text-white/40">
                  {durationText}
                </span>
              )}
              {(statusMetrics.stepCount > 0 || statusMetrics.toolCount > 0 || statusMetrics.citationCount > 0) && (
                <span className="text-[11px] text-slate-400 dark:text-white/40">
                  {[
                    statusMetrics.stepCount > 0 ? t('message.metrics_steps', { count: statusMetrics.stepCount }) : null,
                    statusMetrics.toolCount > 0 ? t('message.metrics_tools', { count: statusMetrics.toolCount }) : null,
                    statusMetrics.citationCount > 0 ? t('message.metrics_sources', { count: statusMetrics.citationCount }) : null,
                  ].filter(Boolean).join(' · ')}
                </span>
              )}
            </div>
          </ReasoningTrigger>
          <ReasoningContent>
            <div className="space-y-4">
              {visibleAgentSteps.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[11px] font-medium text-slate-400 dark:text-white/40">{t('message.process_steps')}</p>
                  {visibleAgentSteps.map((step) => {
                    const isDone = !isPending || step.status === 'completed';

                    return (
                      <div key={step.id} className="flex items-center gap-2 text-xs text-slate-500 dark:text-white/55">
                        {isDone ? (
                          <CheckCircle2 className="size-3.5 text-slate-400 dark:text-white/40" />
                        ) : (
                          <CircleDashed className="size-3.5 animate-[pulse_1.5s_ease-in-out_infinite] text-slate-400 dark:text-white/40" />
                        )}
                        <span className={cn(!isDone && "animate-[pulse_1.5s_ease-in-out_infinite]")}>
                          {step.displayTitle}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {agentToolUiParts.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-medium text-slate-400 dark:text-white/40">{t('message.process_tools')}</p>
                  <div className="space-y-3">
                    {agentToolUiParts.map((part) => (
                      <div key={part.id} className="flex items-start gap-2.5 text-xs">
                        <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-white/[0.04] dark:text-white/55">
                          {getToolIcon(part.tool)}
                        </div>
                        <div className="min-w-0 space-y-1">
                          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="font-medium text-slate-700 dark:text-white/78">
                              {getToolTitle(part.tool)}
                            </span>
                            <span className="text-[11px] text-slate-400 dark:text-white/40">
                              {part.state === 'input-available'
                                ? t('message.tool_status_running')
                                : t('message.tool_status_completed')}
                            </span>
                          </div>
                          {(part.outputText || part.imageUrl) && (
                            <p className="leading-5 text-slate-400 dark:text-white/42">
                              {part.outputText || t('message.tool_generated_asset')}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {citations.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[11px] font-medium text-slate-400 dark:text-white/40">{t('message.citations')}</p>
                  {citations.slice(0, 3).map((citation) => (
                    <p key={citation.url} className="truncate text-xs text-slate-500 dark:text-white/55">
                      {citation.title}
                    </p>
                  ))}
                </div>
              )}

              {isPending && (!agentProcess?.steps || agentProcess.steps.length === 0) && (
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-white/55">
                  <CircleDashed className="size-3.5 animate-[pulse_1.5s_ease-in-out_infinite] text-slate-400 dark:text-white/40" />
                  <span className="animate-[pulse_1.5s_ease-in-out_infinite]">{getAgentStatusText()}</span>
                </div>
              )}
            </div>
          </ReasoningContent>
        </Reasoning>
      )}

      {/* Message content */}
      <div className="chat-message-ai">
        <ChatMarkdown
          content={isAgentMessage ? cleanAgentContent(message.content) : message.content}
          streaming={isPending}
        />
      </div>

      {/* Optional reasoning/thinking summary (classic mode only) */}
      {!isAgentMessage && metadata?.thinking && (
        <Reasoning className="mt-3" defaultOpen={false}>
          <ReasoningTrigger>
            <BrainIcon className="size-4 shrink-0" />
            <span className="text-sm text-slate-600 dark:text-white/68">
              {t('message.thought_done')}
            </span>
          </ReasoningTrigger>
          <ReasoningContent>
            <div className="space-y-2">
              <p className="text-[11px] font-medium text-slate-400 dark:text-white/40">{t('message.thinking_details')}</p>
              <div className="text-sm text-slate-600 dark:text-white/65">
                <ChatMarkdown content={metadata.thinking} />
              </div>
            </div>
          </ReasoningContent>
        </Reasoning>
      )}

      {/* Collapsible info section (if there's a plan/process) */}
      {metadata?.plan && (
        <Reasoning className="mt-3" defaultOpen={false}>
          <ReasoningTrigger>
            <Search className="size-4 shrink-0" />
            <span className="text-sm text-slate-600 dark:text-white/68">{t('message.view_full_report')}</span>
          </ReasoningTrigger>
          <ReasoningContent>
            <div className="space-y-2">
              <p className="text-[11px] font-medium text-slate-400 dark:text-white/40">{t('message.design_details')}</p>
              <div className="text-sm leading-6 whitespace-pre-wrap text-slate-600 dark:text-white/65">
                {metadata.plan}
              </div>
              {metadata.ops && metadata.ops.length > 0 && (
                <p className="text-xs text-slate-400 dark:text-white/42">
                  {t('message.ops_count', { count: metadata.ops.length })}
                </p>
              )}
            </div>
          </ReasoningContent>
        </Reasoning>
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
