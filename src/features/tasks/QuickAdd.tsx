import { useRef, useState, type FormEvent } from 'react';
import { ChevronDown, Plus, Star } from 'lucide-react';
import { CATEGORY_COLORS } from '../../constants';
import { cn } from '../../lib/cn';
import { createTask, focusTasksForDate } from '../../domain/tasks';
import { getCategory } from '../../domain/queries';
import { useAppData, useAppStore } from '../../store/AppStoreProvider';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/toast';

interface QuickAddProps {
  dueDate: string;
  className?: string;
  placeholder?: string;
}

export function QuickAdd({ dueDate, className, placeholder }: QuickAddProps) {
  const data = useAppData();
  const store = useAppStore();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState(
    data.categories.find((category) => category.id === 'cat-personal')?.id ??
      data.categories[0]?.id ??
      '',
  );
  const [asPriority, setAsPriority] = useState(false);

  const priorityCount = focusTasksForDate(data, dueDate).length;
  const priorityFull = priorityCount >= 3;
  const category = getCategory(data, categoryId);
  const colors = CATEGORY_COLORS[category.color] ?? CATEGORY_COLORS.slate;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) return;
    try {
      store.update((state) =>
        createTask(state, {
          title: cleanTitle,
          dueDate,
          categoryId,
          focusDate: asPriority ? dueDate : null,
        }),
      );
      setTitle('');
      setAsPriority(false);
      inputRef.current?.focus();
    } catch (error) {
      toast({
        title: 'Could not add the task',
        description: error instanceof Error ? error.message : undefined,
        tone: 'error',
      });
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        'rounded-xl border border-line bg-surface px-2 pt-1 shadow-[0_1px_1px_rgb(28_27_24/0.02)] transition-colors focus-within:border-accent/35 focus-within:ring-2 focus-within:ring-accent/10',
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="ml-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-dashed border-line-strong text-ink-muted"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={1.8} />
        </span>
        <input
          ref={inputRef}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={placeholder ?? 'Add a task for today…'}
          aria-label="Quick add task"
          maxLength={180}
          className="h-11 min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-muted/80 focus-visible:shadow-none"
          autoComplete="off"
        />
        <Button
          type="submit"
          size="sm"
          disabled={!title.trim()}
          className="my-1 shrink-0"
        >
          Add
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 py-1.5 pl-[3rem] pr-1">
        <label className="relative inline-flex items-center gap-1.5 rounded-full border border-line bg-canvas/60 py-1 pl-2 pr-5 text-[10.5px] font-medium text-ink-soft transition-colors hover:border-line-strong">
          <span className={cn('h-1.5 w-1.5 rounded-full', colors.dot)} />
          <span className="sr-only">Category</span>
          <select
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            aria-label="Task category"
            className="cursor-pointer appearance-none bg-transparent pr-0 text-[10.5px] font-medium text-ink-soft outline-none"
          >
            {data.categories.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-1.5 h-3 w-3 text-ink-muted"
            strokeWidth={1.8}
          />
        </label>
        <button
          type="button"
          aria-pressed={asPriority}
          aria-label="Add as one of today's priorities"
          disabled={priorityFull && !asPriority}
          onClick={() => setAsPriority((current) => !current)}
          title={
            priorityFull
              ? 'All three priorities are already set'
              : 'Add as one of today’s priorities'
          }
          className={cn(
            'inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10.5px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
            asPriority
              ? 'border-accent/25 bg-accent-soft text-accent'
              : 'border-transparent text-ink-muted hover:border-line hover:bg-canvas/60 hover:text-ink-soft',
          )}
        >
          <Star
            className={cn('h-3 w-3', asPriority && 'fill-accent')}
            strokeWidth={1.8}
          />
          Priority
        </button>
        <span className="ml-auto text-[10px] text-ink-muted/75">
          <span className="hidden sm:inline">Press </span>
          <kbd className="rounded border border-line/80 px-1 font-sans text-[9px]">Enter</kbd>
          <span className="hidden sm:inline"> to add</span>
        </span>
      </div>
    </form>
  );
}
