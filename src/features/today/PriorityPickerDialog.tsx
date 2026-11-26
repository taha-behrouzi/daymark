import { useMemo, useRef, useState } from 'react';
import { Plus, Search, Star } from 'lucide-react';
import { todayKey } from '../../lib/date';
import { sortTasks } from '../../domain/queries';
import { setTaskFocus } from '../../domain/tasks';
import { useAppData, useAppStore } from '../../store/AppStoreProvider';
import { useAppDialogs } from '../../store/AppDialogsProvider';
import { Dialog } from '../../components/ui/Dialog';
import { Input } from '../../components/ui/Field';
import { CategoryBadge, DueBadge } from '../../components/ui/Meta';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { useToast } from '../../components/ui/toast';
import { getCategory } from '../../domain/queries';

export function PriorityPickerDialog({ onClose }: { onClose: () => void }) {
  const data = useAppData();
  const store = useAppStore();
  const toast = useToast();
  const { openTaskEditor } = useAppDialogs();
  const today = todayKey();
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');

  const candidates = useMemo(() => {
    const openNotFocused = data.tasks.filter(
      (task) => !task.completed && task.focusDate !== today,
    );
    const normalized = query.trim().toLocaleLowerCase();
    const filtered = normalized
      ? openNotFocused.filter(
          (task) =>
            task.title.toLocaleLowerCase().includes(normalized) ||
            task.description.toLocaleLowerCase().includes(normalized),
        )
      : openNotFocused;
    return sortTasks(filtered, 'smart');
  }, [data.tasks, query, today]);

  const choose = (taskId: string) => {
    try {
      store.update((state) => setTaskFocus(state, taskId, today));
      toast({ title: 'Priority set', tone: 'success' });
      onClose();
    } catch (error) {
      toast({
        title: 'Could not set the priority',
        description: error instanceof Error ? error.message : undefined,
        tone: 'error',
      });
    }
  };

  return (
    <Dialog
      onClose={onClose}
      eyebrow="Today’s priorities"
      title="Choose a priority"
      description="Pick something already on your list, or make a new task one of today’s three."
      size="md"
      initialFocusRef={searchRef}
      footer={
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            onClose();
            openTaskEditor({ preset: { dueDate: today, focusDate: today } });
          }}
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2} />
          Create a new priority
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted"
            strokeWidth={1.8}
          />
          <Input
            ref={searchRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search open tasks…"
            aria-label="Search tasks"
            className="pl-9"
          />
        </div>

        {candidates.length > 0 ? (
          <ul className="space-y-0.5">
            {candidates.map((task) => {
              const category = getCategory(data, task.categoryId);
              return (
                <li key={task.id}>
                  <button
                    type="button"
                    onClick={() => choose(task.id)}
                    className="group flex w-full items-start gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors hover:bg-raised/70"
                  >
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line text-ink-muted transition-colors group-hover:border-accent/40 group-hover:bg-accent-soft group-hover:text-accent">
                      <Star className="h-3.5 w-3.5" strokeWidth={1.8} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium text-ink">
                        {task.title}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-1.5">
                        <CategoryBadge category={category} />
                        <DueBadge task={task} today={today} />
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            icon={Star}
            title={query ? 'No matching tasks' : 'Nothing waiting to be chosen'}
            description={
              query
                ? 'Try another search, or create a new priority.'
                : 'Every open task is already a priority, or your task list is quiet. Create a new priority to begin.'
            }
            action={
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  onClose();
                  openTaskEditor({ preset: { dueDate: today, focusDate: today } });
                }}
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                New priority
              </Button>
            }
            compact
          />
        )}
      </div>
    </Dialog>
  );
}
