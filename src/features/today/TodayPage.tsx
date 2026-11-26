import { useMemo } from 'react';
import {
  ArrowRight,
  CalendarClock,
  Clock3,
  Plus,
  Sparkles,
  Star,
  Sun,
} from 'lucide-react';
import {
  addDays,
  dateKeyFromTimestamp,
  formatDateLong,
  formatDateMedium,
  formatDuration,
  formatTime,
  formatTimeRange,
  getGreeting,
  todayKey,
} from '../../lib/date';
import { cn } from '../../lib/cn';
import { focusTasksForDate } from '../../domain/tasks';
import {
  getCategory,
  overdueTasks,
  todayPlannedTasks,
  upcomingDeadlines,
} from '../../domain/queries';
import { useAppData } from '../../store/AppStoreProvider';
import { useAppDialogs } from '../../store/AppDialogsProvider';
import { useRouter } from '../../store/RouterProvider';
import { PageHeader, SectionHeading } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { ProgressBar } from '../../components/ui/Progress';
import { EmptyState } from '../../components/ui/EmptyState';
import { CategoryDot, Chip } from '../../components/ui/Meta';
import { TaskRow } from '../tasks/TaskRow';
import { QuickAdd } from '../tasks/QuickAdd';
import { PriorityPanel } from './PriorityPanel';
import { blocksForDate, getPlannerDay } from '../../domain/planner';

export function TodayPage() {
  const data = useAppData();
  const { openTaskEditor } = useAppDialogs();
  const { navigate } = useRouter();
  const today = todayKey();
  const greeting = getGreeting();
  const displayName = data.settings.name.trim();

  const focus = focusTasksForDate(data, today);
  const planned = useMemo(() => todayPlannedTasks(data, today), [data, today]);
  const focusIds = new Set(focus.map((task) => task.id));
  const otherOpen = planned
    .filter((task) => !task.completed && !focusIds.has(task.id))
    .sort((a, b) => {
      if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) {
        return a.dueDate.localeCompare(b.dueDate);
      }
      return 0;
    });
  const completedPlanned = planned.filter((task) => task.completed);
  const completedToday = data.tasks
    .filter(
      (task) =>
        task.completed &&
        !focusIds.has(task.id) &&
        dateKeyFromTimestamp(task.completedAt) === today,
    )
    .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''));
  const plannedCount = planned.length;
  const scheduled = blocksForDate(data, today);
  const plannerDay = getPlannerDay(data, today);
  const upcoming = upcomingDeadlines(data, today, 7, true).slice(0, 5);
  const overdue = overdueTasks(data, today);
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  const nextBlock = scheduled.find((block) => block.endMin > nowMinutes);
  const focusDone = focus.filter((task) => task.completed).length;
  const progress = plannedCount > 0 ? Math.round((completedPlanned.length / plannedCount) * 100) : 0;
  const taskMinutes = scheduled
    .filter((block) => block.type === 'task')
    .reduce((total, block) => total + (block.endMin - block.startMin), 0);
  const isEmpty = data.tasks.length === 0 && data.goals.length === 0;

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow={formatDateLong(today)}
        title={
          <>
            {greeting}
            {displayName ? `, ${displayName}` : ''}.
          </>
        }
        description={
          isEmpty
            ? 'Daymark is a quiet place to decide what matters. Start with one task, or just look around.'
            : plannedCount === 0
              ? 'Nothing is due or scheduled yet. Choose up to three priorities and let the day take shape.'
              : `${plannedCount} task${plannedCount === 1 ? '' : 's'} on today’s plate · ${focusDone} of ${focus.length} priorities complete.`
        }
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => navigate('planner', { date: today })}
            >
              <CalendarClock className="h-4 w-4" strokeWidth={1.8} />
              Open planner
            </Button>
            <Button onClick={() => openTaskEditor({ preset: { dueDate: today } })}>
              <Plus className="h-4 w-4" strokeWidth={2} />
              New task
            </Button>
          </>
        }
      />

      {isEmpty ? (
        <div className="rounded-2xl border border-line bg-surface p-2 shadow-soft">
          <EmptyState
            icon={Sun}
            title="A fresh page"
            description="Add a task, then make it one of today’s three priorities. Daymark will keep the rest out of the way until you need it."
            action={
              <>
                <Button onClick={() => openTaskEditor({ preset: { dueDate: today } })}>
                  <Plus className="h-4 w-4" strokeWidth={2} />
                  Add your first task
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => openTaskEditor({ preset: { dueDate: today, focusDate: today } })}
                >
                  <Star className="h-4 w-4" strokeWidth={1.8} />
                  Make it a priority
                </Button>
              </>
            }
          />
        </div>
      ) : (
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_310px] lg:gap-12 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-10">
            <PriorityPanel />

            <section aria-labelledby="also-today-heading">
              <SectionHeading
                title={<span id="also-today-heading">Also today</span>}
                count={otherOpen.length > 0 ? `${otherOpen.length} open` : undefined}
                description="Everything else due, scheduled, or worth noticing today."
                action={
                  <a
                    href="#/tasks"
                    className="inline-flex items-center gap-1 text-[12px] font-medium text-ink-muted transition-colors hover:text-ink"
                  >
                    All tasks
                    <ArrowRight className="h-3 w-3" strokeWidth={1.8} />
                  </a>
                }
              />

              <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_1px_1px_rgb(28_27_24/0.02)]">
                <div className="px-2 pt-2">
                  <QuickAdd dueDate={today} placeholder="Add another task for today…" />
                </div>
                {otherOpen.length > 0 ? (
                  <div className="divide-y divide-line/60 px-2 pb-2 pt-1">
                    {otherOpen.map((task) => (
                      <TaskRow key={task.id} task={task} compact />
                    ))}
                  </div>
                ) : (
                  <div className="px-5 py-6 text-center">
                    <p className="text-[12.5px] leading-relaxed text-ink-muted">
                      {focus.length > 0
                        ? 'That is the whole list. Your priorities have room to breathe.'
                        : 'No other tasks are due today. Add one above if it belongs here.'}
                    </p>
                  </div>
                )}
              </div>
            </section>

            {completedToday.length > 0 ? (
              <section aria-labelledby="completed-today-heading">
                <SectionHeading
                  title={<span id="completed-today-heading">Completed today</span>}
                  count={completedToday.length}
                  description="Small proof that the day is moving."
                />
                <div className="mt-3 divide-y divide-line/60 rounded-2xl border border-line bg-surface px-2 py-1">
                  {completedToday.map((task) => (
                    <TaskRow key={task.id} task={task} compact />
                  ))}
                </div>
              </section>
            ) : null}
          </div>

          <aside className="space-y-5">
            <section className="overflow-hidden rounded-2xl border border-line bg-surface">
              <div className="border-b border-line/70 px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
                    Today at a glance
                  </h2>
                  <Sparkles className="h-3.5 w-3.5 text-accent/70" strokeWidth={1.7} />
                </div>
                <div className="mt-4 flex items-end gap-2.5">
                  <span className="font-display text-[42px] leading-none tracking-[-0.04em] text-ink">
                    {plannedCount === 0 ? '—' : `${progress}%`}
                  </span>
                  <span className="mb-1 text-[11.5px] leading-snug text-ink-muted">
                    {plannedCount === 0
                      ? 'nothing to measure yet'
                      : `${completedPlanned.length} of ${plannedCount} tasks done`}
                  </span>
                </div>
                <ProgressBar
                  value={plannedCount === 0 ? 0 : progress}
                  label="Today’s task progress"
                  className="mt-3"
                  size="xs"
                />
              </div>

              <dl className="grid grid-cols-2 divide-x divide-line/70 border-b border-line/70">
                <div className="px-4 py-3">
                  <dt className="text-[10px] uppercase tracking-[0.12em] text-ink-muted">
                    Focus
                  </dt>
                  <dd className="mt-0.5 text-[13px] font-medium text-ink">
                    {focusDone}/{focus.length || 0} done
                  </dd>
                </div>
                <div className="px-4 py-3">
                  <dt className="text-[10px] uppercase tracking-[0.12em] text-ink-muted">
                    Planned
                  </dt>
                  <dd className="mt-0.5 text-[13px] font-medium text-ink">
                    {taskMinutes > 0 ? formatDuration(taskMinutes) : 'No blocks'}
                  </dd>
                </div>
              </dl>

              <div className="px-4 py-4">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="text-[12px] font-medium text-ink-soft">On the clock</h3>
                  <span className="text-[10px] text-ink-muted">
                    {formatTime(plannerDay.startMin, data.settings.timeFormat)}–
                    {formatTime(plannerDay.endMin, data.settings.timeFormat)}
                  </span>
                </div>
                {scheduled.length > 0 ? (
                  <ol className="mt-3 space-y-2">
                    {scheduled.slice(0, 4).map((block) => {
                      const isNow = block.startMin <= nowMinutes && block.endMin > nowMinutes;
                      return (
                        <li key={block.id} className="flex items-start gap-2.5">
                          <span
                            aria-hidden="true"
                            className={cn(
                              'mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full',
                              isNow ? 'bg-accent' : block.type === 'break' ? 'bg-sage/60' : 'bg-line-strong',
                            )}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[12px] font-medium leading-snug text-ink">
                              {block.title}
                            </p>
                            <p className="mt-0.5 text-[10.5px] text-ink-muted">
                              {formatTimeRange(block.startMin, block.endMin, data.settings.timeFormat)}
                              {isNow ? ' · now' : ''}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                ) : (
                  <p className="mt-3 text-[11.5px] leading-relaxed text-ink-muted">
                    Nothing is scheduled yet. The planner can turn priorities and deadlines into
                    a realistic day.
                  </p>
                )}
                {nextBlock ? (
                  <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-raised/70 px-2.5 py-2 text-[10.5px] text-ink-muted">
                    <Clock3 className="h-3 w-3" strokeWidth={1.8} />
                    Next: {nextBlock.title} at{' '}
                    {formatTime(nextBlock.startMin, data.settings.timeFormat)}
                  </p>
                ) : null}
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 -ml-2 text-[11.5px] text-ink-muted"
                  onClick={() => navigate('planner', { date: today })}
                >
                  Go to planner
                  <ArrowRight className="h-3 w-3" strokeWidth={1.8} />
                </Button>
              </div>
            </section>

            {overdue.length > 0 ? (
              <section className="rounded-2xl border border-danger/20 bg-danger-soft/45 p-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-danger">
                    Slipped past
                  </h2>
                  <Chip tone="danger">{overdue.length}</Chip>
                </div>
                <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-soft">
                  No guilt — just a decision. Re-date it, finish it, or let it go.
                </p>
                <ul className="mt-3 space-y-1">
                  {overdue.slice(0, 3).map((task) => (
                    <li key={task.id}>
                      <button
                        type="button"
                        onClick={() => openTaskEditor({ taskId: task.id })}
                        className="group flex w-full items-center gap-2 rounded-lg px-1 py-1.5 text-left"
                      >
                        <span className="h-1 w-1 shrink-0 rounded-full bg-danger/60" />
                        <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-ink">
                          {task.title}
                        </span>
                        <ArrowRight className="h-3 w-3 shrink-0 text-danger/60 opacity-0 transition-opacity group-hover:opacity-100" />
                      </button>
                    </li>
                  ))}
                </ul>
                {overdue.length > 3 ? (
                  <a
                    href="#/tasks"
                    className="mt-2 inline-flex text-[11px] font-medium text-danger hover:underline"
                  >
                    Review all {overdue.length} overdue
                  </a>
                ) : null}
              </section>
            ) : null}

            <section className="rounded-2xl border border-line bg-surface px-4 py-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
                  Coming up
                </h2>
                <a
                  href="#/calendar"
                  className="text-[10.5px] font-medium text-ink-muted hover:text-ink"
                >
                  Calendar
                </a>
              </div>
              {upcoming.length > 0 ? (
                <ul className="mt-3 space-y-2.5">
                  {upcoming.map(({ task, date }) => {
                    const category = getCategory(data, task.categoryId);
                    const isOverdue = date < today;
                    return (
                      <li key={task.id}>
                        <button
                          type="button"
                          onClick={() => openTaskEditor({ taskId: task.id })}
                          className="group flex w-full items-start gap-2.5 rounded-lg px-1 py-0.5 text-left"
                        >
                          <span className="mt-[7px]">
                            <CategoryDot category={category} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[12px] font-medium leading-snug text-ink">
                              {task.title}
                            </span>
                            <span
                              className={cn(
                                'mt-0.5 block text-[10.5px]',
                                isOverdue ? 'font-medium text-danger' : 'text-ink-muted',
                              )}
                            >
                              {isOverdue
                                ? 'Overdue · '
                                : ''}
                              {date === today
                                ? 'Today'
                                : date === addDays(today, 1)
                                  ? 'Tomorrow'
                                  : formatDateMedium(date)}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-3 text-[11.5px] leading-relaxed text-ink-muted">
                  No deadlines in the next week. A little breathing room.
                </p>
              )}
            </section>

            <div className="px-1">
              <p className="font-display text-[19px] italic leading-snug text-ink-muted/90">
                “Make your day clearer.
                <br />
                Make your life simpler.”
              </p>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

