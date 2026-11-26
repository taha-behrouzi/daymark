import { useEffect, useRef, useState, type FormEvent } from 'react';
import { CalendarDays, Clock3, Trash2 } from 'lucide-react';
import {
  addScheduleBlock,
  deleteScheduleBlock,
  updateScheduleBlock,
} from '../../domain/planner';
import { blocksForDate } from '../../domain/planner';
import {
  formatDateLong,
  formatDuration,
  minutesToTimeValue,
  timeValueToMinutes,
  todayKey,
} from '../../lib/date';
import { useAppData, useAppStore } from '../../store/AppStoreProvider';
import type { BlockType } from '../../types';
import { Dialog } from '../../components/ui/Dialog';
import { Button } from '../../components/ui/Button';
import { Field, Input, Select, Textarea } from '../../components/ui/Field';
import { useToast } from '../../components/ui/toast';
import { useConfirm } from '../../components/ui/confirm';

interface BlockEditorDialogProps {
  blockId?: string;
  date: string;
  initialType?: BlockType;
  onClose: () => void;
}

const TYPE_LABELS: Record<BlockType, string> = {
  task: 'Task',
  event: 'Event',
  break: 'Break',
};

export function BlockEditorDialog({
  blockId,
  date: initialDate,
  initialType = 'event',
  onClose,
}: BlockEditorDialogProps) {
  const data = useAppData();
  const store = useAppStore();
  const toast = useToast();
  const confirm = useConfirm();
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const today = todayKey();
  const existing = blockId ? data.blocks.find((block) => block.id === blockId) : undefined;
  const alreadyScheduled = new Set(
    blocksForDate(data, initialDate)
      .filter((block) => block.taskId && block.id !== blockId)
      .map((block) => block.taskId as string),
  );

  const [type, setType] = useState<BlockType>(
    existing?.type ?? initialType,
  );
  const [title, setTitle] = useState(
    existing ? (existing.type === 'task' ? existing.title : existing.title) : '',
  );
  const [date, setDate] = useState(existing?.date ?? initialDate);
  const [start, setStart] = useState(
    minutesToTimeValue(existing?.startMin ?? 9 * 60),
  );
  const [end, setEnd] = useState(
    existing
      ? existing.endMin >= 1440
        ? '00:00'
        : minutesToTimeValue(existing.endMin)
      : minutesToTimeValue(10 * 60),
  );
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [taskId, setTaskId] = useState(
    existing?.taskId ??
      data.tasks.find(
        (task) => !task.completed && !alreadyScheduled.has(task.id) && task.dueDate === initialDate,
      )?.id ??
      data.tasks.find((task) => !task.completed && !alreadyScheduled.has(task.id))?.id ??
      '',
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (blockId && !existing) onClose();
  }, [blockId, existing, onClose]);

  const currentDateScheduled = new Set(
    blocksForDate(data, date)
      .filter((block) => block.taskId && block.id !== blockId)
      .map((block) => block.taskId as string),
  );
  const openTasks = data.tasks.filter(
    (task) =>
      !task.completed &&
      (!currentDateScheduled.has(task.id) || task.id === existing?.taskId),
  );
  const selectedTask = data.tasks.find((task) => task.id === taskId);
  const startMin = timeValueToMinutes(start);
  const endMin = timeValueToMinutes(end);
  const endValue = end === '00:00' ? 1440 : endMin;
  const duration =
    startMin !== null && endValue !== null && endValue > startMin
      ? endValue - startMin
      : null;

  const handleTypeChange = (nextType: BlockType) => {
    setType(nextType);
    setError(null);
    if (nextType === 'break') {
      setTitle((current) => current || 'Break');
    } else if (nextType === 'event') {
      setTitle((current) => (current === 'Break' ? '' : current));
    }
  };

  const handleTaskChange = (nextTaskId: string) => {
    setTaskId(nextTaskId);
    const task = data.tasks.find((candidate) => candidate.id === nextTaskId);
    if (task && startMin !== null) {
      const nextEnd = Math.min(1440, startMin + task.estimateMinutes);
      if (nextEnd > startMin) {
        setEnd(nextEnd === 1440 ? '00:00' : minutesToTimeValue(nextEnd));
      }
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (startMin === null) {
      setError('Choose a valid start time.');
      return;
    }
    if (endValue === null || endValue <= startMin) {
      setError('The end time must be later than the start time.');
      return;
    }
    if (type === 'task' && !taskId) {
      setError('Choose a task for this block.');
      return;
    }
    try {
      store.update((state) => {
        if (existing) {
          return updateScheduleBlock(state, existing.id, {
            date,
            startMin,
            endMin: endValue,
            title: type === 'task' ? existing.title : title,
            notes,
          });
        }
        return addScheduleBlock(state, {
          date,
          startMin,
          endMin: endValue,
          type,
          taskId: type === 'task' ? taskId : null,
          title: type === 'task' ? undefined : title,
          notes,
        });
      });
      toast({
        title: existing ? 'Time block updated' : 'Time block added',
        tone: 'success',
      });
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The block could not be saved.');
    }
  };

  const handleDelete = async () => {
    if (!existing) return;
    const shouldDelete = await confirm({
      title: 'Remove this time block?',
      description: `“${existing.title}” will be removed from ${formatDateLong(
        existing.date,
      )}. The task itself stays on your list.`,
      confirmLabel: 'Remove block',
      tone: 'danger',
    });
    if (!shouldDelete) return;
    try {
      store.update((state) => deleteScheduleBlock(state, existing.id));
      toast({ title: 'Time block removed', tone: 'success' });
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The block could not be removed.');
    }
  };

  return (
    <Dialog
      onClose={onClose}
      eyebrow={existing ? 'Scheduled time' : 'New time block'}
      title={
        existing
          ? existing.type === 'task'
            ? existing.title
            : 'Edit time block'
          : 'Add time to the day'
      }
      description={
        existing?.source === 'generated'
          ? 'This came from the auto-planner. Editing it makes the block yours, so future plans leave it alone.'
          : 'Reserve time for a task, an event, or a deliberate pause.'
      }
      initialFocusRef={firstFieldRef}
      size="md"
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
              Remove
            </Button>
          ) : null}
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="block-editor-form" size="sm">
            {existing ? 'Save block' : 'Add block'}
          </Button>
        </>
      }
    >
      <form id="block-editor-form" onSubmit={handleSubmit} className="space-y-5">
        {error ? (
          <div
            role="alert"
            className="rounded-xl border border-danger/20 bg-danger-soft px-3.5 py-2.5 text-[12px] leading-relaxed text-danger"
          >
            {error}
          </div>
        ) : null}

        {!existing ? (
          <Field label="Kind of time" htmlFor="block-type">
            <div className="grid grid-cols-3 gap-2">
              {(['task', 'event', 'break'] as BlockType[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => handleTypeChange(option)}
                  className={
                    type === option
                      ? 'pressable h-9 rounded-xl border border-accent/30 bg-accent-soft text-[12.5px] font-medium text-accent'
                      : 'pressable h-9 rounded-xl border border-line bg-canvas/60 text-[12.5px] font-medium text-ink-muted hover:border-line-strong hover:text-ink'
                  }
                >
                  {TYPE_LABELS[option]}
                </button>
              ))}
            </div>
          </Field>
        ) : (
          <div className="inline-flex items-center gap-1.5 rounded-full bg-raised px-2.5 py-1 text-[10.5px] font-medium text-ink-soft">
            <CalendarDays className="h-3 w-3" strokeWidth={1.8} />
            {TYPE_LABELS[existing.type]} block
          </div>
        )}

        {type === 'task' ? (
          existing ? (
            <div className="rounded-xl border border-line bg-canvas/40 px-3.5 py-3">
              <p className="text-[13px] font-medium text-ink">{existing.title}</p>
              <p className="mt-0.5 text-[11px] text-ink-muted">
                Linked tasks keep their title from the task list.
              </p>
            </div>
          ) : (
            <Field label="Task" htmlFor="block-task">
              {openTasks.length > 0 ? (
                <Select
                  id="block-task"
                  value={taskId}
                  onChange={(event) => handleTaskChange(event.target.value)}
                >
                  {openTasks.map((task) => (
                    <option key={task.id} value={task.id}>
                      {task.title} · {formatDuration(task.estimateMinutes)}
                    </option>
                  ))}
                </Select>
              ) : (
                <p className="rounded-xl border border-dashed border-line px-3.5 py-3 text-[12px] leading-relaxed text-ink-muted">
                  Every open task is already scheduled on this day. Add a new task first, or
                  choose another day.
                </p>
              )}
              {selectedTask ? (
                <p className="mt-1.5 text-[11px] text-ink-muted">
                  {formatDuration(selectedTask.estimateMinutes)} estimated · end time filled
                  automatically.
                </p>
              ) : null}
            </Field>
          )
        ) : (
          <Field
            label={type === 'event' ? 'What is it?' : 'Label'}
            htmlFor="block-title"
            optionalLabel={type === 'break'}
          >
            <Input
              ref={firstFieldRef}
              id="block-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={type === 'event' ? 'Dentist, call with Sam, deep work…' : 'Break'}
              maxLength={180}
              autoComplete="off"
            />
          </Field>
        )}

        <Field label="Day" htmlFor="block-date">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              id="block-date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="flex-1"
            />
            <button
              type="button"
              onClick={() => setDate(today)}
              className="pressable rounded-full border border-line px-2.5 py-1.5 text-[11.5px] font-medium text-ink-muted hover:border-line-strong hover:text-ink"
            >
              Today
            </button>
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Starts" htmlFor="block-start">
            <Input
              id="block-start"
              type="time"
              step={300}
              value={start}
              onChange={(event) => setStart(event.target.value)}
            />
          </Field>
          <Field
            label="Ends"
            htmlFor="block-end"
            hint={
              duration && duration >= 5
                ? `${formatDuration(duration)} reserved`
                : 'Choose an end time.'
            }
          >
            <Input
              id="block-end"
              type="time"
              step={300}
              value={end}
              onChange={(event) => setEnd(event.target.value)}
            />
          </Field>
        </div>

        <Field label="Notes" htmlFor="block-notes" optionalLabel>
          <Textarea
            id="block-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Anything useful to remember at that time…"
            maxLength={1000}
            rows={2}
            className="min-h-[68px]"
          />
        </Field>

        {existing ? (
          <p className="flex items-center gap-1.5 border-t border-line pt-3 text-[11px] text-ink-muted">
            <Clock3 className="h-3 w-3" strokeWidth={1.8} />
            {existing.source === 'generated' ? 'Auto-planned' : 'Manually placed'} on{' '}
            {formatDateLong(existing.date)}
          </p>
        ) : null}
      </form>
    </Dialog>
  );
}
