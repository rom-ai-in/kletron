import { cn } from './utils';

/**
 * Cursor-style soft gradient wave inside text (`animate-text-shimmer` in tailwind-preset).
 * `inline-block` + `-webkit-text-fill-color` are required for reliable gradient text (esp. Safari).
 */
export const agentActivityStatusWaveClasses = cn(
    'inline-block max-w-full align-baseline font-medium',
    'motion-safe:bg-gradient-to-r motion-safe:from-text-muted/55 motion-safe:from-[15%] motion-safe:via-text-primary motion-safe:via-50% motion-safe:to-text-muted/55 motion-safe:to-[85%]',
    'motion-safe:bg-[length:200%_100%] motion-safe:bg-clip-text motion-safe:text-transparent motion-safe:[-webkit-text-fill-color:transparent] motion-safe:animate-text-shimmer',
    'motion-reduce:text-text-muted/90 motion-reduce:[-webkit-text-fill-color:currentColor]',
);
