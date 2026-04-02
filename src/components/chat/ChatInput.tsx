/**
 * ChatInput Component - Lovart style
 * Clean input with toolbar at bottom, supports image references
 */

'use client';

import { useState, useRef, KeyboardEvent, useCallback, useImperativeHandle, forwardRef, useEffect } from 'react';
import { AtSign, ArrowUp, MessageSquare, Bot, X } from 'lucide-react';
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

  const canSend = message.trim().length > 0 && !disabled && !isLoading && !isBusy;
  const isInputDisabled = disabled || isBusy;

  return (
    <div className="relative px-3 pb-3 pt-1">
      {/* Mention menu */}
      {showMentionMenu && (
        <div
          ref={mentionMenuRef}
          className={cn(
            "absolute bottom-full left-3 z-50 mb-2 w-[320px] max-w-[calc(100%-1.5rem)] overflow-hidden rounded-2xl",
            "border border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(244,247,251,0.98))]",
            "shadow-[0_16px_40px_rgba(15,23,42,0.12)]",
            "dark:border-white/10 dark:bg-[#1A1028]"
          )}
        >
          <div className="border-b border-slate-200/80 px-3 py-2 dark:border-white/8">
            <span className="text-[11px] font-medium tracking-[0.02em] text-slate-500 dark:text-white/55">
              {t('assets.this_project')}
            </span>
          </div>
          <div className="max-h-[160px] overflow-y-auto">
            {assetsLoading ? (
              <div className="p-3 text-center text-xs text-slate-400 dark:text-white/45">{tCommon('actions.loading')}</div>
            ) : assets.length === 0 ? (
              <div className="p-3 text-center text-xs text-slate-400 dark:text-white/45">{t('assets.no_images')}</div>
            ) : (
              assets.map((asset, index) => (
                <button
                  key={asset.id}
                  onClick={() => handleSelectAsset(asset)}
                  className={cn(
                    "flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors",
                    index === selectedIndex 
                      ? "bg-slate-900/[0.045] dark:bg-white/10" 
                      : "hover:bg-slate-900/[0.025] dark:hover:bg-white/5"
                  )}
                >
                  <div className="relative size-7 overflow-hidden rounded-lg bg-slate-100 dark:bg-[#333]">
                    <Image
                      src={asset.url}
                      alt={asset.filename || t('assets.generated_image')}
                      fill
                      unoptimized
                      sizes="24px"
                      className="object-cover"
                    />
                  </div>
                  <span className="flex-1 truncate text-xs text-slate-700 dark:text-white/88">
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
        "overflow-hidden rounded-[24px]",
        "border border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(245,247,250,0.98))]",
        "shadow-[0_10px_30px_rgba(15,23,42,0.06)]",
        "transition-all dark:border-white/10 dark:bg-[#1A1028]"
      )}>
        {/* Textarea with inline image reference */}
        <div className="px-4 pt-4 pb-3">
          {/* Referenced image chip */}
          {referencedImage && (
            <div className="mb-3 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white/85 px-2 py-1.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-white/10 dark:bg-white/[0.06]">
              <div className="relative size-5 rounded overflow-hidden flex-shrink-0">
                <Image
                  src={referencedImage.url}
                  alt={t('assets.reference_image')}
                  fill
                  unoptimized
                  sizes="20px"
                  className="object-cover"
                />
              </div>
              <span className="max-w-[120px] truncate text-xs font-medium text-slate-600 dark:text-white/70">
                {referencedImage.filename}
              </span>
              <button
                type="button"
                onClick={() => setReferencedImage(null)}
                className="text-slate-400 transition-colors hover:text-slate-600 dark:text-white/40 dark:hover:text-white/70"
              >
                <X className="size-3" />
              </button>
            </div>
          )}
          <div className="flex items-start gap-1">
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
                "text-[14px] leading-6 text-slate-800 dark:text-white",
                "placeholder:text-slate-400 dark:placeholder:text-[#666]",
                "focus:outline-none",
                isBusy && "cursor-not-allowed opacity-60"
              )}
            />
          </div>
        </div>

        {/* Bottom toolbar - inside the box */}
        <div className="flex items-center justify-between border-t border-slate-200/80 px-3.5 py-3 dark:border-white/8">
          {/* Left: Mode toggle + Model selector + attachment buttons */}
          <div className="flex items-center gap-1.5">
            <div className="inline-flex items-center rounded-full border border-slate-200 bg-white/85 p-[3px] shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-white/10 dark:bg-white/[0.04]">
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
                          "rounded-full px-2.5 py-1.5 text-[11px] font-medium transition-colors",
                          isActive
                            ? "bg-slate-900 text-white shadow-[0_4px_10px_rgba(15,23,42,0.18)] dark:bg-white dark:text-black"
                            : "text-slate-500 hover:text-slate-700 dark:hover:text-white",
                        )}
                      >
                        <span className="flex items-center gap-1.5">
                          {mode === 'classic'
                            ? <MessageSquare className="size-3" />
                            : <Bot className="size-3" />
                          }
                          <span>{mode === 'classic' ? t('modes.classic') : t('modes.agent')}</span>
                        </span>
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
            {chatMode === 'classic' && onResolutionChange && onAspectRatioChange && (
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
                    "size-7 rounded-full border border-slate-200 bg-white/85 text-slate-500 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:bg-slate-50 hover:text-slate-700 dark:border-white/10 dark:bg-white/[0.04]",
                    showMentionMenu 
                      ? "border-slate-900 bg-slate-900 text-white hover:bg-slate-800 hover:text-white dark:bg-white dark:text-black" 
                      : ""
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
          <div className="flex items-center gap-1.5">
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
                    "size-8 rounded-full transition-all shadow-[0_8px_18px_rgba(15,23,42,0.12)]",
                    canSend 
                      ? "bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-black" 
                      : "bg-slate-200 text-slate-400 shadow-none dark:bg-[#333] dark:text-[#666]"
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
