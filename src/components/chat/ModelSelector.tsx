/**
 * ModelSelector Component
 * Icon button to select AI model for chat.
 * Displays both system models and user-configured (BYOK) models in a unified dropdown.
 * Requirements: 6.1-6.6
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
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
import { fetchModels } from '@/lib/supabase/queries/models';
import { fetchUserProviderConfigs } from '@/lib/api/provider-configs';
import {
  getClassicSelectableModels,
  resolveSelectableModels,
  type SelectableModel,
} from '@/lib/models/resolve-selectable-models';

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
  const [models, setModels] = useState<SelectableModel[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const loadModels = useCallback(async () => {
    try {
      const [systemModels, userConfigs] = await Promise.all([
        fetchModels(),
        fetchUserProviderConfigs().catch(() => []),
      ]);
      setModels(resolveSelectableModels(systemModels, userConfigs));
    } catch (err) {
      console.error('[ModelSelector] Failed to load models:', err);
    }
  }, []);

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  const filteredModels = allowedTypes?.length
    ? models.filter((model) => allowedTypes.includes(model.type))
    : getClassicSelectableModels(models);
  const currentModel = filteredModels.find((m) => m.value === selectedModel) || filteredModels[0];
  const currentIsImageModel = currentModel?.type === 'image';
  const tooltipText = currentModel?.displayName || '选择模型';

  // Group models
  const imageModels = filteredModels.filter((m) => m.type === 'image');
  const opsModels = filteredModels.filter((m) => m.type === 'ops');

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              disabled={disabled}
              aria-label={tooltipLabel || tooltipText}
              className="size-6 rounded-full text-[#888] hover:text-[#1A1A1A] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 border border-black/10 dark:border-white/10"
            >
              {currentIsImageModel ? (
                <ImageIcon className="size-3.5" />
              ) : (
                <MessageSquare className="size-3.5" />
              )}
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
      <DropdownMenuContent align="start" className="w-56">
        {/* Image Generation Models */}
        {imageModels.length > 0 && (
          <>
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              图像生成
            </DropdownMenuLabel>
            {imageModels.map((model) => (
              <DropdownMenuItem
                key={model.value}
                onClick={() => onModelChange(model.value)}
                className="flex items-center justify-between gap-2 py-2 cursor-pointer"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <ImageIcon className="size-3.5 text-muted-foreground shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm truncate">{model.displayName}</span>
                      {model.isByok && (
                        <span className="inline-flex items-center gap-0.5 px-1 py-0 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                          <Key className="size-2.5" />
                          BYOK
                        </span>
                      )}
                    </div>
                    {model.description && (
                      <span className="text-xs text-muted-foreground truncate">
                        {model.description}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {showPricing && model.isByok ? (
                    <span className="text-xs text-emerald-500 font-medium">免费</span>
                  ) : showPricing ? (
                    <span className="flex items-center gap-0.5 text-xs text-amber-500">
                      <Zap className="size-3" />
                      {model.pointsCost}
                    </span>
                  ) : null}
                  {!showPricing && model.isByok ? (
                    <span className="text-[10px] text-muted-foreground">BYOK</span>
                  ) : null}
                  {selectedModel === model.value && (
                    <Check className="size-3.5 text-primary" />
                  )}
                </div>
              </DropdownMenuItem>
            ))}
          </>
        )}

        {/* Separator */}
        {imageModels.length > 0 && opsModels.length > 0 && (
          <DropdownMenuSeparator />
        )}

        {/* Ops/Text Generation Models */}
        {opsModels.length > 0 && (
          <>
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              文本生成
            </DropdownMenuLabel>
            {opsModels.map((model) => (
              <DropdownMenuItem
                key={model.value}
                onClick={() => onModelChange(model.value)}
                className="flex items-center justify-between gap-2 py-2 cursor-pointer"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <MessageSquare className="size-3.5 text-muted-foreground shrink-0" />
                  <span className="text-sm truncate">{model.displayName}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {showPricing && !model.isByok ? (
                    <span className="flex items-center gap-0.5 text-xs text-amber-500">
                      <Zap className="size-3" />
                      {model.pointsCost}
                    </span>
                  ) : null}
                  {!showPricing && model.isByok ? (
                    <span className="text-[10px] text-muted-foreground">BYOK</span>
                  ) : null}
                  {selectedModel === model.value && (
                    <Check className="size-3.5 text-primary" />
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
