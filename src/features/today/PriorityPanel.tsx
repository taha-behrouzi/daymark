import { useState } from 'react';
import { ChevronDown, ChevronUp, Plus, X } from 'lucide-react';
import { cn } from '../../lib/cn';
import { todayKey } from '../../lib/date';
import { getCategory } from '../../domain/queries';
import {
  focusTasksForDate,
  moveFocusTask,
  removeTaskFocus,
  setTaskFocus,
} from '../../domain/tasks';
import { useAppData, useAppStore } from '../../store/AppStoreProvider';
import { useAppDialogs } from '../../store/AppDialogsProvider';
import { SectionHeading } from '../../components/ui/PageHeader';
import { CheckButton } from '../../components/ui/CheckButton';
import { CategoryBadge, DueBadge } from '../../components/ui/Meta';
import { IconButton } from '../../components/ui/Button';
import { useTaskCompletion } from '../tasks/useTaskCompletion';
import { useToast } from '../../components/ui/toast';
import { PriorityPickerDialog } from './PriorityPickerDialog';

const EMPTY_SLOT_LABELS = [
  'Set your first priority',
  'Add a second priority',
  'A third, if it helps',
];

export function PriorityPanel() {
  const data = useAppData();
  const store = useAppStore();
  const toast = useToast();
  const { openTaskEditor } = useAppDialogs();
  const setCompleted = useTaskCompletion();
  const [pickerOpen, setPickerOpen] = useState(false);
  const today = todayKey();
  const focus = focusTasksForDate(data, today);
  const completedCount = focus.filter((task) => task.completed).length;
  const maxSlots = Math.max(3, focus.length);

  const removePriority = (taskId: string, title: string) => {
    try {
      store.update((state) => removeTaskFocus(state, taskId));
      toast({
        title: 'Priority removed',
        description: title,
        action: {
          label: 'Undo',
          onClick: () => {
            store.update((state) => setTaskFocus(state, taskId, today));
          },
        },
      });
    } catch (error) {
      toast({
        title: 'Could not remove the priority',
        description: error instanceof Error ? error.message : undefined,
        tone: 'error',
      });
    }
  };

  const move = (taskId: string, direction: -1 | 1) => {
    try {
      store.update((state) => moveFocusTask(state, taskId, direction));
    } catch (error) {
      toast({
        title: 'Could not reorder priorities',
        description: error instanceof Error ? error.message : undefined,
        tone: 'error',
      });
    }
  };

  return (
    <section aria-labelledby="priorities-heading">
      <SectionHeading
        title={<span id="priorities-heading">Today’s priorities</span>}
        count={`${focus.length}/3`}
        description="The three things that matter most. Choose fewer if the day calls for it."
        action={
          focus.length < 3 ? (
            <IconButton
              label="Add a priority"
              variant="secondary"
              size="sm"
              onClick={() => setPickerOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2} />
            </IconButton>
          ) : null
        }
      />

      <div className="mt-3 flex items-center gap-1.5" aria-hidden="true">
        {[0, 1, 2].map((index) => {
          const task = focus[index];
          return (
            <span
              key={index}
              className={cn(
                'h-1 flex-1 rounded-full transition-colors duration-300',
                task
                  ? task.completed
                    ? 'bg-sage'
                    : 'bg-accent/40'
                  : 'bg-line/80',
              )}
            />
          );
        })}
        <span className="ml-1 w-[64px] text-right text-[10px] tabular-nums text-ink-muted">
          {completedCount} of {focus.length || 0} done
        </span>
      </div>

      <div className="mt-3 rounded-2xl border border-accent/15 bg-accent-soft/30 p-1.5">
        <div className="space-y-1">
          {Array.from({ length: maxSlots }).map((_, index) => {
            const task = focus[index];
            if (!task) {
              if (index >= 3) return null;
              return (
                <button
                  key={`empty-${index}`}
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  className="group flex w-full items-center gap-3 rounded-xl border border-dashed border-accent/20 px-3 py-3 text-left transition-colors hover:border-accent/35 hover:bg-surface/60"
                >
                  <span className="w-6 font-display text-[16px] leading-none text-ink-muted/55">
                    0{index + 1}
                  </span>
                  <span className="flex h-[19px] w-[19px] items-center justify-center rounded-full border border-dashed border-accent/30 text-accent/60">
                    <Plus className="h-2.5 w-2.5" strokeWidth={2} />
                  </span>
                  <span className="text-[12.5px] text-ink-muted group-hover:text-ink-soft">
                    {EMPTY_SLOT_LABELS[index]}
                  </span>
                </button>
              );
            }

            const category = getCategory(data, task.categoryId);
            return (
              <div
                key={task.id}
                className="group flex items-center gap-3 rounded-xl border border-line/70 bg-surface px-3 py-2.5 shadow-[0_1px_1px_rgb(28_27_24/0.02)]"
              >
                <span className="w-6 shrink-0 font-display text-[16px] leading-none text-ink-muted/60">
                  0{index + 1}
                </span>
                <CheckButton
                  checked={task.completed}
                  label={
                    task.completed
                      ? `Mark ${task.title} incomplete`
                      : `Mark ${task.title} complete`
                  }
                  onCheckedChange={(checked) => setCompleted(task, checked)}
                />
                <button
                  type="button"
                  onClick={() => openTaskEditor({ taskId: task.id })}
                  className="min-w-0 flex-1 rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25"
                >
                  <span
                    className={cn(
                      'block truncate text-[14px] font-medium leading-snug text-ink transition-colors',
                      task.completed && 'text-ink-muted line-through decoration-line-strong',
                    )}
                  >
                    {task.title}
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-1.5">
                    <CategoryBadge category={category} />
                    <DueBadge task={task} today={today} />
                  </span>
                </button>
                <div className="flex shrink-0 items-center gap-0.5 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100">
                  <IconButton
                    label="Move priority up"
                    size="sm"
                    className="h-6 w-6"
                    disabled={index === 0}
                    onClick={() => move(task.id, -1)}
                  >
                    <ChevronUp className="h-3 w-3" strokeWidth={2} />
                  </IconButton>
                  <IconButton
                    label="Move priority down"
                    size="sm"
                    className="h-6 w-6"
                    disabled={index === focus.length - 1}
                    onClick={() => move(task.id, 1)}
                  >
                    <ChevronDown className="h-3 w-3" strokeWidth={2} />
                  </IconButton>
                  <IconButton
                    label="Remove from priorities"
                    size="sm"
                    className="h-6 w-6"
                    onClick={() => removePriority(task.id, task.title)}
                  >
                    <X className="h-3 w-3" strokeWidth={2} />
                  </IconButton>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {pickerOpen ? <PriorityPickerDialog onClose={() => setPickerOpen(false)} /> : null}
    </section>
  );
}
