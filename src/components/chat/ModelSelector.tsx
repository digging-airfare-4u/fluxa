/**
 * ModelSelector Component
 * Icon button to select AI model for chat
 * Requirements: 6.1, 6.3, 6.5
 */

'use client';

import { useState, useEffect } from 'react';
import { Check, Image, MessageSquare, Zap } from 'lucide-react';
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
import { fetchModels, type AIModel } from '@/lib/supabase/queries/models';

interface ModelSelectorProps {
  selectedModel: string;
  onModelChange: (modelName: string) => void;
  disabled?: boolean;
}

/**
 * Check if model is an image generation model
 * Requirements: 6.6 - distinguish Gemini from other providers
 */
function isImageModel(model: AIModel): boolean {
  // Check by type field first (preferred)
  if (model.type === 'image') return true;
  // Fallback to name-based detection for backwards compatibility
  return model.name.includes('seedream') || 
         model.name.includes('dall-e') || 
         model.name.includes('gemini') && model.name.includes('image');
}

/**
 * Get provider display name
 */
function getProviderLabel(provider: string): string {
  const labels: Record<string, string> = {
    'volcengine': '火山引擎',
    'google': 'Google',
    'openai': 'OpenAI',
    'anthropic': 'Anthropic',
  };
  return labels[provider] || provider;
}

export function ModelSelector({
  selectedModel,
  onModelChange,
  disabled = false,
}: ModelSelectorProps) {
  const [models, setModels] = useState<AIModel[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    fetchModels().then(setModels);
  }, []);

  const currentModel = models.find(m => m.name === selectedModel) || models[0];
  
  // Check if current model is image generation model
  const currentIsImageModel = currentModel ? isImageModel(currentModel) : false;

  // Group models by type
  const imageModels = models.filter(isImageModel);
  const opsModels = models.filter(m => !isImageModel(m));

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              disabled={disabled}
              className="size-6 rounded-full text-[#888] hover:text-[#1A1A1A] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 border border-black/10 dark:border-white/10"
            >
              {currentIsImageModel ? (
                <Image className="size-3.5" />
              ) : (
                <MessageSquare className="size-3.5" />
              )}
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>
          <div className="flex items-center gap-1.5">
            <span>{currentModel?.display_name || '选择模型'}</span>
            {currentModel?.points_cost && (
              <span className="flex items-center gap-0.5 text-amber-500">
                <Zap className="size-3" />
                {currentModel.points_cost}
              </span>
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
                key={model.id}
                onClick={() => onModelChange(model.name)}
                className="flex items-center justify-between gap-2 py-2 cursor-pointer"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Image className="size-3.5 text-muted-foreground shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm truncate">{model.display_name}</span>
                    {model.description && (
                      <span className="text-xs text-muted-foreground truncate">
                        {model.description}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {/* Points cost display - Requirements: 6.5 */}
                  <span className="flex items-center gap-0.5 text-xs text-amber-500">
                    <Zap className="size-3" />
                    {model.points_cost}
                  </span>
                  {selectedModel === model.name && (
                    <Check className="size-3.5 text-primary" />
                  )}
                </div>
              </DropdownMenuItem>
            ))}
          </>
        )}
        
        {/* Separator between model types */}
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
                key={model.id}
                onClick={() => onModelChange(model.name)}
                className="flex items-center justify-between gap-2 py-2 cursor-pointer"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <MessageSquare className="size-3.5 text-muted-foreground shrink-0" />
                  <span className="text-sm truncate">{model.display_name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="flex items-center gap-0.5 text-xs text-amber-500">
                    <Zap className="size-3" />
                    {model.points_cost}
                  </span>
                  {selectedModel === model.name && (
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
