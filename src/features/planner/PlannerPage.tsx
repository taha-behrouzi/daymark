import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Coffee,
  Lock,
  Plus,
  Sparkles,
  Timer,
  TriangleAlert,
  Wand2,
} from 'lucide-react';
import {
  addDays,
  formatDateLong,
  formatDuration,
  formatTime,
  formatTimeCompact,
  formatTimeRange,
  getWeekDays,
  hourLabel,
  isWeekendKey,
  isValidDateKey,
  todayKey,
} from '../../lib/date';
import { cn } from '../../lib/cn';
import {
  applyGeneratedPlan,
  blocksForDate,
  clearGeneratedPlan,
  getPlannerDay,
  scheduleConflictsForDate,
  scheduleTaskAt,
  updateScheduleBlock,
} from '../../domain/planner';
import {
  findEarliestOpening,
  generatePlan,
  getFreeGaps,
  type PlanTaskInput,
} from '../../domain/scheduler';
import { sortTasks } from '../../domain/queries';
import { useAppData, useAppStore } from '../../store/AppStoreProvider';
import { useRouter } from '../../store/RouterProvider';
import { useAppDialogs } from '../../store/AppDialogsProvider';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button, IconButton } from '../../components/ui/Button';
import { Chip, Kbd } from '../../components/ui/Meta';
import { useToast } from '../../components/ui/toast';
import { useConfirm } from '../../components/ui/confirm';
import { EmptyState } from '../../components/ui/EmptyState';
import type { ScheduleBlock, Task } from '../../types';
import { BlockEditorDialog } from './BlockEditorDialog';
import { DayHoursDialog } from './DayHoursDialog';
import type { BlockType } from '../../types';

type DialogState =
  | { kind: 'hours' }
  | { kind: 'block'; blockId?: string; initialType?: BlockType }
  | null;

const MIN_PX = 1;
const SNAP = 5;

export function PlannerPage() {
  const data = useAppData();
  const store = useAppStore();
  const toast = useToast();
  const confirm = useConfirm();
  const { openTaskEditor } = useAppDialogs();
  const { route, navigate } = useRouter();
  const today = todayKey();
  const requestedDate = route.query.date;
  const date = requestedDate && isValidDateKey(requestedDate) ? requestedDate : today;
  const [dialog, setDialog] = useState<DialogState>(null);
  const [nowMinutes, setNowMinutes] = useState(
    () => new Date().getHours() * 60 + new Date().getMinutes(),
  );

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = new Date();
      setNowMinutes(now.getHours() * 60 + now.getMinutes());
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const plannerDay = getPlannerDay(data, date);
  const blocks = blocksForDate(data, date);
  const conflicts = useMemo(() => scheduleConflictsForDate(data, date), [data, date]);
  const conflictIds = new Set(
    conflicts.flatMap((conflict) => [conflict.first.id, conflict.second.id]),
  );
  const taskBlocks = blocks.filter((block) => block.type === 'task' && block.taskId);
  const taskMinutes = taskBlocks.reduce((sum, block) => sum + (block.endMin - block.startMin), 0);
  const bookedMinutes = blocks
    .filter((block) => block.startMin < plannerDay.endMin && block.endMin > plannerDay.startMin)
    .reduce(
      (sum, block) =>
        sum +
        (Math.min(block.endMin, plannerDay.endMin) - Math.max(block.startMin, plannerDay.startMin)),
      0,
    );
  const freeMinutes = getFreeGaps(
    blocks.map((block) => ({ startMin: block.startMin, endMin: block.endMin })),
    { startMin: plannerDay.startMin, endMin: plannerDay.endMin },
  ).reduce((sum, gap) => sum + (gap.endMin - gap.startMin), 0);

  const unscheduled = useMemo(() => {
    const scheduledIds = new Set(
      blocks.filter((block) => block.taskId).map((block) => block.taskId as string),
    );
    const eligible = data.tasks.filter(
      (task) =>
        !task.completed &&
        !scheduledIds.has(task.id) &&
        (task.focusDate === date ||
          (task.dueDate !== null && task.dueDate <= date)),
    );
    return sortTasks(eligible, 'smart');
  }, [blocks, data.tasks, date]);

  const weekDays = getWeekDays(date, data.settings.weekStartsOn);
  const duplicateGenerated = blocks.some((block) => block.source === 'generated');

  const setDate = (nextDate: string) => {
    navigate('planner', { date: nextDate });
  };

  const handleAutoPlan = () => {
    const manualBlocks = blocks.filter((block) => block.source === 'manual');
    const taskInputs: PlanTaskInput[] = data.tasks.map((task) => ({
      id: task.id,
      title: task.title,
      dueDate: task.dueDate,
      importance: task.importance,
      completed: task.completed,
      focusDate: task.focusDate,
      focusOrder: task.focusOrder,
      estimateMinutes: task.estimateMinutes,
      preferredPeriod: task.preferredPeriod,
      createdAt: task.createdAt,
    }));

    const result = generatePlan(taskInputs, {
      date,
      dayStartMin: plannerDay.startMin,
      dayEndMin: plannerDay.endMin,
      breakMinutes: plannerDay.breakMinutes,
      breakAfterMinutes: plannerDay.breakAfterMinutes,
      fixedBlocks: manualBlocks.map((block) => ({
        id: block.id,
        title: block.title,
        startMin: block.startMin,
        endMin: block.endMin,
        taskId: block.taskId,
      })),
    });

    try {
      store.update((state) => applyGeneratedPlan(state, date, result.blocks));
      const placedTasks = result.blocks.filter((block) => block.type === 'task').length;
      if (placedTasks === 0) {
        toast({
          title: 'Nothing to auto-plan',
          description:
            result.unscheduled.length > 0
              ? result.unscheduled[0]?.detail
              : 'No tasks are due or chosen as priorities for this day.',
          tone: 'info',
        });
        return;
      }
      const notes: string[] = [
        `${placedTasks} task${placedTasks === 1 ? '' : 's'} placed · ${formatDuration(
          result.scheduledMinutes,
        )}`,
        result.breakMinutesPlanned > 0
          ? `${result.breakMinutesPlanned} min of breaks`
          : '',
        result.unscheduled.length > 0
          ? `${result.unscheduled.length} could not fit`
          : '',
      ].filter(Boolean);
      if (result.warnings.length > 0) notes.push(result.warnings[0] ?? '');
      toast({
        title: 'Day planned',
        description: notes.join(' · '),
        tone: result.unscheduled.length > 0 ? 'info' : 'success',
        duration: 7000,
      });
    } catch (error) {
      toast({
        title: 'The plan could not be applied',
        description: error instanceof Error ? error.message : undefined,
        tone: 'error',
      });
    }
  };

  const handleClearGenerated = async () => {
    const shouldClear = await confirm({
      title: 'Clear the auto-plan?',
      description:
        'Only blocks created by the planner will be removed. Tasks, events, and breaks you placed by hand stay exactly where they are.',
      confirmLabel: 'Clear auto-plan',
    });
    if (!shouldClear) return;
    try {
      store.update((state) => clearGeneratedPlan(state, date));
      toast({ title: 'Auto-plan cleared', tone: 'success' });
    } catch (error) {
      toast({
        title: 'Could not clear the plan',
        description: error instanceof Error ? error.message : undefined,
        tone: 'error',
      });
    }
  };

  const scheduleUnscheduled = (task: Task) => {
    const opening = findEarliestOpening({
      busy: blocks.map((block) => ({ startMin: block.startMin, endMin: block.endMin })),
      window: { startMin: plannerDay.startMin, endMin: plannerDay.endMin },
      duration: task.estimateMinutes,
      preferredPeriod: task.preferredPeriod,
    });
    if (!opening) {
      toast({
        title: 'No opening big enough',
        description: `“${task.title}” needs ${formatDuration(
          task.estimateMinutes,
        )}. Try adjusting the day’s hours or moving a block.`,
        tone: 'error',
      });
      return;
    }
    try {
      store.update((state) =>
        scheduleTaskAt(state, task.id, date, opening.startMin),
      );
      toast({
        title: 'Task placed',
        description: `${formatTimeCompact(opening.startMin, data.settings.timeFormat)}–${formatTimeCompact(
          opening.startMin + task.estimateMinutes,
          data.settings.timeFormat,
        )}${opening.respectedPreference ? '' : ' · outside its preferred time'}`,
        tone: 'success',
      });
    } catch (error) {
      toast({
        title: 'Could not place the task',
        description: error instanceof Error ? error.message : undefined,
        tone: 'error',
      });
    }
  };

  const moveBlock = (block: ScheduleBlock, newStartMin: number) => {
    const duration = block.endMin - block.startMin;
    try {
      store.update((state) =>
        updateScheduleBlock(state, block.id, {
          date: block.date,
          startMin: newStartMin,
          endMin: newStartMin + duration,
        }),
      );
    } catch (error) {
      toast({
        title: 'That move overlaps another block',
        description: error instanceof Error ? error.message : 'Try a different time.',
        tone: 'error',
      });
    }
  };

  const dueTodayCount = data.tasks.filter(
    (task) => !task.completed && task.dueDate === date,
  ).length;
  const prioritiesCount = data.tasks.filter(
    (task) => task.focusDate === date && !task.completed,
  ).length;

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow={date === today ? 'Today’s plan' : 'Daily plan'}
        title={formatDateLong(date)}
        description={
          blocks.length === 0
            ? 'Nothing is blocked out yet. Build the day by hand, or let the planner suggest an honest shape.'
            : `${taskBlocks.length} task${
                taskBlocks.length === 1 ? '' : 's'
              } scheduled · ${formatDuration(taskMinutes)} of focused work · ${formatDuration(
                freeMinutes,
              )} still open.`
        }
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => setDialog({ kind: 'block', initialType: 'event' })}
            >
              <Plus className="h-4 w-4" strokeWidth={2} />
              Add block
            </Button>
            <Button onClick={handleAutoPlan}>
              <Wand2 className="h-4 w-4" strokeWidth={1.8} />
              Auto-plan
            </Button>
          </>
        }
      />

      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface px-2.5 py-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1">
          <div className="flex items-center gap-0.5">
            <IconButton
              label="Previous day"
              size="sm"
              onClick={() => setDate(addDays(date, -1))}
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={1.8} />
            </IconButton>
            <IconButton
              label="Next day"
              size="sm"
              onClick={() => setDate(addDays(date, 1))}
            >
              <ChevronRight className="h-4 w-4" strokeWidth={1.8} />
            </IconButton>
          </div>
          {date !== today ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2.5 text-[11.5px]"
              onClick={() => setDate(today)}
            >
              Today
            </Button>
          ) : null}
          <div className="mx-1 hidden h-5 w-px bg-line sm:block" />
          <button
            type="button"
            onClick={() => setDialog({ kind: 'hours' })}
            className="pressable inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11.5px] font-medium text-ink-muted hover:bg-raised hover:text-ink"
          >
            <Clock3 className="h-3.5 w-3.5" strokeWidth={1.8} />
            {formatTime(plannerDay.startMin, data.settings.timeFormat)}–
            {plannerDay.endMin === 1440
              ? '24:00'
              : formatTime(plannerDay.endMin, data.settings.timeFormat)}
            {plannerDay.breakMinutes > 0
              ? ` · ${plannerDay.breakMinutes}m break after ${plannerDay.breakAfterMinutes}m`
              : ' · no breaks'}
          </button>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
          {weekDays.map((day) => {
            const selected = day === date;
            const isToday = day === today;
            const dayTaskCount = data.tasks.filter(
              (task) => !task.completed && (task.dueDate === day || task.focusDate === day),
            ).length;
            const dayBlocks = blocksForDate(data, day).length;
            return (
              <button
                key={day}
                type="button"
                onClick={() => setDate(day)}
                aria-current={selected ? 'date' : undefined}
                className={cn(
                  'pressable relative flex min-w-[42px] flex-col items-center rounded-xl border px-1.5 py-1.5',
                  selected
                    ? 'border-ink bg-ink text-canvas'
                    : isWeekendKey(day)
                      ? 'border-transparent text-ink-muted hover:border-line hover:bg-raised/50'
                      : 'border-transparent text-ink-soft hover:border-line hover:bg-raised/50',
                )}
              >
                <span className="text-[9px] font-medium uppercase tracking-[0.08em] opacity-70">
                  {new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(
                    new Date(`${day}T12:00:00`),
                  )}
                </span>
                <span className="font-tabular text-[13px] font-semibold leading-tight">
                  {Number(day.slice(8, 10))}
                </span>
                <span
                  className={cn(
                    'absolute bottom-1 h-1 w-1 rounded-full',
                    selected
                      ? 'bg-canvas/80'
                      : isToday
                        ? 'bg-accent'
                        : dayBlocks > 0 || dayTaskCount > 0
                          ? 'bg-line-strong'
                          : 'bg-transparent',
                  )}
                />
              </button>
            );
          })}
        </div>
      </div>

      {conflicts.length > 0 ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-danger/25 bg-danger-soft px-3.5 py-3 text-danger">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.9} />
          <p className="text-[12px] leading-relaxed">
            {conflicts.length} overlapping block{conflicts.length === 1 ? '' : 's'} found on this
            day. This can happen with imported data. Drag a block or edit its time to separate
            them; new manual blocks cannot overlap.
          </p>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_330px]">
        <section className="min-w-0 overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/70 px-4 py-3">
            <div className="flex items-center gap-3 text-[11px] text-ink-muted">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm border border-accent/40 bg-accent-soft" />
                Task
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm border border-dashed border-line-strong bg-raised" />
                Auto-planned
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm border border-sage/40 bg-sage-soft" />
                Break
              </span>
            </div>
            <div className="flex items-center gap-2">
              {dueTodayCount > 0 ? (
                <Chip tone="outline">{dueTodayCount} due</Chip>
              ) : null}
              {prioritiesCount > 0 ? (
                <Chip tone="accent">{prioritiesCount} priorities</Chip>
              ) : null}
            </div>
          </div>

          {blocks.length === 0 ? (
            <EmptyState
              icon={CalendarClock}
              title="A day with room in it"
              description="Auto-plan turns priorities and deadlines into a sequence, with breathing room built in. Or add a block yourself."
              action={
                <>
                  <Button size="sm" onClick={handleAutoPlan}>
                    <Sparkles className="h-3.5 w-3.5" strokeWidth={1.8} />
                    Auto-plan this day
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setDialog({ kind: 'block', initialType: 'event' })}
                  >
                    <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                    Add a block
                  </Button>
                </>
              }
            />
          ) : (
            <Timeline
              blocks={blocks}
              plannerDay={plannerDay}
              nowMinutes={nowMinutes}
              isToday={date === today}
              timeFormat={data.settings.timeFormat}
              conflictIds={conflictIds}
              onOpenBlock={(blockId) => setDialog({ kind: 'block', blockId })}
              onMoveBlock={moveBlock}
            />
          )}
        </section>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-line bg-surface px-4 py-4">
            <h2 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
              The day, measured
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <p className="font-display text-[27px] leading-none tracking-[-0.03em] text-ink">
                  {formatDuration(taskMinutes)}
                </p>
                <p className="mt-1 text-[10.5px] text-ink-muted">of task work</p>
              </div>
              <div>
                <p className="font-display text-[27px] leading-none tracking-[-0.03em] text-sage">
                  {formatDuration(freeMinutes)}
                </p>
                <p className="mt-1 text-[10.5px] text-ink-muted">free in your window</p>
              </div>
            </div>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-line/80">
              <div className="flex h-full">
                <div
                  className="h-full bg-accent/70"
                  style={{
                    width: `${Math.min(
                      100,
                      (bookedMinutes / Math.max(1, plannerDay.endMin - plannerDay.startMin)) * 100,
                    )}%`,
                  }}
                />
              </div>
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[10px] text-ink-muted">
              <span>{formatDuration(bookedMinutes)} booked</span>
              <span>
                {formatDuration(plannerDay.endMin - plannerDay.startMin)} window
              </span>
            </div>
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-line/70 pt-3 text-[10.5px] text-ink-muted">
              <span className="inline-flex items-center gap-1.5">
                <Timer className="h-3 w-3" strokeWidth={1.8} />
                {taskBlocks.length} task block{taskBlocks.length === 1 ? '' : 's'}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Coffee className="h-3 w-3" strokeWidth={1.8} />
                <span>
                  {blocks
                    .filter((block) => block.type === 'break')
                    .reduce((sum, block) => sum + (block.endMin - block.startMin), 0)}{' '}
                  min breaks
                </span>
              </span>
            </div>
          </section>

          <section className="rounded-2xl border border-line bg-surface">
            <div className="flex items-center justify-between gap-3 border-b border-line/70 px-4 py-3">
              <h2 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
                Waiting for a home
              </h2>
              <Chip tone={unscheduled.length > 0 ? 'accent' : 'neutral'}>
                {unscheduled.length}
              </Chip>
            </div>
            {unscheduled.length > 0 ? (
              <>
                <p className="px-4 pt-3 text-[11px] leading-relaxed text-ink-muted">
                  Due today or chosen as a priority, but not on the timeline.
                </p>
                <ul className="space-y-1 px-2 pb-2 pt-2">
                  {unscheduled.map((task) => (
                    <li
                      key={task.id}
                      className="flex items-start gap-2 rounded-lg px-2 py-2 hover:bg-raised/50"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-medium leading-snug text-ink">
                          {task.title}
                        </p>
                        <p className="mt-0.5 text-[10px] text-ink-muted">
                          {formatDuration(task.estimateMinutes)}
                          {task.importance === 'high' ? ' · high importance' : ''}
                        </p>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-7 shrink-0 px-2 text-[10.5px]"
                        onClick={() => scheduleUnscheduled(task)}
                      >
                        Place
                      </Button>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <div className="px-4 py-5 text-center">
                <p className="text-[11.5px] leading-relaxed text-ink-muted">
                  {taskBlocks.length > 0
                    ? 'Everything due or prioritized has a place on the timeline.'
                    : 'Add a due task or choose a priority, then it will appear here.'}
                </p>
                <button
                  type="button"
                  onClick={() => openTaskEditor({ preset: { dueDate: date } })}
                  className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-accent hover:text-accent-hover"
                >
                  <Plus className="h-3 w-3" strokeWidth={2} />
                  Add a task for this day
                </button>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-line bg-canvas/40 px-4 py-4">
            <div className="flex items-start gap-2">
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-muted" strokeWidth={1.8} />
              <p className="text-[11px] leading-relaxed text-ink-muted">
                Blocks you place by hand are kept when you auto-plan again. Generated blocks are
                replaced. Drag any block to move it.
              </p>
            </div>
            {duplicateGenerated ? (
              <button
                type="button"
                onClick={() => void handleClearGenerated()}
                className="mt-3 text-[11px] font-medium text-ink-muted underline decoration-line-strong underline-offset-2 hover:text-ink"
              >
                Clear generated blocks
              </button>
            ) : null}
          </section>

          <div className="flex items-center justify-between gap-2 px-1 text-[10px] text-ink-muted">
            <span className="inline-flex items-center gap-1.5">
              <Kbd>N</Kbd> new task
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Kbd>G</Kbd> then <Kbd>P</Kbd>
            </span>
          </div>
        </aside>
      </div>

      {dialog?.kind === 'hours' ? (
        <DayHoursDialog date={date} onClose={() => setDialog(null)} />
      ) : null}
      {dialog?.kind === 'block' ? (
        <BlockEditorDialog
          blockId={dialog.blockId}
          initialType={dialog.initialType}
          date={date}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </div>
  );
}

interface TimelineProps {
  blocks: ScheduleBlock[];
  plannerDay: {
    startMin: number;
    endMin: number;
  };
  nowMinutes: number;
  isToday: boolean;
  timeFormat: '12h' | '24h';
  conflictIds: Set<string>;
  onOpenBlock: (blockId: string) => void;
  onMoveBlock: (block: ScheduleBlock, newStartMin: number) => void;
}

function Timeline({
  blocks,
  plannerDay,
  nowMinutes,
  isToday,
  timeFormat,
  conflictIds,
  onOpenBlock,
  onMoveBlock,
}: TimelineProps) {
  const earliest = Math.min(plannerDay.startMin, ...blocks.map((block) => block.startMin));
  const latest = Math.max(plannerDay.endMin, ...blocks.map((block) => block.endMin));
  const timelineStart = Math.max(0, Math.floor(earliest / 60) * 60);
  const timelineEnd = Math.min(1440, Math.ceil(latest / 60) * 60);
  const height = Math.max(120, (timelineEnd - timelineStart) * MIN_PX);
  const hours: number[] = [];
  for (let minute = timelineStart; minute <= timelineEnd; minute += 60) {
    hours.push(minute);
  }
  const showNow = isToday && nowMinutes >= timelineStart && nowMinutes <= timelineEnd;

  return (
    <div className="max-h-[70vh] overflow-y-auto overflow-x-hidden p-4 pr-3 [scrollbar-gutter:stable]">
      <div className="relative" style={{ height }}>
        {hours.map((minute) => (
          <div
            key={minute}
            className="absolute inset-x-0 border-t border-line/55"
            style={{ top: (minute - timelineStart) * MIN_PX }}
          >
            <span className="absolute -top-2.5 left-0 font-tabular text-[9.5px] font-medium text-ink-muted/85">
              {hourLabel(minute, timeFormat)}
            </span>
          </div>
        ))}

        {showNow ? (
          <div
            className="pointer-events-none absolute inset-x-0 z-20 border-t border-accent/80"
            style={{ top: (nowMinutes - timelineStart) * MIN_PX }}
          >
            <span className="absolute -left-0.5 -top-[3px] h-1.5 w-1.5 rounded-full bg-accent" />
            <span className="absolute -top-2 right-0 rounded-full bg-accent px-1.5 py-0.5 text-[8.5px] font-semibold uppercase tracking-[0.08em] text-white dark:text-[#211510]">
              now
            </span>
          </div>
        ) : null}

        <div className="absolute inset-y-0 left-[52px] right-0">
          {blocks.map((block) => (
            <TimelineBlock
              key={block.id}
              block={block}
              timelineStart={timelineStart}
              timelineEnd={timelineEnd}
              pxPerMinute={MIN_PX}
              timeFormat={timeFormat}
              conflict={conflictIds.has(block.id)}
              onOpen={() => onOpenBlock(block.id)}
              onMove={(newStartMin) => onMoveBlock(block, newStartMin)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function TimelineBlock({
  block,
  timelineStart,
  timelineEnd,
  pxPerMinute,
  timeFormat,
  conflict,
  onOpen,
  onMove,
}: {
  block: ScheduleBlock;
  timelineStart: number;
  timelineEnd: number;
  pxPerMinute: number;
  timeFormat: '12h' | '24h';
  conflict: boolean;
  onOpen: () => void;
  onMove: (newStartMin: number) => void;
}) {
  const duration = block.endMin - block.startMin;
  const [dragDelta, setDragDelta] = useState(0);
  const dragRef = useRef<{
    startY: number;
    startMin: number;
    moved: boolean;
    pointerId: number;
  } | null>(null);
  const suppressClickRef = useRef(false);
  const minStart = timelineStart;
  const maxStart = timelineEnd - duration;
  const top = (block.startMin - timelineStart + dragDelta) * pxPerMinute;
  const height = Math.max(22, duration * pxPerMinute);

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest('button[data-block-action]')) return;
    dragRef.current = {
      startY: event.clientY,
      startMin: block.startMin,
      moved: false,
      pointerId: event.pointerId,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const rawDelta = (event.clientY - drag.startY) / pxPerMinute;
    const snapped = Math.round(rawDelta / SNAP) * SNAP;
    const clamped = Math.max(
      minStart - drag.startMin,
      Math.min(maxStart - drag.startMin, snapped),
    );
    if (clamped !== 0) drag.moved = true;
    setDragDelta(clamped);
  };

  const finishDrag = () => {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    if (drag.moved && dragDelta !== 0) {
      const nextStart = Math.max(minStart, Math.min(maxStart, drag.startMin + dragDelta));
      suppressClickRef.current = true;
      onMove(nextStart);
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 200);
    }
    setDragDelta(0);
  };

  const cancelDrag = () => {
    dragRef.current = null;
    setDragDelta(0);
  };

  return (
    <button
      type="button"
      onClick={() => {
        if (suppressClickRef.current) {
          suppressClickRef.current = false;
          return;
        }
        onOpen();
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={cancelDrag}
      aria-label={`Edit ${block.title}, ${formatTimeRange(
        block.startMin,
        block.endMin,
        timeFormat,
      )}${block.source === 'generated' ? ', auto-planned' : ''}`}
      className={cn(
        'group absolute inset-x-0 select-none overflow-hidden rounded-lg border px-2.5 py-1 text-left shadow-[0_1px_1px_rgb(28_27_24/0.03)] transition-shadow hover:shadow-soft focus-visible:z-30',
        block.type === 'break' && 'border-sage/30 bg-sage-soft/80',
        block.type === 'event' && 'border-line-strong bg-raised/85',
        block.type === 'task' &&
          (block.source === 'generated'
            ? 'border-dashed border-line-strong bg-raised/80'
            : 'border-accent/25 bg-accent-soft/70'),
        conflict && 'border-danger/60 bg-danger-soft',
        dragDelta !== 0 && 'z-30 cursor-grabbing opacity-90 ring-2 ring-accent/30',
      )}
      style={{ top, height }}
    >
      <span className="flex items-start gap-1.5">
        <span
          aria-hidden="true"
          className={cn(
            'mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full',
            block.type === 'break'
              ? 'bg-sage'
              : block.type === 'event'
                ? 'bg-line-strong'
                : conflict
                  ? 'bg-danger'
                  : 'bg-accent',
          )}
        />
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              'block truncate text-[11.5px] font-medium leading-[1.35]',
              block.type === 'task' ? 'text-ink' : 'text-ink-soft',
            )}
          >
            {block.title}
          </span>
          {height >= 34 ? (
            <span className="mt-0.5 block truncate text-[9.5px] font-tabular text-ink-muted">
              {formatTimeRange(block.startMin, block.endMin, timeFormat)}
              {block.type === 'break' ? ' · break' : ''}
              {block.source === 'generated' ? ' · auto' : ''}
            </span>
          ) : null}
        </span>
        {height >= 44 ? (
          <ChevronRight
            className="mt-0.5 h-3 w-3 shrink-0 text-ink-muted opacity-0 transition-opacity group-hover:opacity-100"
            strokeWidth={1.8}
          />
        ) : null}
      </span>
    </button>
  );
}
