'use client';

/**
 * Home Input Component - Lovart style
 */

import { useState, useCallback, KeyboardEvent } from 'react';
import { Paperclip, ArrowUp, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface HomeInputProps {
  onSubmit: (prompt: string) => void;
  isLoading?: boolean;
  placeholder?: string;
}

export function HomeInput({
  onSubmit,
  isLoading = false,
  placeholder = '描述你想要的设计...',
}: HomeInputProps) {
  const [value, setValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const handleSubmit = useCallback(() => {
    const trimmedValue = value.trim();
    if (trimmedValue && !isLoading) {
      onSubmit(trimmedValue);
      setValue('');
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
          placeholder={placeholder}
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
