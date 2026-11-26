import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/cn';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: ReactNode;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'px-5 py-10' : 'px-6 py-16',
        className,
      )}
    >
      <div className="relative mb-5">
        <span
          aria-hidden="true"
          className={cn(
            'absolute inset-0 -m-2 rounded-full border border-dashed border-line',
            compact ? 'hidden' : '',
          )}
        />
        <div
          className={cn(
            'relative flex items-center justify-center rounded-full border border-line bg-surface text-accent',
            compact ? 'h-10 w-10' : 'h-14 w-14',
          )}
        >
          <Icon className={compact ? 'h-4 w-4' : 'h-5 w-5'} strokeWidth={1.5} />
          <span
            aria-hidden="true"
            className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-accent"
          />
        </div>
      </div>
      <h3
        className={cn(
          'font-display font-normal tracking-[-0.015em] text-ink',
          compact ? 'text-[18px]' : 'text-[24px]',
        )}
      >
        {title}
      </h3>
      <p
        className={cn(
          'mt-1.5 max-w-[380px] leading-relaxed text-ink-muted',
          compact ? 'text-[12.5px]' : 'text-[13.5px]',
        )}
      >
        {description}
      </p>
      {action ? <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}
