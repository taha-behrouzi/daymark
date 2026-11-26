import type { CSSProperties, ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface ProgressBarProps {
  value: number;
  label: string;
  tone?: 'accent' | 'sage' | 'ink' | 'gold';
  className?: string;
  size?: 'xs' | 'sm' | 'md';
}

const TONES = {
  accent: 'bg-accent',
  sage: 'bg-sage',
  ink: 'bg-ink',
  gold: 'bg-gold',
};

const HEIGHTS = {
  xs: 'h-[3px]',
  sm: 'h-1',
  md: 'h-1.5',
};

export function ProgressBar({
  value,
  label,
  tone = 'accent',
  className,
  size = 'sm',
}: ProgressBarProps) {
  const safeValue = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={safeValue}
      className={cn('w-full overflow-hidden rounded-full bg-line/80', HEIGHTS[size], className)}
    >
      <div
        className={cn('h-full rounded-full transition-[width] duration-500 ease-out', TONES[tone])}
        style={{ width: `${safeValue}%` } as CSSProperties}
      />
    </div>
  );
}

interface ProgressRingProps {
  value: number;
  size?: number;
  strokeWidth?: number;
  label: string;
  children?: ReactNode;
  className?: string;
  trackClassName?: string;
  progressClassName?: string;
}

export function ProgressRing({
  value,
  size = 96,
  strokeWidth = 5,
  label,
  children,
  className,
  trackClassName = 'text-line',
  progressClassName = 'text-accent',
}: ProgressRingProps) {
  const safeValue = Math.max(0, Math.min(100, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (safeValue / 100) * circumference;

  return (
    <div
      className={cn('relative inline-flex items-center justify-center', className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${label}: ${Math.round(safeValue)}%`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className={trackClassName}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn('transition-[stroke-dashoffset] duration-700 ease-out', progressClassName)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}
