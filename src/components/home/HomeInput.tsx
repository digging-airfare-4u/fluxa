'use client';

/**
 * Home Input Component - Lovart style with typewriter placeholder
 */

import { useState, useCallback, useEffect, useRef, KeyboardEvent } from 'react';
import { Paperclip, ArrowUp, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const PLACEHOLDER_TEXTS = [
  '帮我设计一张科技感的海报...',
  '创建一个简约风格的名片...',
  '设计一张生日派对邀请函...',
  '制作一个产品宣传图...',
  '帮我做一张社交媒体封面...',
];

interface HomeInputProps {
  onSubmit: (prompt: string) => void;
  isLoading?: boolean;
}

export function HomeInput({
  onSubmit,
  isLoading = false,
}: HomeInputProps) {
  const [value, setValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [displayText, setDisplayText] = useState('');
  const [textIndex, setTextIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Typewriter effect
  useEffect(() => {
    if (isFocused || value) {
      // Stop animation when focused or has value
      return;
    }

    const currentText = PLACEHOLDER_TEXTS[textIndex];
    
    const tick = () => {
      if (isDeleting) {
        // Deleting
        setDisplayText(currentText.substring(0, charIndex - 1));
        setCharIndex(prev => prev - 1);
        
        if (charIndex <= 1) {
          setIsDeleting(false);
          setTextIndex((prev) => (prev + 1) % PLACEHOLDER_TEXTS.length);
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
  }, [charIndex, isDeleting, textIndex, isFocused, value]);

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
    <div className="w-full max-w-2xl">
      <div className={cn(
        "relative rounded-2xl transition-all duration-200",
        "bg-white dark:bg-[#1A1028]",
        "border border-black/10 dark:border-white/10",
        "shadow-sm",
        isFocused && "border-black/20 dark:border-white/20 shadow-md"
      )}>
        {/* Textarea */}
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={displayText || '描述你想要的设计...'}
          disabled={isLoading}
          rows={1}
          className={cn(
            "w-full px-5 pt-4 pb-14 text-base bg-transparent resize-none",
            "text-[#1A1A1A] dark:text-white placeholder:text-[#999] dark:placeholder:text-[#666]",
            "focus:outline-none",
            "min-h-[80px]"
          )}
        />

        {/* Bottom toolbar */}
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
          {/* Left: attachment */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 rounded-lg text-[#888] hover:text-[#1A1A1A] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5"
            disabled={isLoading}
          >
            <Paperclip className="size-4" />
          </Button>

          {/* Right: submit */}
          <Button
            type="button"
            size="icon"
            onClick={handleSubmit}
            disabled={!value.trim() || isLoading}
            className={cn(
              "size-8 rounded-full transition-all",
              value.trim()
                ? "bg-[#1A1A1A] dark:bg-white text-white dark:text-black hover:opacity-90"
                : "bg-[#E5E5E5] dark:bg-[#333] text-[#999] dark:text-[#666] cursor-not-allowed"
            )}
          >
            {isLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ArrowUp className="size-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default HomeInput;
