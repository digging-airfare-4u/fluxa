/**
 * ChatInput Component - Lovart style
 * Clean input with toolbar at bottom, supports image references
 */

'use client';

import { useState, useRef, KeyboardEvent, useCallback, useImperativeHandle, forwardRef, useEffect, type MouseEvent as ReactMouseEvent } from 'react';
import { AtSign, ArrowUp, MessageSquare, Bot } from 'lucide-react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { LoadingDots } from '@/components/ui/LoadingDots';
import { ModelSelector } from './ModelSelector';
import { AspectRatioSelector, type AspectRatio } from './AspectRatioSelector';
import { ResolutionSelector, type Resolution } from './ResolutionSelector';
import { cn } from '@/lib/utils';
import { fetchProjectAssets, type Asset } from '@/lib/supabase/queries/assets';

export interface ChatInputRef {
  focus: () => void;
}

export interface ReferencedImage {
  id: string;
  url: string;
  filename: string;
}

export type ChatMode = 'classic' | 'agent';

interface ChatInputProps {
  onSend: (message: string, model?: string, referencedImage?: ReferencedImage) => void;
  onAttach?: () => void;
  onCancel?: () => void;
  onLocateImage?: (imageUrl: string) => void;
  disabled?: boolean;
  isLoading?: boolean;
  isBusy?: boolean;
  placeholder?: string;
  chatMode?: 'classic' | 'agent';
  onChatModeChange?: (mode: ChatMode) => void;
  selectedModel?: string;
  selectedAgentModel?: string;
  selectedAgentImageModel?: string;
  onModelChange?: (model: string) => void;
  onAgentModelChange?: (model: string) => void;
  onAgentImageModelChange?: (model: string) => void;
  selectedResolution?: Resolution;
  onResolutionChange?: (resolution: Resolution) => void;
  selectedAspectRatio?: AspectRatio;
  onAspectRatioChange?: (ratio: AspectRatio) => void;
  membershipLevel?: 'free' | 'pro' | 'team';
  projectId?: string;
  resolutionModelName?: string;
}

export const ChatInput = forwardRef<ChatInputRef, ChatInputProps>(function ChatInput({
  onSend,
  onCancel,
  disabled = false,
  isLoading = false,
  isBusy = false,
  placeholder,
  chatMode = 'classic',
  onChatModeChange,
  selectedModel = '',
  selectedAgentModel = '',
  selectedAgentImageModel = '',
  onModelChange,
  onAgentModelChange,
  onAgentImageModelChange,
  selectedResolution = '1K',
  onResolutionChange,
  selectedAspectRatio = '1:1',
  onAspectRatioChange,
  membershipLevel = 'free',
  projectId,
  resolutionModelName,
}, ref) {
  const t = useTranslations('chat');
  const tCommon = useTranslations('common');
  const [message, setMessage] = useState('');
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [referencedImage, setReferencedImage] = useState<ReferencedImage | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const chatModes: ChatMode[] = ['classic', 'agent'];
  
  // Use provided placeholder or default from translations
  const inputPlaceholder = placeholder || t('input.placeholder');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mentionMenuRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
  }), []);

  const loadMentionAssets = useCallback(async () => {
    if (!projectId) {
      setAssets([]);
      return;
    }

    setAssetsLoading(true);
    try {
      const data = await fetchProjectAssets(projectId);
      const filtered = data.filter((asset) => asset.metadata?.source?.type !== 'canvas_tool');
      setAssets(filtered);
    } catch (error) {
      console.error(error);
    } finally {
      setAssetsLoading(false);
    }
  }, [projectId]);

  const openMentionMenu = useCallback(() => {
    setShowMentionMenu(true);
    setSelectedIndex(0);
    void loadMentionAssets();
  }, [loadMentionAssets]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (mentionMenuRef.current && !mentionMenuRef.current.contains(e.target as Node)) {
        setShowMentionMenu(false);
      }
    };
    if (showMentionMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMentionMenu]);

  const handleSend = useCallback(() => {
    const trimmed = message.trim();
    if (trimmed && !disabled && !isLoading && !isBusy) {
      const modelForSend = chatMode === 'agent'
        ? selectedAgentModel || undefined
        : selectedModel || undefined;
      onSend(trimmed, modelForSend, referencedImage || undefined);
      setMessage('');
      setReferencedImage(null);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  }, [message, disabled, isLoading, isBusy, onSend, chatMode, selectedModel, selectedAgentModel, referencedImage]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle mention menu navigation
    if (showMentionMenu && assets.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % assets.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + assets.length) % assets.length);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSelectAsset(assets[selectedIndex]);
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        handleSelectAsset(assets[selectedIndex]);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
      return;
    }
    if (e.key === 'Escape') {
      if (showMentionMenu) {
        setShowMentionMenu(false);
      } else if (onCancel) {
        e.preventDefault();
        onCancel();
        textareaRef.current?.blur();
      }
    }
    // Delete referenced image when backspace at start of empty input
    if (e.key === 'Backspace' && message === '' && referencedImage) {
      e.preventDefault();
      setReferencedImage(null);
    }
  };

  // Detect @ input to show mention menu
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const prevValue = message;
    
    // Check if user just typed @
    if (newValue.length > prevValue.length && newValue.endsWith('@')) {
      openMentionMenu();
    }
    
    setMessage(newValue);
  };

  const handleInput = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  };

  const handleSelectAsset = (asset: Asset) => {
    setReferencedImage({
      id: asset.id,
      url: asset.url,
      filename: asset.filename || '图片',
    });
    setShowMentionMenu(false);
    // Remove @ from message if user typed it (anywhere in the message)
    setMessage(prev => prev.replace(/@$/, '').replace(/@\s*$/, ''));
    textareaRef.current?.focus();
  };

  const handleReferencedImageClick = useCallback((e: ReactMouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // Keep the referenced image attached in the input and retain typing flow.
    textareaRef.current?.focus();
  }, []);

  const canSend = message.trim().length > 0 && !disabled && !isLoading && !isBusy;
  const isInputDisabled = disabled || isBusy;

  return (
    <div className="p-3 relative">
      {/* Mention menu */}
      {showMentionMenu && (
        <div
          ref={mentionMenuRef}
          className="absolute bottom-full left-3 mb-2 w-[300px] max-w-[calc(100%-1.5rem)] bg-white dark:bg-[#1A1028] rounded-lg border border-black/10 dark:border-white/10 shadow-lg overflow-hidden z-50"
        >
          <div className="px-2 py-1.5 border-b border-black/5 dark:border-white/5">
            <span className="text-xs text-[#888]">{t('assets.this_project')}</span>
          </div>
          <div className="max-h-[160px] overflow-y-auto">
            {assetsLoading ? (
              <div className="p-3 text-center text-xs text-[#888]">{tCommon('actions.loading')}</div>
            ) : assets.length === 0 ? (
              <div className="p-3 text-center text-xs text-[#888]">{t('assets.no_images')}</div>
            ) : (
              assets.map((asset, index) => (
                <button
                  key={asset.id}
                  onClick={() => handleSelectAsset(asset)}
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1.5 transition-colors",
                    index === selectedIndex 
                      ? "bg-black/10 dark:bg-white/10" 
                      : "hover:bg-black/5 dark:hover:bg-white/5"
                  )}
                >
                  <div className="relative size-6 rounded overflow-hidden bg-[#f0f0f0] dark:bg-[#333]">
                    <Image
                      src={asset.url}
                      alt={asset.filename || t('assets.generated_image')}
                      fill
                      unoptimized
                      sizes="24px"
                      className="object-cover"
                    />
                  </div>
                  <span className="text-xs text-[#1A1A1A] dark:text-white truncate flex-1 text-left">
                    {asset.metadata?.generation?.prompt || asset.filename || t('assets.generated_image')}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Input container - white box with border and shadow */}
      <div className={cn(
        "rounded-xl bg-white dark:bg-[#1A1028]",
        "border border-black/10 dark:border-white/10",
        "shadow-sm",
        "transition-all"
      )}>
        {/* Textarea with inline image reference */}
        <div className="px-4 pt-3 pb-2">
          <div className="flex items-start gap-1">
            {/* Inline referenced image */}
            {referencedImage && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="relative size-4 rounded overflow-hidden cursor-pointer flex-shrink-0 mt-[3px] hover:ring-2 hover:ring-primary/50"
                    onClick={handleReferencedImageClick}
                  >
                    <Image
                      src={referencedImage.url}
                      alt={t('assets.reference_image')}
                      fill
                      unoptimized
                      sizes="16px"
                      className="object-cover"
                    />
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="right"
                  align="start"
                  sideOffset={8}
                  collisionPadding={16}
                  className="p-1 bg-white dark:bg-[#1A1028]"
                >
                  <div
                    className="relative rounded overflow-hidden"
                    style={{
                      width: 180,
                      height: 180,
                      maxWidth: 'calc(100vw - 2rem)',
                      maxHeight: 'calc(100vh - 6rem)',
                    }}
                  >
                    <Image
                      src={referencedImage.url}
                      alt={t('assets.reference_image')}
                      fill
                      unoptimized
                      sizes="180px"
                      className="object-contain"
                    />
                  </div>
                </TooltipContent>
              </Tooltip>
            )}
            <textarea
              ref={textareaRef}
              value={message}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onInput={handleInput}
              placeholder={inputPlaceholder}
              disabled={disabled || isLoading}
              readOnly={isBusy}
              rows={6}
              className={cn(
                "flex-1 min-h-[108px] max-h-[160px] resize-none bg-transparent",
                "text-sm text-[#1A1A1A] dark:text-white leading-[18px]",
                "placeholder:text-[#999] dark:placeholder:text-[#666]",
                "focus:outline-none",
                isBusy && "cursor-not-allowed opacity-60"
              )}
            />
          </div>
        </div>

        {/* Bottom toolbar - inside the box */}
        <div className="flex items-center justify-between px-3 pb-2.5">
          {/* Left: Mode toggle + Model selector + attachment buttons */}
          <div className="flex items-center gap-0.5">
            <div className="inline-flex items-center rounded-full border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.04] p-[2px] mr-0.5">
              {chatModes.map((mode) => {
                const isActive = mode === chatMode;
                return (
                  <Tooltip key={mode}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => onChatModeChange?.(mode)}
                        disabled={isInputDisabled}
                        className={cn(
                          "rounded-full p-1 transition-colors",
                          isActive
                            ? "bg-[#1A1A1A] text-white dark:bg-white dark:text-black"
                            : "text-[#888] hover:text-[#1A1A1A] dark:hover:text-white",
                        )}
                      >
                        {mode === 'classic'
                          ? <MessageSquare className="size-3" />
                          : <Bot className="size-3" />
                        }
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {mode === 'classic' ? t('modes.classic') : t('modes.agent')}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
            {chatMode === 'classic' ? (
              <ModelSelector
                selectedModel={selectedModel}
                onModelChange={onModelChange || (() => {})}
                disabled={isInputDisabled}
              />
            ) : (
              <ModelSelector
                selectedModel={selectedAgentImageModel}
                onModelChange={onAgentImageModelChange || (() => {})}
                disabled={isInputDisabled}
                allowedTypes={['image']}
                showPricing={false}
                tooltipLabel={t('model_selector.agent_image_model')}
              />
            )}
            {onResolutionChange && onAspectRatioChange && (
              <div className="flex items-center gap-0.5">
                <ResolutionSelector
                  selectedResolution={selectedResolution}
                  onResolutionChange={onResolutionChange}
                  membershipLevel={membershipLevel}
                  modelName={resolutionModelName || selectedModel}
                  disabled={isInputDisabled}
                />
                <AspectRatioSelector
                  selectedRatio={selectedAspectRatio}
                  onRatioChange={onAspectRatioChange}
                  disabled={isInputDisabled}
                />
              </div>
            )}

            {/* <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 rounded-full text-[#888] hover:text-[#1A1A1A] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 border border-black/10 dark:border-white/10"
                  onClick={onAttach}
                  disabled={isInputDisabled}
                >
                  <Paperclip className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>添加附件</TooltipContent>
            </Tooltip> */}

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "size-6 rounded-full border border-black/10 dark:border-white/10",
                    showMentionMenu 
                      ? "bg-[#1A1A1A] dark:bg-white text-white dark:text-black" 
                      : "text-[#888] hover:text-[#1A1A1A] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5"
                  )}
                  onClick={() => {
                    if (showMentionMenu) {
                      setShowMentionMenu(false);
                    } else {
                      openMentionMenu();
                    }
                  }}
                  disabled={isInputDisabled}
                >
                  <AtSign className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('assets.reference_image')}</TooltipContent>
            </Tooltip>
          </div>

          {/* Right: Action buttons + send */}
          <div className="flex items-center gap-0.5">
            {/* <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 rounded-full text-[#888] hover:text-[#1A1A1A] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 border border-black/10 dark:border-white/10"
                  disabled={isInputDisabled}
                >
                  <Lightbulb className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>灵感</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 rounded-full text-[#888] hover:text-[#1A1A1A] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 border border-black/10 dark:border-white/10"
                  disabled={isInputDisabled}
                >
                  <Globe className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>联网搜索</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 rounded-full text-[#888] hover:text-[#1A1A1A] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 border border-black/10 dark:border-white/10"
                  disabled={isInputDisabled}
                >
                  <Smile className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>表情</TooltipContent>
            </Tooltip> */}

            {/* Send button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  onClick={handleSend}
                  disabled={!canSend}
                  className={cn(
                    "size-6 rounded-full ml-0.5 transition-all",
                    canSend 
                      ? "bg-[#1A1A1A] dark:bg-white text-white dark:text-black hover:opacity-90" 
                      : "bg-[#E0E0E0] dark:bg-[#333] text-[#999] dark:text-[#666]"
                  )}
                >
                  {isLoading || isBusy ? (
                    <LoadingDots size="sm" />
                  ) : (
                    <ArrowUp className="size-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('input.send')}</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  );
});

export default ChatInput;
