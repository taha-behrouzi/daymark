import { cn } from '../../lib/cn';

interface LogoMarkProps {
  className?: string;
}

export function LogoMark({ className }: LogoMarkProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={cn('h-7 w-7', className)}
    >
      <path
        d="M7 19.25a9 9 0 0 1 18 0"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        className="text-accent"
      />
      <path
        d="M5.5 24.25h21"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="16" cy="10.2" r="1.4" fill="currentColor" />
    </svg>
  );
}

interface LogoProps {
  className?: string;
  markClassName?: string;
  showTagline?: boolean;
}

export function Logo({ className, markClassName, showTagline = false }: LogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark className={markClassName} />
      <span className="flex flex-col leading-none">
        <span className="font-display text-[22px] font-medium tracking-[-0.03em] text-ink">
          daymark
        </span>
        {showTagline ? (
          <span className="mt-1 text-[10px] font-medium uppercase tracking-[0.16em] text-ink-muted">
            Make your day clearer
          </span>
        ) : null}
      </span>
    </span>
  );
}
