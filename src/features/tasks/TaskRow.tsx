import { Flag, Pencil, Star } from 'lucide-react';
import { IMPORTANCE_LABELS } from '../../constants';
import { cn } from '../../lib/cn';
import { todayKey } from '../../lib/date';
import type { Task } from '../../types';
import { getCategory } from '../../domain/queries';
import { useAppData } from '../../store/AppStoreProvider';
import { useAppDialogs } from '../../store/AppDialogsProvider';
import { CheckButton } from '../../components/ui/CheckButton';
import { CategoryBadge, DueBadge } from '../../components/ui/Meta';
import { IconButton } from '../../components/ui/Button';
import { useTaskCompletion } from './useTaskCompletion';

interface TaskRowProps {
  task: Task;
  showDescription?: boolean;
  showCategory?: boolean;
  className?: string;
  compact?: boolean;
}

const IMPORTANCE_CLASSES = {
  high: 'text-accent',
  medium: 'text-gold',
  low: 'text-ink-muted',
  none: 'text-ink-muted',
};

export function TaskRow({
  task,
  showDescription = true,
  showCategory = true,
  className,
  compact = false,
}: TaskRowProps) {
  const data = useAppData();
  const { openTaskEditor } = useAppDialogs();
  const setCompleted = useTaskCompletion();
  const today = todayKey();
  const category = getCategory(data, task.categoryId);
  const isPriority = task.focusDate === today;

  return (
    <div
      className={cn(
        'group flex items-start gap-3 rounded-xl px-2 transition-colors hover:bg-raised/55',
        compact ? 'py-2' : 'py-2.5',
        task.completed && 'opacity-70',
        className,
      )}
    >
      <div className={cn('flex shrink-0 items-center', compact ? 'h-6' : 'h-7')}>
        <CheckButton
          checked={task.completed}
          label={
            task.completed
              ? `Mark ${task.title} incomplete`
              : `Mark ${task.title} complete`
          }
          onCheckedChange={(checked) => setCompleted(task, checked)}
        />
      </div>
      <button
        type="button"
        onClick={() => openTaskEditor({ taskId: task.id })}
        className="min-w-0 flex-1 rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25"
      >
        <span className="flex items-start gap-1.5">
          <span
            className={cn(
              'min-w-0 flex-1 text-[14px] font-medium leading-[1.45] text-ink transition-colors',
              task.completed && 'text-ink-muted line-through decoration-line-strong',
            )}
          >
            {task.title}
          </span>
          {isPriority ? (
            <Star
              aria-label="Today's priority"
              className="mt-[3px] h-3 w-3 shrink-0 fill-accent text-accent"
              strokeWidth={1.6}
            />
          ) : null}
          {task.importance !== 'none' ? (
            <Flag
              aria-label={`${IMPORTANCE_LABELS[task.importance]} importance`}
              className={cn(
                'mt-[4px] h-2.5 w-2.5 shrink-0',
                IMPORTANCE_CLASSES[task.importance],
              )}
              strokeWidth={2.2}
            />
          ) : null}
        </span>
        {showDescription && task.description ? (
          <span className="mt-0.5 block truncate text-[11.5px] leading-relaxed text-ink-muted">
            {task.description}
          </span>
        ) : null}
        <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {showCategory ? <CategoryBadge category={category} /> : null}
          <DueBadge task={task} today={today} />
        </span>
      </button>
      <IconButton
        label={`Edit ${task.title}`}
        size="sm"
        className="mt-0.5 h-7 w-7 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
        onClick={() => openTaskEditor({ taskId: task.id })}
      >
        <Pencil className="h-3 w-3" strokeWidth={1.8} />
      </IconButton>
    </div>
  );
}
