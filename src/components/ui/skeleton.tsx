import { cn } from "@/lib/utils"

export interface SkeletonProps extends React.ComponentProps<"div"> {
  /**
   * Visual variant of the skeleton
   * - 'default': Standard rounded skeleton
   * - 'image': Rounded corners matching image cards, with subtle icon pattern
   * - 'text': Smaller rounded corners for text placeholders
   */
  variant?: 'default' | 'image' | 'text';
  /**
   * Whether to animate the skeleton
   * When true, uses breathe animation (respects prefers-reduced-motion via CSS)
   * @default true
   */
  animate?: boolean;
}

function Skeleton({ 
  className, 
  variant = 'default',
  animate = true,
  ...props 
}: SkeletonProps) {
  return (
    <div
      data-slot="skeleton"
      data-variant={variant}
      data-animate={animate}
      className={cn(
        "bg-accent",
        // Variant-specific styles
        variant === 'default' && "rounded-md",
        variant === 'image' && "rounded-xl",
        variant === 'text' && "rounded-sm",
        // Animation: use breathe animation when animate is true
        // CSS handles reduced-motion preference via media query
        animate && "animate-breathe",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
