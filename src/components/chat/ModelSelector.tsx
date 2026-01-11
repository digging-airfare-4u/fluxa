/**
 * ModelSelector Component
 * Icon button to select AI model for chat
 */

'use client';

import { useState, useEffect } from 'react';
import { Check, Image, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { fetchModels, type AIModel } from '@/lib/supabase/queries/models';

interface ModelSelectorProps {
  selectedModel: string;
  onModelChange: (modelName: string) => void;
  disabled?: boolean;
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
  const isImageModel = currentModel?.name?.includes('seedream') || currentModel?.name?.includes('dall-e');

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
              {isImageModel ? (
                <Image className="size-3.5" />
              ) : (
                <MessageSquare className="size-3.5" />
              )}
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>{currentModel?.display_name || '选择模型'}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="start" className="w-48">
        {models.map((model) => (
          <DropdownMenuItem
            key={model.id}
            onClick={() => onModelChange(model.name)}
            className="flex items-center justify-between gap-2 py-2 cursor-pointer"
          >
            <div className="flex items-center gap-2">
              {model.name.includes('seedream') || model.name.includes('dall-e') ? (
                <Image className="size-3.5 text-muted-foreground" />
              ) : (
                <MessageSquare className="size-3.5 text-muted-foreground" />
              )}
              <span className="text-sm">{model.display_name}</span>
            </div>
            {selectedModel === model.name && (
              <Check className="size-3.5 text-primary shrink-0" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default ModelSelector;
