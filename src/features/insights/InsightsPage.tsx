import { useMemo, type ReactNode } from 'react';
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Flame,
  Percent,
  Plus,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import {
  formatDate,
  formatDateLong,
  formatDateWithYear,
  getWeekdayName,
  getWeekdayShort,
  todayKey,
} from '../../lib/date';
import { cn } from '../../lib/cn';
import { computeInsights } from '../../domain/insights';
import { getCategory } from '../../domain/queries';
import { useAppData } from '../../store/AppStoreProvider';
import { useAppDialogs } from '../../store/AppDialogsProvider';
import { useRouter } from '../../store/RouterProvider';
import { PageHeader, SectionHeading } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ProgressBar } from '../../components/ui/Progress';
import { CategoryBadge, Chip } from '../../components/ui/Meta';

export function InsightsPage() {
  const data = useAppData();
  const { navigate } = useRouter();
  const { openGoalEditor } = useAppDialogs();
  const { openTaskEditor } = useAppDialogs();
  const today = todayKey();
  const insights = useMemo(() => computeInsights(data, today), [data, today]);
  const hasTasks = data.tasks.length > 0;
  const last14Total = insights.activity.reduce((sum, day) => sum + day.count, 0);
  const last14Max = Math.max(1, ...insights.activity.map((day) => day.count));
  const weekDelta = insights.completedThisWeek - insights.completedLastWeek;
  const weekdayOrder = Array.from({ length: 7 }, (_, index) =>
    (data.settings.weekStartsOn + index) % 7,
  );
  const weekdayMax = Math.max(1, ...insights.weekdayActivity.map((day) => day.count));
  const topWeekdayNames = insights.topWeekdays.map((entry) => getWeekdayName(entry.weekday));

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Patterns, not pressure"
        title="Insights"
        description={
          hasTasks
            ? 'The record of what you actually finished — no scores to game, no streak guilt. Use it to notice what helps.'
            : 'Once you finish a task, this page will show the honest pattern of your days.'
        }
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate('tasks')}>
              Review tasks
            </Button>
            <Button onClick={() => navigate('planner', { date: today })}>
              <Sparkles className="h-4 w-4" strokeWidth={1.8} />
              Plan today
            </Button>
          </>
        }
      />

      {!hasTasks ? (
        <div className="rounded-2xl border border-line bg-surface shadow-soft">
          <EmptyState
            icon={BarChart3}
            title="Nothing to measure yet"
            description="Add a task and finish it when it is truly done. The first honest data point is more useful than a page of made-up averages."
            action={
              <Button onClick={() => openTaskEditor({ preset: { dueDate: today } })}>
                <Plus className="h-4 w-4" strokeWidth={2} />
                Add a task
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <section
            aria-label="Completion summary"
            className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line/80 sm:grid-cols-2 lg:grid-cols-4"
          >
            <Metric
              label="Finished this week"
              value={insights.completedThisWeek}
              detail={
                insights.completedLastWeek > 0 || insights.completedThisWeek > 0 ? (
                  <span
                    className={cn(
                      'inline-flex items-center gap-1',
                      weekDelta > 0
                        ? 'text-sage'
                        : weekDelta < 0
                          ? 'text-gold'
                          : 'text-ink-muted',
                    )}
                  >
                    {weekDelta > 0 ? (
                      <TrendingUp className="h-3 w-3" strokeWidth={2} />
                    ) : weekDelta < 0 ? (
                      <TrendingDown className="h-3 w-3" strokeWidth={2} />
                    ) : null}
                    {weekDelta === 0
                      ? `${insights.completedLastWeek} last week`
                      : `${weekDelta > 0 ? '+' : ''}${weekDelta} vs last week`}
                  </span>
                ) : (
                  'Your first week of data'
                )
              }
              icon={CheckCircle2}
              footer={`Week of ${formatDate(insights.weekStart, { month: 'short', day: 'numeric' })}`}
            />
            <Metric
              label="All-time completion"
              value={`${insights.completionRate}%`}
              detail={`${insights.completedTasks} of ${insights.totalTasks} tasks`}
              icon={Percent}
              footer="Completed vs. every task ever made"
            />
            <Metric
              label="Current streak"
              value={insights.currentStreak}
              detail={
                insights.currentStreak > 0
                  ? `day${insights.currentStreak === 1 ? '' : 's'} in a row`
                  : 'A fresh start today'
              }
              icon={Flame}
              footer="Days with at least one completed task"
            />
            <Metric
              label="Best streak"
              value={insights.bestStreak}
              detail={`${insights.completedThisMonth} finished this month`}
              icon={Sparkles}
              footer={`${insights.completedThisWeek} this week so far`}
            />
          </section>

          <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <SectionHeading
                title="The last fourteen days"
                description="Each bar is a day. Rest days are allowed and are not missing data."
              />
              <div className="text-right">
                <span className="font-display text-[30px] leading-none tracking-[-0.03em] text-ink">
                  {last14Total}
                </span>
                <p className="mt-1 text-[10.5px] text-ink-muted">task completions</p>
              </div>
            </div>

            <div className="mt-7">
              {last14Total === 0 ? (
                <div className="flex h-[170px] flex-col items-center justify-center rounded-xl border border-dashed border-line px-4 text-center">
                  <p className="text-[13px] font-medium text-ink-soft">No completions yet</p>
                  <p className="mt-1 max-w-sm text-[11.5px] leading-relaxed text-ink-muted">
                    Finish something small, wherever you are. The record starts the moment you
                    mark a task done.
                  </p>
                </div>
              ) : (
                <div className="flex h-[170px] items-end gap-1 sm:gap-2">
                  {insights.activity.map((day) => {
                    const isToday = day.date === today;
                    const heightPct = day.count === 0 ? 2 : Math.max(6, (day.count / last14Max) * 100);
                    return (
                      <div
                        key={day.date}
                        className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5"
                        title={`${formatDateLong(day.date)} · ${day.count} completed`}
                      >
                        <span
                          className={cn(
                            'text-[9px] font-tabular transition-opacity',
                            day.count > 0 ? 'text-ink-muted' : 'text-transparent',
                          )}
                        >
                          {day.count}
                        </span>
                        <div className="relative flex w-full flex-1 items-end">
                          <div
                            className={cn(
                              'w-full rounded-t-[4px] transition-colors',
                              day.count === 0
                                ? 'bg-line/80'
                                : isToday
                                  ? 'bg-accent'
                                  : 'bg-accent/55 group-hover:bg-accent/80',
                            )}
                            style={{ height: `${heightPct}%` }}
                          />
                        </div>
                        <span
                          className={cn(
                            'text-[9px] font-tabular',
                            isToday ? 'font-semibold text-accent' : 'text-ink-muted/80',
                          )}
                        >
                          {formatDate(day.date, { day: 'numeric' })}
                        </span>
                        <span className="hidden text-[8px] uppercase tracking-[0.06em] text-ink-muted/65 sm:block">
                          {formatDate(day.date, { weekday: 'short' })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line/70 pt-3 text-[10.5px] text-ink-muted">
              <span>
                Showing{' '}
                {formatDate(insights.activity[0]?.date ?? today, {
                  month: 'short',
                  day: 'numeric',
                })}{' '}
                – {formatDate(today, { month: 'short', day: 'numeric' })}
              </span>
              <span>Dates are local to this browser</span>
            </div>
          </section>

          <div className="grid gap-5 lg:grid-cols-2">
            <section className="rounded-2xl border border-line bg-surface p-5">
              <SectionHeading
                title="When you finish"
                description="All-time completions by weekday. A pattern, not a prescription."
              />
              {insights.hasCompletionData ? (
                <div className="mt-5 space-y-2.5">
                  {weekdayOrder.map((weekday) => {
                    const count = insights.weekdayActivity[weekday]?.count ?? 0;
                    const top = insights.topWeekdays.some((entry) => entry.weekday === weekday);
                    return (
                      <div key={weekday} className="flex items-center gap-3">
                        <span
                          className={cn(
                            'w-8 shrink-0 text-[10.5px] font-medium',
                            top ? 'text-ink' : 'text-ink-muted',
                          )}
                        >
                          {getWeekdayShort(weekday)}
                        </span>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-line/55">
                          <div
                            className={cn(
                              'h-full rounded-full',
                              top ? 'bg-gold' : 'bg-line-strong',
                            )}
                            style={{ width: `${Math.max(2, (count / weekdayMax) * 100)}%` }}
                          />
                        </div>
                        <span className="w-4 shrink-0 text-right text-[10px] font-tabular text-ink-muted">
                          {count}
                        </span>
                      </div>
                    );
                  })}
                  <p className="pt-2 text-[11px] leading-relaxed text-ink-muted">
                    {topWeekdayNames.length === 0
                      ? 'Finish a task to reveal a pattern.'
                      : topWeekdayNames.length === 1
                        ? `Most of your finished work lands on ${topWeekdayNames[0]}s.`
                        : `Most of your finished work lands on ${topWeekdayNames[0]}s and ${topWeekdayNames[1]}s.`}
                  </p>
                </div>
              ) : (
                <p className="mt-5 rounded-xl border border-dashed border-line px-4 py-6 text-center text-[11.5px] leading-relaxed text-ink-muted">
                  Weekday patterns appear after your first completion.
                </p>
              )}
            </section>

            <section className="rounded-2xl border border-line bg-surface p-5">
              <div className="flex items-start justify-between gap-3">
                <SectionHeading
                  title="Goals in motion"
                  description="Progress is what you say it is, not what the calendar demands."
                />
                <Chip tone={insights.activeGoals.length > 0 ? 'accent' : 'neutral'}>
                  {insights.activeGoals.length} active
                </Chip>
              </div>

              {insights.activeGoals.length > 0 ? (
                <>
                  <div className="mt-5 flex items-end gap-3">
                    <span className="font-display text-[42px] leading-none tracking-[-0.04em] text-ink">
                      {insights.averageGoalProgress}%
                    </span>
                    <span className="mb-1 text-[11px] leading-snug text-ink-muted">
                      average across
                      <br />
                      active goals
                    </span>
                  </div>
                  <ProgressBar
                    value={insights.averageGoalProgress}
                    label="Average goal progress"
                    tone="gold"
                    className="mt-3"
                    size="xs"
                  />
                  <ul className="mt-4 divide-y divide-line/60 border-t border-line/60">
                    {insights.activeGoals.slice(0, 3).map((goal) => {
                      const category = getCategory(data, goal.categoryId);
                      return (
                        <li key={goal.id}>
                          <button
                            type="button"
                            onClick={() => openGoalEditor(goal.id)}
                            className="group flex w-full items-center gap-3 py-2.5 text-left"
                          >
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[12px] font-medium text-ink">
                                {goal.title}
                              </span>
                              <span className="mt-1 flex items-center gap-1.5">
                                <CategoryBadge category={category} />
                                <span className="text-[10px] text-ink-muted">
                                  {formatDateWithYear(goal.targetDate)}
                                </span>
                              </span>
                            </span>
                            <span className="font-display text-[17px] text-ink">
                              {goal.progress}%
                            </span>
                            <ArrowRight className="h-3 w-3 text-ink-muted opacity-0 transition-opacity group-hover:opacity-100" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="mt-3 flex items-center justify-between gap-2 text-[10.5px] text-ink-muted">
                    <span>
                      {insights.completedGoalCount} goal
                      {insights.completedGoalCount === 1 ? '' : 's'} completed all time
                    </span>
                    <button
                      type="button"
                      onClick={() => navigate('goals')}
                      className="inline-flex items-center gap-1 font-medium text-ink-soft hover:text-ink"
                    >
                      All goals
                      <ArrowRight className="h-3 w-3" strokeWidth={1.8} />
                    </button>
                  </div>
                </>
              ) : (
                <div className="mt-5 rounded-xl border border-dashed border-line px-4 py-7 text-center">
                  <Target className="mx-auto h-5 w-5 text-ink-muted" strokeWidth={1.6} />
                  <p className="mt-2 text-[12px] font-medium text-ink-soft">No active goals</p>
                  <p className="mx-auto mt-1 max-w-[260px] text-[11px] leading-relaxed text-ink-muted">
                    Direction helps the daily list mean something. A goal can start small.
                  </p>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="mt-3"
                    onClick={() => openGoalEditor()}
                  >
                    <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                    Set a goal
                  </Button>
                </div>
              )}
            </section>
          </div>

          <p className="px-1 text-[10.5px] leading-relaxed text-ink-muted/80">
            Streaks count consecutive local calendar days with at least one completed task.
            Completing the same task twice is not possible, so the numbers reflect real tasks.
          </p>
        </>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  detail,
  icon: Icon,
  footer,
}: {
  label: string;
  value: string | number;
  detail: ReactNode;
  icon: typeof CheckCircle2;
  footer: string;
}) {
  return (
    <div className="bg-surface px-5 py-5">
      <div className="flex items-center gap-2 text-ink-muted">
        <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.13em]">{label}</span>
      </div>
      <p className="mt-3 font-display text-[36px] leading-none tracking-[-0.04em] text-ink">
        {value}
      </p>
      <p className="mt-1.5 text-[11px] leading-relaxed text-ink-muted">{detail}</p>
      <p className="mt-3 border-t border-line/70 pt-2 text-[9.5px] text-ink-muted/75">{footer}</p>
    </div>
  );
}
