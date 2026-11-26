import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { CalendarDays, Star, Trash2 } from 'lucide-react';
import { IMPORTANCE_LABELS, PREFERRED_PERIOD_LABELS } from '../../constants';
import {
  createTask,
  deleteTask,
  focusTasksForDate,
  removeTaskFocus,
  setTaskFocus,
  updateTask,
} from '../../domain/tasks';
import { useAppData, useAppStore } from '../../store/AppStoreProvider';
import {
  addDays,
  dateKeyFromTimestamp,
  formatDate,
  formatFriendlyDate,
  todayKey,
} from '../../lib/date';
import { cn } from '../../lib/cn';
import type { PreferredPeriod, TaskImportance } from '../../types';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { Field, Input, Select, Textarea } from '../../components/ui/Field';
import { useToast } from '../../components/ui/toast';
import { useConfirm } from '../../components/ui/confirm';

export interface TaskEditorPreset {
  title?: string;
  dueDate?: string | null;
  focusDate?: string | null;
  categoryId?: string;
}

interface TaskEditorDialogProps {
  taskId?: string;
  preset?: TaskEditorPreset;
  onClose: () => void;
}

interface FormErrors {
  title?: string;
  estimate?: string;
}

export function TaskEditorDialog({ taskId, preset, onClose }: TaskEditorDialogProps) {
  const data = useAppData();
  const store = useAppStore();
  const toast = useToast();
  const confirm = useConfirm();
  const today = todayKey();
  const existing = taskId ? data.tasks.find((task) => task.id === taskId) : undefined;
  const titleRef = useRef<HTMLInputElement>(null);

  const defaultCategoryId =
    preset?.categoryId && data.categories.some((category) => category.id === preset.categoryId)
      ? preset.categoryId
      : (data.categories.find((category) => category.id === 'cat-personal')?.id ??
        data.categories[0]?.id ??
        '');
  const initialDueDate =
    preset && 'dueDate' in preset ? (preset.dueDate ?? '') : today;

  const [title, setTitle] = useState(existing?.title ?? preset?.title ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [dueDate, setDueDate] = useState(existing?.dueDate ?? initialDueDate);
  const [importance, setImportance] = useState<TaskImportance>(
    existing?.importance ?? 'none',
  );
  const [categoryId, setCategoryId] = useState(existing?.categoryId ?? defaultCategoryId);
  const [estimate, setEstimate] = useState(
    String(existing?.estimateMinutes ?? data.settings.defaultEstimateMinutes),
  );
  const [preferredPeriod, setPreferredPeriod] = useState<PreferredPeriod>(
    existing?.preferredPeriod ?? 'any',
  );
  const [focusDate, setFocusDate] = useState<string | null>(
    existing?.focusDate ?? preset?.focusDate ?? null,
  );
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (taskId && !existing) onClose();
  }, [existing, onClose, taskId]);

  const focusCountForToday = focusTasksForDate(data, focusDate ?? today).filter(
    (task) => task.id !== existing?.id,
  ).length;
  const priorityFull = focusDate === null && focusCountForToday >= 3;
  const priorityDisabled = (Boolean(existing?.completed) && focusDate === null) || priorityFull;

  const focusDateLabel =
    focusDate === today ? 'today' : focusDate ? formatFriendlyDate(focusDate, today) : '';

  const handleDueDate = (value: string) => {
    setDueDate(value);
  };

  const handleTogglePriority = (checked: boolean) => {
    setFocusDate(checked ? today : null);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const nextErrors: FormErrors = {};
    if (!title.trim()) nextErrors.title = 'Give this task a title.';
    const estimateNumber = Number(estimate);
    if (!Number.isInteger(estimateNumber) || estimateNumber < 5 || estimateNumber > 480) {
      nextErrors.estimate = 'Use a whole number between 5 and 480.';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    try {
      store.update((state) => {
        if (existing) {
          let next = updateTask(state, existing.id, {
            title,
            description,
            dueDate: dueDate || null,
            importance,
            categoryId,
            estimateMinutes: estimateNumber,
            preferredPeriod,
          });
          if (focusDate !== existing.focusDate) {
            next = focusDate ? setTaskFocus(next, existing.id, focusDate) : removeTaskFocus(next, existing.id);
          }
          return next;
        }
        return createTask(state, {
          title,
          description,
          dueDate: dueDate || null,
          importance,
          categoryId,
          estimateMinutes: estimateNumber,
          preferredPeriod,
          focusDate,
        });
      });
      toast({
        title: existing ? 'Task updated' : 'Task added',
        tone: 'success',
      });
      onClose();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'The task could not be saved.');
    }
  };

  const handleDelete = async () => {
    if (!existing) return;
    const shouldDelete = await confirm({
      title: 'Delete this task?',
      description: (
        <>
          “{existing.title}” will be removed, along with any time blocks scheduled for
          it. This cannot be undone.
        </>
      ),
      confirmLabel: 'Delete task',
      tone: 'danger',
    });
    if (!shouldDelete) return;
    try {
      store.update((state) => deleteTask(state, existing.id));
      toast({ title: 'Task deleted', tone: 'success' });
      onClose();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'The task could not be deleted.');
    }
  };

  return (
    <Dialog
      onClose={onClose}
      eyebrow={existing ? 'Task details' : 'New task'}
      title={existing ? existing.title : 'Add a task'}
      description={
        existing
          ? 'Adjust the details without losing sight of the day.'
          : 'A short, clear next step. You can fill in the rest whenever you like.'
      }
      drawer
      initialFocusRef={titleRef}
      footer={
        <>
          {existing ? (
            <Button
              variant="ghost"
              size="sm"
              className="mr-auto text-danger hover:bg-danger-soft hover:text-danger"
              onClick={() => void handleDelete()}
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} />
              Delete
            </Button>
          ) : null}
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="task-editor-form" size="sm">
            {existing ? 'Save changes' : 'Add task'}
          </Button>
        </>
      }
    >
      <form id="task-editor-form" onSubmit={handleSubmit} className="space-y-5 pb-1">
        {existing?.completed ? (
          <div className="rounded-xl border border-sage/20 bg-sage-soft px-3.5 py-2.5 text-[12px] text-sage">
            This task is completed. Reopen it from the task list to make it a priority again.
          </div>
        ) : null}
        {formError ? (
          <div
            role="alert"
            className="rounded-xl border border-danger/20 bg-danger-soft px-3.5 py-2.5 text-[12px] leading-relaxed text-danger"
          >
            {formError}
          </div>
        ) : null}

        <Field label="Task" htmlFor="task-title" error={errors.title}>
          <Input
            ref={titleRef}
            id="task-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="What needs to happen?"
            maxLength={180}
            invalid={Boolean(errors.title)}
            autoComplete="off"
            className="h-11 text-[15px] font-medium"
          />
        </Field>

        <Field label="Notes" htmlFor="task-description" optionalLabel>
          <Textarea
            id="task-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="A little context, a link, a first step…"
            maxLength={4000}
            rows={3}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Category" htmlFor="task-category">
            <Select
              id="task-category"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
            >
              {data.categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Importance" htmlFor="task-importance">
            <Select
              id="task-importance"
              value={importance}
              onChange={(event) => setImportance(event.target.value as TaskImportance)}
            >
              {(Object.keys(IMPORTANCE_LABELS) as TaskImportance[]).map((value) => (
                <option key={value} value={value}>
                  {IMPORTANCE_LABELS[value]}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Due date" htmlFor="task-due" optionalLabel>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              id="task-due"
              type="date"
              value={dueDate}
              onChange={(event) => handleDueDate(event.target.value)}
              className="flex-1"
            />
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleDueDate(today)}
                className={cn(
                  'pressable rounded-full px-2.5 py-1 text-[11.5px] font-medium',
                  dueDate === today
                    ? 'bg-accent-soft text-accent'
                    : 'text-ink-muted hover:bg-raised hover:text-ink',
                )}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => handleDueDate(addDays(today, 1))}
                className={cn(
                  'pressable rounded-full px-2.5 py-1 text-[11.5px] font-medium',
                  dueDate === addDays(today, 1)
                    ? 'bg-accent-soft text-accent'
                    : 'text-ink-muted hover:bg-raised hover:text-ink',
                )}
              >
                Tomorrow
              </button>
              {dueDate ? (
                <button
                  type="button"
                  onClick={() => handleDueDate('')}
                  className="pressable rounded-full px-2.5 py-1 text-[11.5px] font-medium text-ink-muted hover:bg-raised hover:text-ink"
                >
                  Clear
                </button>
              ) : null}
            </div>
          </div>
        </Field>

        <div
          className={cn(
            'rounded-xl border p-3.5 transition-colors',
            focusDate
              ? 'border-accent/25 bg-accent-soft/50'
              : 'border-line bg-canvas/40',
            priorityDisabled && !focusDate && 'opacity-70',
          )}
        >
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={focusDate !== null}
              disabled={priorityDisabled}
              onChange={(event) => handleTogglePriority(event.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-accent disabled:cursor-not-allowed"
            />
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
                <Star className={cn('h-3.5 w-3.5', focusDate ? 'fill-accent text-accent' : 'text-ink-muted')} strokeWidth={1.8} />
                One of {focusDateLabel ? `the priorities for ${focusDateLabel}` : "today's priorities"}
              </span>
              <span className="mt-1 block text-[11.5px] leading-relaxed text-ink-muted">
                {existing?.completed
                  ? focusDate
                    ? 'You can remove this priority, but reopen the task to add it again.'
                    : 'Completed tasks cannot be added as priorities.'
                  : priorityFull
                    ? 'All three priority slots for today are filled. Remove one first.'
                    : 'Priorities lead the auto-planner and stay visible on Today.'}
              </span>
            </span>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Estimate"
            htmlFor="task-estimate"
            hint="Used to plan your day."
            error={errors.estimate}
          >
            <div className="relative">
              <Input
                id="task-estimate"
                type="number"
                min={5}
                max={480}
                step={5}
                value={estimate}
                onChange={(event) => setEstimate(event.target.value)}
                invalid={Boolean(errors.estimate)}
                className="pr-12"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-ink-muted">
                min
              </span>
            </div>
          </Field>
          <Field label="Best time" htmlFor="task-period">
            <Select
              id="task-period"
              value={preferredPeriod}
              onChange={(event) => setPreferredPeriod(event.target.value as PreferredPeriod)}
            >
              {(Object.keys(PREFERRED_PERIOD_LABELS) as PreferredPeriod[]).map((value) => (
                <option key={value} value={value}>
                  {PREFERRED_PERIOD_LABELS[value]}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {existing ? (
          (() => {
            const createdKey = dateKeyFromTimestamp(existing.createdAt);
            return (
              <div className="flex items-center gap-2 border-t border-line pt-4 text-[11px] text-ink-muted">
                <CalendarDays className="h-3 w-3" strokeWidth={1.8} />
                Created{' '}
                {createdKey
                  ? formatDate(createdKey, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : 'recently'}
              </div>
            );
          })()
        ) : null}
      </form>
    </Dialog>
  );
}
