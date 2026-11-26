import type { ReactNode } from 'react';
import { Clock, Flag } from 'lucide-react';
import { CATEGORY_COLORS, IMPORTANCE_LABELS } from '../../constants';
import { cn } from '../../lib/cn';
import { formatDuration, formatFriendlyDateShort } from '../../lib/date';
import type { Category, Task } from '../../types';

export type ChipTone = 'neutral' | 'accent' | 'sage' | 'gold' | 'danger' | 'outline';

const CHIP_TONES: Record<ChipTone, string> = {
  neutral: 'bg-raised text-ink-soft',
  accent: 'bg-accent-soft text-accent',
  sage: 'bg-sage-soft text-sage',
  gold: 'bg-gold-soft text-gold',
  danger: 'bg-danger-soft text-danger',
  outline: 'border border-line bg-transparent text-ink-soft',
};

interface ChipProps {
  children: ReactNode;
  tone?: ChipTone;
  className?: string;
  title?: string;
}

export function Chip({ children, tone = 'neutral', className, title }: ChipProps) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-medium leading-4',
        CHIP_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function CategoryDot({ category, className }: { category: Category; className?: string }) {
  const colors = CATEGORY_COLORS[category.color] ?? CATEGORY_COLORS.slate;
  return (
    <span
      aria-hidden="true"
      className={cn('inline-block h-1.5 w-1.5 shrink-0 rounded-full', colors.dot, className)}
    />
  );
}

export function CategoryBadge({
  category,
  withDot = true,
  className,
}: {
  category: Category;
  withDot?: boolean;
  className?: string;
}) {
  const colors = CATEGORY_COLORS[category.color] ?? CATEGORY_COLORS.slate;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-medium leading-4',
        colors.chip,
        className,
      )}
    >
      {withDot ? <span className={cn('h-1.5 w-1.5 rounded-full', colors.dot)} /> : null}
      {category.name}
    </span>
  );
}

export function DueBadge({
  task,
  today,
  className,
}: {
  task: Task;
  today: string;
  className?: string;
}) {
  if (!task.dueDate) return null;
  const overdue = !task.completed && task.dueDate < today;
  return (
    <Chip tone={overdue ? 'danger' : 'neutral'} className={className}>
      <Clock className="h-2.5 w-2.5" strokeWidth={2} />
      {overdue ? 'Overdue · ' : ''}
      {formatFriendlyDateShort(task.dueDate, today)}
    </Chip>
  );
}

export function ImportanceBadge({ task }: { task: Task }) {
  if (task.importance === 'none') return null;
  const tone: ChipTone =
    task.importance === 'high' ? 'accent' : task.importance === 'medium' ? 'gold' : 'neutral';
  return (
    <Chip tone={tone} title={`${IMPORTANCE_LABELS[task.importance]} importance`}>
      <Flag className="h-2.5 w-2.5" strokeWidth={2.2} />
      {IMPORTANCE_LABELS[task.importance]}
    </Chip>
  );
}

export function EstimateBadge({ minutes }: { minutes: number }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-medium text-ink-muted"
      title={`Estimated ${formatDuration(minutes)}`}
    >
      <Clock className="h-3 w-3" strokeWidth={1.8} />
      {formatDuration(minutes)}
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-[5px] border border-line bg-raised px-1.5 font-sans text-[10px] font-medium text-ink-muted">
      {children}
    </kbd>
  );
}
