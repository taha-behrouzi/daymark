import { useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Clock3,
  Plus,
  Sparkles,
} from 'lucide-react';
import {
  addDays,
  addMonths,
  formatDateLong,
  formatDateMedium,
  formatDateWithYear,
  formatMonthYear,
  formatTimeCompact,
  getMonthGrid,
  getWeekDays,
  getWeekdayShort,
  isWeekendKey,
  isValidDateKey,
  monthRange,
  parseDateKey,
  todayKey,
  weekRange,
} from '../../lib/date';
import { cn } from '../../lib/cn';
import {
  calendarDayData,
  getCategory,
  sortTasks,
} from '../../domain/queries';
import { useAppData } from '../../store/AppStoreProvider';
import { useRouter } from '../../store/RouterProvider';
import { useAppDialogs } from '../../store/AppDialogsProvider';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button, IconButton } from '../../components/ui/Button';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { CategoryDot, Chip } from '../../components/ui/Meta';
import { EmptyState } from '../../components/ui/EmptyState';
import { TaskRow } from '../tasks/TaskRow';
import { MONTH_LABELS } from '../../constants';
import type { AppData } from '../../types';

type CalendarView = 'month' | 'week' | 'day';

const VIEW_OPTIONS: { value: CalendarView; label: string }[] = [
  { value: 'month', label: 'Month' },
  { value: 'week', label: 'Week' },
  { value: 'day', label: 'Day' },
];

const VALID_VIEWS: readonly CalendarView[] = ['month', 'week', 'day'];

export function CalendarPage() {
  const data = useAppData();
  const { route, navigate } = useRouter();
  const { openTaskEditor } = useAppDialogs();
  const today = todayKey();
  const queryDate = route.query.date;
  const date = queryDate && isValidDateKey(queryDate) ? queryDate : today;
  const requestedView = route.query.view;
  const view: CalendarView =
    requestedView && VALID_VIEWS.includes(requestedView as CalendarView)
      ? (requestedView as CalendarView)
      : 'month';
  const parsed = parseDateKey(date) ?? { year: 2026, month: 1, day: 1 };

  const navigateTo = (nextDate: string, nextView: CalendarView = view) => {
    navigate('calendar', { date: nextDate, view: nextView });
  };

  const shift = (direction: -1 | 1) => {
    if (view === 'month') navigateTo(addMonths(date, direction));
    else if (view === 'week') navigateTo(addDays(date, 7 * direction));
    else navigateTo(addDays(date, direction));
  };

  const range = useMemo(() => {
    if (view === 'month') return monthRange(date);
    if (view === 'week') return weekRange(date, data.settings.weekStartsOn);
    return { start: date, end: date };
  }, [data.settings.weekStartsOn, date, view]);

  const dueInRange = data.tasks.filter(
    (task) =>
      !task.completed &&
      task.dueDate !== null &&
      task.dueDate >= range.start &&
      task.dueDate <= range.end,
  ).length;
  const blocksInRange = data.blocks.filter(
    (block) => block.date >= range.start && block.date <= range.end,
  ).length;

  const title =
    view === 'month'
      ? formatMonthYear(parsed.year, parsed.month - 1)
      : view === 'week'
        ? `${formatDateMedium(range.start)} – ${formatDateWithYear(range.end)}`
        : formatDateLong(date);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Time, at a glance"
        title={title}
        description={`${dueInRange} open deadline${dueInRange === 1 ? '' : 's'} and ${blocksInRange} time block${
          blocksInRange === 1 ? '' : 's'
        } in view. Tasks appear as blocks when scheduled; deadlines wait below the timeline.`}
        actions={
          <Button
            onClick={() => {
              navigate('planner', { date });
            }}
          >
            <Sparkles className="h-4 w-4" strokeWidth={1.8} />
            Open day planner
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1">
          <IconButton label="Previous period" size="sm" onClick={() => shift(-1)}>
            <ChevronLeft className="h-4 w-4" strokeWidth={1.8} />
          </IconButton>
          <Button
            variant="secondary"
            size="sm"
            className="h-8"
            onClick={() => navigateTo(today)}
          >
            Today
          </Button>
          <IconButton label="Next period" size="sm" onClick={() => shift(1)}>
            <ChevronRight className="h-4 w-4" strokeWidth={1.8} />
          </IconButton>
          <span className="ml-2 hidden text-[11px] text-ink-muted sm:inline">
            {view === 'month'
              ? 'Click any day to see it in full'
              : view === 'week'
                ? 'Seven days, one honest overview'
                : 'A single day in full'}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl
            label="Calendar view"
            value={view}
            onChange={(nextView) => navigateTo(date, nextView)}
            options={VIEW_OPTIONS}
            size="sm"
          />
          <Button
            variant="secondary"
            size="sm"
            className="hidden sm:inline-flex"
            onClick={() => {
              navigate('planner', { date });
            }}
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2} />
            Add time
          </Button>
        </div>
      </div>

      {view === 'month' ? (
        <MonthView
          data={data}
          year={parsed.year}
          monthIndex={parsed.month - 1}
          date={date}
          today={today}
          onOpenDay={(key) => navigateTo(key, 'day')}
        />
      ) : view === 'week' ? (
        <WeekView
          data={data}
          date={date}
          today={today}
          onOpenDay={(key) => navigate('planner', { date: key })}
          onEditTask={(taskId) => openTaskEditor({ taskId })}
        />
      ) : (
        <DayView
          data={data}
          date={date}
          today={today}
          onOpenPlanner={() => navigate('planner', { date })}
          onNewTask={() => openTaskEditor({ preset: { dueDate: date } })}
        />
      )}
    </div>
  );
}

function MonthView({
  data,
  year,
  monthIndex,
  date,
  today,
  onOpenDay,
}: {
  data: AppData;
  year: number;
  monthIndex: number;
  date: string;
  today: string;
  onOpenDay: (key: string) => void;
}) {
  const cells = getMonthGrid(year, monthIndex, data.settings.weekStartsOn);
  const weekdayHeaders = Array.from({ length: 7 }, (_, index) =>
    getWeekdayShort(data.settings.weekStartsOn + index),
  );

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="grid grid-cols-7 border-b border-line bg-raised/35">
        {weekdayHeaders.map((label) => (
          <div
            key={label}
            className="px-1.5 py-2 text-center text-[9.5px] font-semibold uppercase tracking-[0.12em] text-ink-muted sm:px-3"
          >
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{label.slice(0, 1)}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((cell, index) => {
          const dayData = calendarDayData(data, cell.key);
          const openDue = dayData.dueTasks.filter((task) => !task.completed);
          const unscheduled = dayData.unscheduledDueTasks.filter((task) => !task.completed);
          const priorityCount = data.tasks.filter(
            (task) => task.focusDate === cell.key && !task.completed,
          ).length;
          const entries = [
            ...dayData.blocks.map((block) => ({
              key: `b-${block.id}`,
              title: block.title,
              meta: formatTimeCompact(block.startMin, data.settings.timeFormat),
              kind: 'block' as const,
              type: block.type,
            })),
            ...unscheduled.map((task) => ({
              key: `t-${task.id}`,
              title: task.title,
              meta: 'due',
              kind: 'task' as const,
              type: 'task' as const,
              categoryId: task.categoryId,
            })),
          ];
          const isCurrentMonth = cell.inCurrentMonth;
          const isToday = cell.key === today;
          const isSelected = cell.key === date;
          return (
            <button
              key={cell.key}
              type="button"
              onClick={() => onOpenDay(cell.key)}
              aria-label={`Open ${formatDateLong(cell.key)} in day view`}
              className={cn(
                'group relative flex min-h-[78px] flex-col border-b border-r border-line/70 p-1 text-left transition-colors sm:min-h-[112px] sm:p-1.5',
                index % 7 === 6 && 'border-r-0',
                index >= 35 && 'border-b-0',
                !isCurrentMonth && 'bg-canvas/45',
                isWeekendKey(cell.key) && isCurrentMonth && 'bg-canvas/25',
                isSelected ? 'bg-accent-soft/25' : 'hover:bg-raised/45',
              )}
            >
              <span className="flex items-center justify-between gap-1 px-0.5">
                <span
                  className={cn(
                    'flex h-5 min-w-5 items-center justify-center rounded-full px-1 font-tabular text-[11px] font-semibold',
                    isToday
                      ? 'bg-accent text-white dark:text-[#211510]'
                      : isCurrentMonth
                        ? 'text-ink-soft'
                        : 'text-ink-muted/55',
                    isSelected && !isToday && 'text-accent',
                  )}
                >
                  {Number(cell.key.slice(8, 10))}
                </span>
                {openDue.length > 0 ? (
                  <span
                    className="hidden rounded-full bg-raised px-1 font-tabular text-[8.5px] font-medium text-ink-muted sm:inline"
                    title={`${openDue.length} open deadline${openDue.length === 1 ? '' : 's'}`}
                  >
                    {openDue.length}
                  </span>
                ) : null}
              </span>

              {priorityCount > 0 ? (
                <span
                  className="mt-0.5 hidden items-center gap-0.5 px-0.5 text-[8.5px] font-medium uppercase tracking-[0.08em] text-accent/85 sm:flex"
                  title={`${priorityCount} priorit${priorityCount === 1 ? 'y' : 'ies'}`}
                >
                  <Sparkles className="h-2 w-2" strokeWidth={2} />
                  {priorityCount} priorit{priorityCount === 1 ? 'y' : 'ies'}
                </span>
              ) : null}

              <div className="mt-0.5 hidden min-w-0 space-y-0.5 sm:block">
                {entries.slice(0, 2).map((entry) => (
                  <span
                    key={entry.key}
                    className="flex min-w-0 items-center gap-1 rounded px-0.5 text-[8.5px] leading-[1.3]"
                  >
                    {entry.kind === 'task' && entry.categoryId ? (
                      <CategoryDot
                        category={getCategory(data, entry.categoryId)}
                        className="h-1 w-1"
                      />
                    ) : (
                      <span
                        className={cn(
                          'h-1 w-1 shrink-0 rounded-full',
                          entry.type === 'break'
                            ? 'bg-sage'
                            : entry.type === 'event'
                              ? 'bg-line-strong'
                              : 'bg-accent/70',
                        )}
                      />
                    )}
                    <span className="truncate text-ink-soft">{entry.title}</span>
                  </span>
                ))}
                {entries.length > 2 ? (
                  <span className="block px-0.5 text-[8px] text-ink-muted/70">
                    +{entries.length - 2} more
                  </span>
                ) : null}
              </div>

              <span className="mt-auto flex gap-0.5 px-0.5 pt-1 sm:hidden">
                {Array.from({ length: Math.min(3, entries.length) }).map((_, dotIndex) => (
                  <span
                    key={dotIndex}
                    className="h-[3px] w-[3px] rounded-full bg-accent/55"
                  />
                ))}
                {priorityCount > 0 ? (
                  <span className="h-[3px] w-[3px] rounded-full bg-gold" />
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-[9.5px] text-ink-muted">
        <span>
          {MONTH_LABELS[monthIndex]} {year} · click a day to plan it
        </span>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-accent/70" /> time block
          </span>
          <span className="hidden items-center gap-1.5 sm:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-gold" /> priority
          </span>
        </div>
      </div>
    </section>
  );
}

function WeekView({
  data,
  date,
  today,
  onOpenDay,
  onEditTask,
}: {
  data: AppData;
  date: string;
  today: string;
  onOpenDay: (key: string) => void;
  onEditTask: (taskId: string) => void;
}) {
  const days = getWeekDays(date, data.settings.weekStartsOn);
  const totalDue = days.reduce(
    (sum, key) =>
      sum +
      data.tasks.filter((task) => !task.completed && task.dueDate === key).length,
    0,
  );
  const totalBlocks = data.blocks.filter((block) => days.includes(block.date)).length;

  return (
    <section className="rounded-2xl border border-line bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/70 px-4 py-3">
        <p className="text-[12px] text-ink-soft">
          {totalDue} deadline{totalDue === 1 ? '' : 's'} · {totalBlocks} block
          {totalBlocks === 1 ? '' : 's'} this week
        </p>
        <button
          type="button"
          onClick={() => onOpenDay(date)}
          className="text-[11px] font-medium text-accent hover:text-accent-hover"
        >
          Open planner for {formatDateMedium(date)}
        </button>
      </div>
      <div className="grid grid-cols-1 divide-y divide-line/70 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-7 lg:divide-y-0">
        {days.map((key) => {
          const dayData = calendarDayData(data, key);
          const priorities = sortTasks(
            data.tasks.filter((task) => task.focusDate === key && !task.completed),
            'smart',
          );
          const unscheduled = sortTasks(
            dayData.unscheduledDueTasks.filter((task) => !task.completed),
            'smart',
          );
          const isToday = key === today;
          return (
            <article
              key={key}
              className={cn(
                'min-w-0 p-3 lg:min-h-[340px]',
                isWeekendKey(key) && 'bg-canvas/25',
                isToday && 'bg-accent-soft/20',
              )}
            >
              <button
                type="button"
                onClick={() => onOpenDay(key)}
                className="group flex w-full items-baseline justify-between gap-1 rounded-lg text-left"
              >
                <span>
                  <span className="block text-[9px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
                    {getWeekdayShort(new Date(`${key}T12:00:00`).getDay())}
                  </span>
                  <span
                    className={cn(
                      'font-display text-[24px] leading-tight tracking-[-0.03em]',
                      isToday ? 'text-accent' : 'text-ink',
                    )}
                  >
                    {Number(key.slice(8, 10))}
                  </span>
                </span>
                <span className="flex gap-0.5 pt-1">
                  {priorities.length > 0 ? (
                    <span className="h-1.5 w-1.5 rounded-full bg-gold" />
                  ) : null}
                  {dayData.blocks.length > 0 ? (
                    <span className="h-1.5 w-1.5 rounded-full bg-accent/60" />
                  ) : null}
                  {unscheduled.length > 0 ? (
                    <span className="h-1.5 w-1.5 rounded-full bg-line-strong" />
                  ) : null}
                </span>
              </button>

              <div className="mt-2 space-y-1.5">
                {priorities.length > 0 ? (
                  <div className="rounded-md bg-gold-soft/70 px-1.5 py-1">
                    <p className="text-[8.5px] font-semibold uppercase tracking-[0.08em] text-gold">
                      Priorities
                    </p>
                    {priorities.map((task) => (
                      <p
                        key={task.id}
                        className="truncate text-[10px] font-medium leading-snug text-ink-soft"
                      >
                        {task.title}
                      </p>
                    ))}
                  </div>
                ) : null}

                {dayData.blocks.slice(0, 4).map((block) => (
                  <button
                    key={block.id}
                    type="button"
                    onClick={() => onOpenDay(key)}
                    className="block w-full rounded-md border border-line/60 bg-canvas/60 px-1.5 py-1 text-left transition-colors hover:border-line-strong"
                  >
                    <span className="block truncate text-[9px] font-tabular text-ink-muted">
                      {formatTimeCompact(block.startMin, data.settings.timeFormat)} ·{' '}
                      {block.type === 'break' ? 'break' : block.type}
                    </span>
                    <span className="block truncate text-[10px] font-medium leading-snug text-ink">
                      {block.title}
                    </span>
                  </button>
                ))}
                {dayData.blocks.length > 4 ? (
                  <p className="px-1 text-[8.5px] text-ink-muted">
                    +{dayData.blocks.length - 4} more blocks
                  </p>
                ) : null}

                {unscheduled.slice(0, 4).map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => onEditTask(task.id)}
                    className="flex w-full items-center gap-1.5 rounded px-0.5 text-left"
                  >
                    <CategoryDot category={getCategory(data, task.categoryId)} />
                    <span className="truncate text-[10px] text-ink-soft">{task.title}</span>
                  </button>
                ))}
                {unscheduled.length > 4 ? (
                  <p className="px-1 text-[8.5px] text-ink-muted">
                    +{unscheduled.length - 4} more due
                  </p>
                ) : null}

                {dayData.blocks.length === 0 && unscheduled.length === 0 && priorities.length === 0 ? (
                  <p className="py-2 text-[9.5px] text-ink-muted/65">Open</p>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function DayView({
  data,
  date,
  today,
  onOpenPlanner,
  onNewTask,
}: {
  data: AppData;
  date: string;
  today: string;
  onOpenPlanner: () => void;
  onNewTask: () => void;
}) {
  const dayData = calendarDayData(data, date);
  const priorities = sortTasks(
    data.tasks.filter((task) => task.focusDate === date && !task.completed),
    'smart',
  );
  const unscheduled = sortTasks(
    dayData.unscheduledDueTasks.filter((task) => !task.completed),
    'smart',
  );
  const completed = dayData.dueTasks.filter((task) => task.completed);
  const isEmpty =
    dayData.blocks.length === 0 &&
    dayData.dueTasks.length === 0 &&
    priorities.length === 0;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_330px] xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="flex items-center justify-between gap-3 border-b border-line/70 px-4 py-3">
          <div>
            <h2 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
              The timeline
            </h2>
            <p className="mt-0.5 text-[11px] text-ink-muted">
              {dayData.blocks.length} block{dayData.blocks.length === 1 ? '' : 's'} ·{' '}
              {formatDateLong(date)}
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={onOpenPlanner}>
            Edit in planner
          </Button>
        </div>

        {isEmpty ? (
          <EmptyState
            icon={Clock3}
            title="An open day"
            description="Nothing is scheduled or due. That can be a perfectly good shape for a day."
            action={
              <>
                <Button size="sm" variant="secondary" onClick={onOpenPlanner}>
                  Plan this day
                </Button>
                <Button size="sm" variant="ghost" onClick={onNewTask}>
                  Add a task
                </Button>
              </>
            }
          />
        ) : (
          <>
            {dayData.blocks.length > 0 ? (
              <ol className="divide-y divide-line/60">
                {dayData.blocks.map((block) => {
                  const task = block.taskId
                    ? data.tasks.find((candidate) => candidate.id === block.taskId)
                    : null;
                  const category = task ? getCategory(data, task.categoryId) : null;
                  return (
                    <li key={block.id} className="flex items-start gap-3 px-4 py-3">
                      <span className="w-[86px] shrink-0 pt-0.5 font-tabular text-[10.5px] text-ink-muted">
                        {formatTimeCompact(block.startMin, data.settings.timeFormat)}–
                        {formatTimeCompact(block.endMin, data.settings.timeFormat)}
                      </span>
                      <span className="mt-[7px]">
                        {category ? (
                          <CategoryDot category={category} />
                        ) : (
                          <span
                            className={cn(
                              'block h-1.5 w-1.5 rounded-full',
                              block.type === 'break' ? 'bg-sage' : 'bg-line-strong',
                            )}
                          />
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={onOpenPlanner}
                        className="min-w-0 flex-1 text-left"
                      >
                        <span
                          className={cn(
                            'block text-[13px] font-medium leading-snug text-ink',
                            block.type === 'break' && 'italic text-sage',
                          )}
                        >
                          {block.title}
                        </span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-ink-muted">
                          {block.type === 'task' ? 'Task' : block.type === 'break' ? 'Break' : 'Event'}
                          {block.source === 'generated' ? ' · auto-planned' : ' · placed by you'}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <div className="px-4 py-8 text-center text-[12px] text-ink-muted">
                No time blocks on this day.
              </div>
            )}
            <div className="border-t border-line/70 bg-canvas/25 px-4 py-3">
              <Button size="sm" variant="ghost" className="-ml-2.5 text-ink-muted" onClick={onOpenPlanner}>
                <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                Add a block in the planner
              </Button>
            </div>
          </>
        )}
      </section>

      <aside className="space-y-4">
        <section className="rounded-2xl border border-line bg-surface px-4 py-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
              Priorities
            </h2>
            <Chip tone={priorities.length > 0 ? 'accent' : 'neutral'}>{priorities.length}/3</Chip>
          </div>
          {priorities.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {priorities.map((task, index) => (
                <li key={task.id} className="flex items-start gap-2">
                  <span className="w-4 shrink-0 font-display text-[13px] text-ink-muted/70">
                    0{index + 1}
                  </span>
                  <span className="text-[12px] font-medium leading-snug text-ink">
                    {task.title}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2.5 text-[11.5px] leading-relaxed text-ink-muted">
              No priorities set for this day.
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-line bg-surface">
          <div className="flex items-center justify-between gap-2 border-b border-line/70 px-4 py-3">
            <h2 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
              Due this day
            </h2>
            <Chip tone={unscheduled.length > 0 ? 'outline' : 'neutral'}>
              {unscheduled.length}
            </Chip>
          </div>
          {unscheduled.length > 0 ? (
            <div className="divide-y divide-line/60 px-2 py-1">
              {unscheduled.map((task) => (
                <TaskRow key={task.id} task={task} compact showDescription={false} />
              ))}
            </div>
          ) : (
            <p className="px-4 py-4 text-[11.5px] leading-relaxed text-ink-muted">
              No unscheduled deadlines. Anything due here already has a place on the timeline.
            </p>
          )}
          {completed.length > 0 ? (
            <div className="border-t border-line/70 px-4 py-3 text-[10.5px] text-ink-muted">
              {completed.length} completed deadline{completed.length === 1 ? '' : 's'} on this day
            </div>
          ) : null}
        </section>

        {date === today ? (
          <p className="px-1 font-display text-[17px] italic leading-snug text-ink-muted/85">
            Today is one day. It does not have to hold everything.
          </p>
        ) : null}
      </aside>
    </div>
  );
}
