import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface PageHeaderProps {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        'flex flex-col gap-5 pb-8 sm:pb-10 md:flex-row md:items-end md:justify-between md:gap-8',
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <div className="mb-3 flex items-center gap-2.5">
            <span aria-hidden="true" className="h-px w-6 bg-accent/70" />
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.17em] text-ink-muted">
              {eyebrow}
            </span>
          </div>
        ) : null}
        <h1 className="font-display text-[34px] font-normal leading-[1.04] tracking-[-0.03em] text-ink sm:text-[42px]">
          {title}
        </h1>
        {description ? (
          <p className="mt-2.5 max-w-[620px] text-[13.5px] leading-relaxed text-ink-soft">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 md:pb-0.5">{actions}</div>
      ) : null}
    </header>
  );
}

interface SectionHeadingProps {
  title: ReactNode;
  count?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function SectionHeading({
  title,
  count,
  description,
  action,
  className,
}: SectionHeadingProps) {
  return (
    <div className={cn('flex items-end justify-between gap-4', className)}>
      <div className="min-w-0">
        <div className="flex items-baseline gap-2.5">
          <h2 className="font-display text-[21px] font-normal leading-tight tracking-[-0.015em] text-ink">
            {title}
          </h2>
          {count !== undefined ? (
            <span className="font-tabular text-[11.5px] font-medium text-ink-muted">{count}</span>
          ) : null}
        </div>
        {description ? (
          <p className="mt-1 text-[12px] leading-relaxed text-ink-muted">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0 pb-0.5">{action}</div> : null}
    </div>
  );
}
