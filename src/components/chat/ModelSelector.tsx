/**
 * ModelSelector Component
 * Icon button to select AI model for chat.
 * Displays both system models and user-configured (BYOK) models in a unified dropdown.
 * Requirements: 6.1-6.6
 */

'use client';

import { useCallback, useRef, useState } from 'react';
import { Check, Image as ImageIcon, MessageSquare, Zap, Key } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  getClassicSelectableModels,
  type SelectableModel,
} from '@/lib/models/resolve-selectable-models';
import { useSelectableModels } from '@/lib/store/useChatStore';

interface ModelSelectorProps {
  selectedModel: string;
  onModelChange: (modelValue: string) => void;
  disabled?: boolean;
  allowedTypes?: Array<SelectableModel['type']>;
  showPricing?: boolean;
  tooltipLabel?: string;
}

export function ModelSelector({
  selectedModel,
  onModelChange,
  disabled = false,
  allowedTypes,
  showPricing = true,
  tooltipLabel,
}: ModelSelectorProps) {
  const models = useSelectableModels();
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const filteredModels = allowedTypes?.length
    ? models.filter((model) => allowedTypes.includes(model.type))
    : getClassicSelectableModels(models);
  const currentModel = filteredModels.find((m) => m.value === selectedModel) || filteredModels[0];
  const currentIsImageModel = currentModel?.type === 'image';
  const tooltipText = currentModel?.displayName || '选择模型';
  const triggerLabel = tooltipLabel || tooltipText;

  // Group models
  const imageModels = filteredModels.filter((m) => m.type === 'image');
  const opsModels = filteredModels.filter((m) => m.type === 'ops');

  const logFloatingState = useCallback((source: 'tooltip' | 'dropdown', open: boolean) => {
    if (process.env.NODE_ENV !== 'development') {
      return;
    }

    const triggerRect = triggerRef.current?.getBoundingClientRect();
    console.log(`[ModelSelector] ${source} open change`, {
      open,
      selectedModel,
      triggerRect: triggerRect ? {
        top: Math.round(triggerRect.top),
        right: Math.round(triggerRect.right),
        bottom: Math.round(triggerRect.bottom),
        left: Math.round(triggerRect.left),
        width: Math.round(triggerRect.width),
        height: Math.round(triggerRect.height),
      } : null,
    });

    if (source !== 'dropdown' || !open) {
      return;
    }

    const logContentPosition = (phase: string) => {
      const content = document.querySelector<HTMLElement>('[data-model-selector-content="true"][data-state="open"]');
      const contentRect = content?.getBoundingClientRect();

      console.log(`[ModelSelector] dropdown content ${phase}`, {
        side: content?.dataset.side ?? null,
        align: content?.dataset.align ?? null,
        transform: content?.style.transform ?? null,
        contentRect: contentRect ? {
          top: Math.round(contentRect.top),
          right: Math.round(contentRect.right),
          bottom: Math.round(contentRect.bottom),
          left: Math.round(contentRect.left),
          width: Math.round(contentRect.width),
          height: Math.round(contentRect.height),
        } : null,
      });
    };

    requestAnimationFrame(() => {
      logContentPosition('raf-1');
      requestAnimationFrame(() => {
        logContentPosition('raf-2');
      });
    });
  }, [selectedModel]);

  return (
    <DropdownMenu
      open={isOpen}
      onOpenChange={(open) => {
        logFloatingState('dropdown', open);
        setIsOpen(open);
      }}
    >
      <Tooltip onOpenChange={(open) => logFloatingState('tooltip', open)}>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              ref={triggerRef}
              variant="ghost"
              disabled={disabled}
              aria-label={triggerLabel}
              className="h-7 max-w-[132px] rounded-full border border-slate-200 bg-white/85 px-2.5 text-slate-600 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors hover:bg-slate-50 hover:text-slate-800 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/70 dark:hover:bg-white/[0.06] dark:hover:text-white"
            >
              <span className="flex min-w-0 items-center gap-1.5">
                {currentIsImageModel ? (
                  <ImageIcon className="size-3.5 shrink-0" />
                ) : (
                  <MessageSquare className="size-3.5 shrink-0" />
                )}
                <span className="truncate text-[11px] font-medium">
                  {currentModel?.displayName || triggerLabel}
                </span>
              </span>
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>
          <div className="flex items-center gap-1.5">
            <span>{tooltipLabel ? `${tooltipLabel}: ${tooltipText}` : tooltipText}</span>
            {showPricing && currentModel && !currentModel.isByok && (
              <span className="flex items-center gap-0.5 text-amber-500">
                <Zap className="size-3" />
                {currentModel.pointsCost}
              </span>
            )}
            {currentModel?.isByok && (
              <span className="text-xs text-emerald-500 font-medium">BYOK</span>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent
        data-model-selector-content="true"
        align="start"
        className="w-72 rounded-2xl border border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(244,247,251,0.98))] p-1 shadow-[0_16px_40px_rgba(15,23,42,0.12)] dark:border-white/10 dark:bg-[#1A1028]"
      >
        {/* Image Generation Models */}
        {imageModels.length > 0 && (
          <>
            <DropdownMenuLabel className="px-2 py-1 text-[11px] font-medium tracking-[0.02em] text-slate-500 dark:text-white/55">
              图像生成
            </DropdownMenuLabel>
            {imageModels.map((model) => (
              <DropdownMenuItem
                key={model.value}
                onClick={() => onModelChange(model.value)}
                className="flex cursor-pointer items-center justify-between gap-2 rounded-xl px-2.5 py-2.5 outline-none transition-colors hover:bg-slate-900/[0.035] focus:bg-slate-900/[0.045] dark:hover:bg-white/[0.05] dark:focus:bg-white/[0.06]"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white/85 text-slate-500 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-white/10 dark:bg-white/[0.04] dark:text-white/60">
                    <ImageIcon className="size-3.5 shrink-0" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-medium text-slate-800 dark:text-white/90">{model.displayName}</span>
                      {model.isByok && (
                        <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                          <Key className="size-2.5" />
                          BYOK
                        </span>
                      )}
                    </div>
                    {model.description && (
                      <span className="truncate text-xs text-slate-500 dark:text-white/50">
                        {model.description}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {showPricing && model.isByok ? (
                    <span className="text-xs font-medium text-emerald-500">免费</span>
                  ) : showPricing ? (
                    <span className="flex items-center gap-0.5 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-xs text-amber-600 dark:text-amber-400">
                      <Zap className="size-3" />
                      {model.pointsCost}
                    </span>
                  ) : null}
                  {!showPricing && model.isByok ? (
                    <span className="text-[10px] text-slate-400 dark:text-white/45">BYOK</span>
                  ) : null}
                  {selectedModel === model.value && (
                    <Check className="size-3.5 text-cyan-600 dark:text-cyan-400" />
                  )}
                </div>
              </DropdownMenuItem>
            ))}
          </>
        )}

        {/* Separator */}
        {imageModels.length > 0 && opsModels.length > 0 && (
          <DropdownMenuSeparator className="my-1 bg-slate-200/80 dark:bg-white/8" />
        )}

        {/* Ops/Text Generation Models */}
        {opsModels.length > 0 && (
          <>
            <DropdownMenuLabel className="px-2 py-1 text-[11px] font-medium tracking-[0.02em] text-slate-500 dark:text-white/55">
              文本生成
            </DropdownMenuLabel>
            {opsModels.map((model) => (
              <DropdownMenuItem
                key={model.value}
                onClick={() => onModelChange(model.value)}
                className="flex cursor-pointer items-center justify-between gap-2 rounded-xl px-2.5 py-2.5 outline-none transition-colors hover:bg-slate-900/[0.035] focus:bg-slate-900/[0.045] dark:hover:bg-white/[0.05] dark:focus:bg-white/[0.06]"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white/85 text-slate-500 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-white/10 dark:bg-white/[0.04] dark:text-white/60">
                    <MessageSquare className="size-3.5 shrink-0" />
                  </div>
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium text-slate-800 dark:text-white/90">{model.displayName}</span>
                    {model.description && (
                      <span className="truncate text-xs text-slate-500 dark:text-white/50">
                        {model.description}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {showPricing && !model.isByok ? (
                    <span className="flex items-center gap-0.5 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-xs text-amber-600 dark:text-amber-400">
                      <Zap className="size-3" />
                      {model.pointsCost}
                    </span>
                  ) : null}
                  {!showPricing && model.isByok ? (
                    <span className="text-[10px] text-slate-400 dark:text-white/45">BYOK</span>
                  ) : null}
                  {selectedModel === model.value && (
                    <Check className="size-3.5 text-cyan-600 dark:text-cyan-400" />
                  )}
                </div>
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default ModelSelector;
