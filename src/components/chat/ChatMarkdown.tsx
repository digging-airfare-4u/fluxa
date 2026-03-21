'use client';

import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';

const components: Components = {
  // Headers: same font-size as body, just bolder — no visual disruption in chat
  h1: ({ children }) => <p className="font-bold mt-3 first:mt-0 mb-1">{children}</p>,
  h2: ({ children }) => <p className="font-bold mt-3 first:mt-0 mb-1">{children}</p>,
  h3: ({ children }) => <p className="font-semibold mt-2.5 first:mt-0 mb-1">{children}</p>,
  h4: ({ children }) => <p className="font-semibold mt-2 first:mt-0 mb-0.5">{children}</p>,
  h5: ({ children }) => <p className="font-semibold mt-2 first:mt-0 mb-0.5">{children}</p>,
  h6: ({ children }) => <p className="font-medium mt-2 first:mt-0 mb-0.5">{children}</p>,

  p: ({ children }) => <p className="mt-1.5 first:mt-0 mb-0 leading-relaxed">{children}</p>,

  // Lists: compact, subtle indent
  ul: ({ children }) => <ul className="mt-1 mb-1 ml-4 space-y-0.5 list-disc marker:text-foreground/30">{children}</ul>,
  ol: ({ children }) => <ol className="mt-1 mb-1 ml-4 space-y-0.5 list-decimal marker:text-foreground/40">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed pl-0.5">{children}</li>,

  // Inline code: subtle pill
  code: ({ children, className }) => {
    // Fenced code block (has language class)
    if (className) {
      return (
        <code className="block mt-1.5 mb-1.5 rounded-lg bg-black/[0.04] dark:bg-white/[0.06] px-3 py-2 text-[13px] leading-relaxed font-mono whitespace-pre-wrap break-words overflow-x-auto">
          {children}
        </code>
      );
    }
    // Inline code
    return (
      <code className="rounded-[4px] bg-black/[0.05] dark:bg-white/[0.08] px-1 py-0.5 text-[13px] font-mono">
        {children}
      </code>
    );
  },

  // Code blocks
  pre: ({ children }) => <div className="mt-1.5 mb-1.5">{children}</div>,

  // Strong / em
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em>{children}</em>,

  // Links: accent color, no underline unless hover
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-primary/80 hover:text-primary hover:underline underline-offset-2 transition-colors"
    >
      {children}
    </a>
  ),

  // Blockquote: left border accent
  blockquote: ({ children }) => (
    <blockquote className="mt-1.5 mb-1.5 border-l-2 border-foreground/15 pl-3 text-foreground/70">
      {children}
    </blockquote>
  ),

  // HR: subtle divider
  hr: () => <hr className="my-2.5 border-foreground/10" />,

  // Images: strip (handled by ImageCard separately)
  img: () => null,
};

interface ChatMarkdownProps {
  content: string;
}

export function ChatMarkdown({ content }: ChatMarkdownProps) {
  return (
    <div className="chat-markdown">
      <ReactMarkdown components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
