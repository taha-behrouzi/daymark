import { useMemo, useState } from 'react';
import {
  Archive,
  ArchiveRestore,
  CalendarDays,
  CheckCircle2,
  Pencil,
  Plus,
  RotateCcw,
  Target,
} from 'lucide-react';
import { setGoalStatus, toggleGoalMilestone } from '../../domain/goals';
import { getCategory } from '../../domain/queries';
import { cn } from '../../lib/cn';
import {
  dateKeyFromTimestamp,
  diffCalendarDays,
  formatDateWithYear,
  todayKey,
} from '../../lib/date';
import { useAppData, useAppStore } from '../../store/AppStoreProvider';
import { useAppDialogs } from '../../store/AppDialogsProvider';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button, IconButton } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ProgressBar } from '../../components/ui/Progress';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { CategoryBadge, Chip } from '../../components/ui/Meta';
import { CheckButton } from '../../components/ui/CheckButton';
import { useToast } from '../../components/ui/toast';
import { useConfirm } from '../../components/ui/confirm';
import type { Goal, GoalStatus } from '../../types';

type GoalFilter = 'active' | 'completed' | 'archived';

const FILTER_OPTIONS = (counts: Record<GoalStatus, number>) => [
  { value: 'active' as const, label: `Active (${counts.active})` },
  { value: 'completed' as const, label: `Done (${counts.completed})` },
  { value: 'archived' as const, label: `Archived (${counts.archived})` },
];

const STATUS_LABELS: Record<GoalStatus, string> = {
  active: 'In progress',
  completed: 'Completed',
  archived: 'Archived',
};

export function GoalsPage() {
  const data = useAppData();
  const store = useAppStore();
  const toast = useToast();
  const confirm = useConfirm();
  const { openGoalEditor } = useAppDialogs();
  const today = todayKey();
  const [filter, setFilter] = useState<GoalFilter>('active');

  const counts = useMemo(
    () => ({
      active: data.goals.filter((goal) => goal.status === 'active').length,
      completed: data.goals.filter((goal) => goal.status === 'completed').length,
      archived: data.goals.filter((goal) => goal.status === 'archived').length,
    }),
    [data.goals],
  );

  const visibleGoals = useMemo(() => {
    const filtered = data.goals.filter((goal) => goal.status === filter);
    return filtered.sort((a, b) => {
      if (filter === 'active') return a.targetDate.localeCompare(b.targetDate);
      return (b.completedAt ?? b.updatedAt).localeCompare(a.completedAt ?? a.updatedAt);
    });
  }, [data.goals, filter]);

  const activeAverage =
    counts.active > 0
      ? Math.round(
          data.goals
            .filter((goal) => goal.status === 'active')
            .reduce((sum, goal) => sum + goal.progress, 0) / counts.active,
        )
      : 0;

  const toggleMilestone = (goal: Goal, milestoneId: string, checked: boolean) => {
    try {
      store.update((state) => toggleGoalMilestone(state, goal.id, milestoneId));
      if (checked) {
        const nextMilestones = goal.milestones.map((milestone) =>
          milestone.id === milestoneId ? { ...milestone, done: true } : milestone,
        );
        if (nextMilestones.every((milestone) => milestone.done)) {
          toast({
            title: 'Every milestone is done',
            description: 'The goal itself is still yours to close when it feels complete.',
            tone: 'success',
          });
        }
      }
    } catch (error) {
      toast({
        title: 'Could not update the milestone',
        description: error instanceof Error ? error.message : undefined,
        tone: 'error',
      });
    }
  };

  const changeStatus = async (goal: Goal, status: GoalStatus) => {
    if (status === 'completed') {
      const shouldComplete = await confirm({
        title: 'Mark this goal complete?',
        description: `“${goal.title}” will move to Completed and its progress will be recorded at 100%. You can reopen it later.`,
        confirmLabel: 'Complete goal',
      });
      if (!shouldComplete) return;
    }
    try {
      store.update((state) => setGoalStatus(state, goal.id, status));
      toast({
        title:
          status === 'completed'
            ? 'Goal completed'
            : status === 'archived'
              ? 'Goal archived'
              : 'Goal reopened',
        tone: 'success',
        action:
          status !== 'completed'
            ? undefined
            : {
                label: 'Reopen',
                onClick: () => {
                  store.update((state) => setGoalStatus(state, goal.id, 'active'));
                },
              },
      });
    } catch (error) {
      toast({
        title: 'Could not update the goal',
        description: error instanceof Error ? error.message : undefined,
        tone: 'error',
      });
    }
  };

  const isEmpty = data.goals.length === 0;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="The longer view"
        title="Goals"
        description={
          isEmpty
            ? 'Direction beyond the daily list. Name what you are moving toward, then make the next step visible.'
            : counts.active > 0
              ? `${counts.active} active goal${
                  counts.active === 1 ? '' : 's'
                } · ${activeAverage}% average progress. Goals are directions, not debts.`
              : 'No active goals right now. Reopen one, or set a new direction.'
        }
        actions={
          <Button onClick={() => openGoalEditor()}>
            <Plus className="h-4 w-4" strokeWidth={2} />
            New goal
          </Button>
        }
      />

      {isEmpty ? (
        <div className="rounded-2xl border border-line bg-surface shadow-soft">
          <EmptyState
            icon={Target}
            title="What are you moving toward?"
            description="A goal can be small: finish a course, run a little further, save for something. Milestones turn it into honest next steps."
            action={
              <Button onClick={() => openGoalEditor()}>
                <Plus className="h-4 w-4" strokeWidth={2} />
                Set your first goal
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SegmentedControl
              label="Goal status"
              value={filter}
              onChange={setFilter}
              options={FILTER_OPTIONS(counts)}
              size="sm"
            />
            <p className="text-[11px] text-ink-muted">
              {filter === 'active'
                ? 'Closest target date first'
                : filter === 'completed'
                  ? 'Most recently finished first'
                  : 'Most recently touched first'}
            </p>
          </div>

          {visibleGoals.length === 0 ? (
            <div className="rounded-2xl border border-line bg-surface">
              <EmptyState
                compact
                icon={filter === 'active' ? Target : filter === 'completed' ? CheckCircle2 : Archive}
                title={
                  filter === 'active'
                    ? 'No active goals'
                    : filter === 'completed'
                      ? 'Nothing completed yet'
                      : 'Nothing archived'
                }
                description={
                  filter === 'active'
                    ? 'Every goal is either completed or archived. Set a new direction when something calls.'
                    : filter === 'completed'
                      ? 'Finished goals will live here, kept out of the way until you want to look back.'
                      : 'Archived goals rest here without cluttering your direction.'
                }
                action={
                  filter === 'active' ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => openGoalEditor()}
                    >
                      <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                      New goal
                    </Button>
                  ) : (
                    <Button size="sm" variant="secondary" onClick={() => setFilter('active')}>
                      View active goals
                    </Button>
                  )
                }
              />
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:gap-5">
              {visibleGoals.map((goal) => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  today={today}
                  onEdit={() => openGoalEditor(goal.id)}
                  onToggleMilestone={(milestoneId, checked) =>
                    toggleMilestone(goal, milestoneId, checked)
                  }
                  onChangeStatus={(status) => void changeStatus(goal, status)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function GoalCard({
  goal,
  today,
  onEdit,
  onToggleMilestone,
  onChangeStatus,
}: {
  goal: Goal;
  today: string;
  onEdit: () => void;
  onToggleMilestone: (milestoneId: string, checked: boolean) => void;
  onChangeStatus: (status: GoalStatus) => void;
}) {
  const data = useAppData();
  const category = getCategory(data, goal.categoryId);
  const milestonesDone = goal.milestones.filter((milestone) => milestone.done).length;
  const diff = diffCalendarDays(today, goal.targetDate);
  const isActive = goal.status === 'active';
  const isCompleted = goal.status === 'completed';
  const isArchived = goal.status === 'archived';
  const targetTone =
    isActive && diff < 0 ? 'text-danger' : isActive && diff <= 3 ? 'text-gold' : 'text-ink-muted';

  return (
    <article
      className={cn(
        'group flex flex-col rounded-2xl border border-line bg-surface p-5 transition-shadow hover:shadow-soft',
        isCompleted && 'bg-surface/80',
        isArchived && 'opacity-80',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <CategoryBadge category={category} />
          <Chip
            tone={isCompleted ? 'sage' : isArchived ? 'neutral' : 'outline'}
            title={`Goal status: ${STATUS_LABELS[goal.status]}`}
          >
            {STATUS_LABELS[goal.status]}
          </Chip>
        </div>
        <IconButton
          label={`Edit ${goal.title}`}
          size="sm"
          className="-mr-1.5 -mt-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
          onClick={onEdit}
        >
          <Pencil className="h-3.5 w-3.5" strokeWidth={1.8} />
        </IconButton>
      </div>

      <h2
        className={cn(
          'mt-3 font-display text-[23px] font-normal leading-[1.15] tracking-[-0.02em] text-ink',
          isArchived && 'text-ink-soft',
        )}
      >
        {goal.title}
      </h2>
      {goal.description ? (
        <p className="mt-1.5 line-clamp-2 text-[12.5px] leading-relaxed text-ink-muted">
          {goal.description}
        </p>
      ) : null}

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <span className={cn('inline-flex items-center gap-1.5', targetTone)}>
            <CalendarDays className="h-3 w-3" strokeWidth={1.8} />
            {isCompleted && goal.completedAt
              ? `Completed ${
                  dateKeyFromTimestamp(goal.completedAt)
                    ? formatDateWithYear(dateKeyFromTimestamp(goal.completedAt) as string)
                    : 'recently'
                }`
              : formatDateWithYear(goal.targetDate)}
          </span>
          {isActive ? (
            <span className={cn('font-medium', targetTone)}>
              {diff < 0
                ? `${Math.abs(diff)} day${Math.abs(diff) === 1 ? '' : 's'} past target`
                : diff === 0
                  ? 'Target date is today'
                  : `${diff} day${diff === 1 ? '' : 's'} to target`}
            </span>
          ) : null}
        </div>
        <span className="font-display text-[24px] leading-none tracking-[-0.03em] text-ink">
          {goal.progress}%
        </span>
      </div>

      <ProgressBar
        value={goal.progress}
        label={`${goal.title} progress`}
        tone={isCompleted ? 'sage' : isArchived ? 'ink' : 'accent'}
        className="mt-2"
        size="xs"
      />

      {goal.milestones.length > 0 ? (
        <div className="mt-4 border-t border-line/70 pt-3">
          <div className="mb-2 flex items-center justify-between gap-2 text-[10px] font-medium text-ink-muted">
            <span className="uppercase tracking-[0.13em]">Milestones</span>
            <span>
              {milestonesDone}/{goal.milestones.length}
            </span>
          </div>
          <ul className="space-y-1.5">
            {goal.milestones.slice(0, 4).map((milestone) => (
              <li key={milestone.id} className="flex items-start gap-2.5">
                <span className="mt-[1px]">
                  <CheckButton
                    size="sm"
                    checked={milestone.done}
                    disabled={!isActive}
                    label={
                      milestone.done
                        ? `Mark ${milestone.title} incomplete`
                        : `Mark ${milestone.title} complete`
                    }
                    onCheckedChange={(checked) => onToggleMilestone(milestone.id, checked)}
                  />
                </span>
                <span
                  className={cn(
                    'min-w-0 flex-1 text-[12px] leading-[1.45] text-ink-soft',
                    milestone.done && 'text-ink-muted line-through decoration-line-strong',
                  )}
                >
                  {milestone.title}
                </span>
              </li>
            ))}
          </ul>
          {goal.milestones.length > 4 ? (
            <button
              type="button"
              onClick={onEdit}
              className="mt-2 text-[10.5px] font-medium text-ink-muted hover:text-ink"
            >
              +{goal.milestones.length - 4} more milestone
              {goal.milestones.length - 4 === 1 ? '' : 's'}
            </button>
          ) : null}
        </div>
      ) : (
        <p className="mt-4 border-t border-line/70 pt-3 text-[11.5px] text-ink-muted">
          No milestones. Progress is set by hand.
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-line/70 pt-3">
        {isActive ? (
          <>
            <Button
              variant="secondary"
              size="sm"
              className="h-7 px-2.5 text-[11px]"
              onClick={() => onChangeStatus('completed')}
            >
              <CheckCircle2 className="h-3 w-3" strokeWidth={1.9} />
              Complete
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2.5 text-[11px] text-ink-muted"
              onClick={() => onChangeStatus('archived')}
            >
              <Archive className="h-3 w-3" strokeWidth={1.8} />
              Archive
            </Button>
          </>
        ) : null}
        {isCompleted ? (
          <Button
            variant="secondary"
            size="sm"
            className="h-7 px-2.5 text-[11px]"
            onClick={() => onChangeStatus('active')}
          >
            <RotateCcw className="h-3 w-3" strokeWidth={1.8} />
            Reopen
          </Button>
        ) : null}
        {isArchived ? (
          <>
            <Button
              variant="secondary"
              size="sm"
              className="h-7 px-2.5 text-[11px]"
              onClick={() => onChangeStatus('active')}
            >
              <ArchiveRestore className="h-3 w-3" strokeWidth={1.8} />
              Restore
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2.5 text-[11px] text-ink-muted"
              onClick={onEdit}
            >
              <Pencil className="h-3 w-3" strokeWidth={1.8} />
              Edit
            </Button>
          </>
        ) : null}
      </div>
    </article>
  );
}
