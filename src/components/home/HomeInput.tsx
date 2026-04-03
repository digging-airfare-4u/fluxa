'use client';

/**
 * Home Input Component - Lovart style with typewriter placeholder
 */

import { useState, useCallback, useEffect, useRef, KeyboardEvent, useMemo } from 'react';
import { Paperclip, ArrowUp, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface HomeInputProps {
  onSubmit: (prompt: string) => void;
  isLoading?: boolean;
}

export function HomeInput({
  onSubmit,
  isLoading = false,
}: HomeInputProps) {
  const t = useTranslations('home');
  const [value, setValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [displayText, setDisplayText] = useState('');
  const [textIndex, setTextIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Get placeholder texts from translations
  const placeholderTexts = useMemo(() => [
    t('input.placeholders.tech_poster'),
    t('input.placeholders.business_card'),
    t('input.placeholders.birthday'),
    t('input.placeholders.product'),
    t('input.placeholders.social_cover'),
  ], [t]);

  const defaultPlaceholder = t('input.default_placeholder');

  // Typewriter effect
  useEffect(() => {
    if (isFocused || value) {
      // Stop animation when focused or has value
      return;
    }

    const currentText = placeholderTexts[textIndex];
    
    const tick = () => {
      if (isDeleting) {
        // Deleting
        setDisplayText(currentText.substring(0, charIndex - 1));
        setCharIndex(prev => prev - 1);
        
        if (charIndex <= 1) {
          setIsDeleting(false);
          setTextIndex((prev) => (prev + 1) % placeholderTexts.length);
        }
      } else {
        // Typing
        setDisplayText(currentText.substring(0, charIndex + 1));
        setCharIndex(prev => prev + 1);
        
        if (charIndex >= currentText.length) {
          // Pause before deleting
          timeoutRef.current = setTimeout(() => {
            setIsDeleting(true);
          }, 2000);
          return;
        }
      }
    };

    const speed = isDeleting ? 30 : 80;
    timeoutRef.current = setTimeout(tick, speed);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [charIndex, isDeleting, textIndex, isFocused, value, placeholderTexts]);

  const handleSubmit = useCallback(() => {
    const trimmedValue = value.trim();
    if (trimmedValue && !isLoading) {
      onSubmit(trimmedValue);
      // Don't clear value - let parent handle navigation while keeping text visible
    }
  }, [value, isLoading, onSubmit]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  return (
    <div className="w-full max-w-[52rem]">
      <div className={cn(
        "relative rounded-[28px] transition-all duration-200",
        "bg-white dark:bg-[#1A1028]",
        "border border-black/10 dark:border-white/10",
        "shadow-md",
        isFocused && "border-black/20 dark:border-white/20 shadow-lg"
      )}>
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={displayText || defaultPlaceholder}
          disabled={isLoading}
          rows={1}
          className={cn(
            "w-full resize-none bg-transparent px-6 pt-5 pb-[4rem] text-[17px]",
            "text-[#1A1A1A] dark:text-white placeholder:text-[#999] dark:placeholder:text-[#666]",
            "focus:outline-none",
            "min-h-[112px]"
          )}
        />

        <div className="absolute bottom-3.5 left-4 right-4 flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-10 rounded-xl text-[#888] hover:bg-black/5 hover:text-[#1A1A1A] dark:hover:bg-white/5 dark:hover:text-white"
            disabled={isLoading}
          >
            <Paperclip className="size-[19px]" />
          </Button>

          <Button
            type="button"
            size="icon"
            onClick={handleSubmit}
            disabled={!value.trim() || isLoading}
            className={cn(
              "size-10 rounded-full transition-all",
              value.trim()
                ? "bg-[#1A1A1A] dark:bg-white text-white dark:text-black hover:opacity-90"
                : "bg-[#E5E5E5] dark:bg-[#333] text-[#999] dark:text-[#666] cursor-not-allowed"
            )}
          >
            {isLoading ? (
              <Loader2 className="size-[19px] animate-spin" />
            ) : (
              <ArrowUp className="size-[19px]" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default HomeInput;
