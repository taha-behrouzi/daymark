import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarClock, CheckCircle2, FilterX, Plus, Search } from 'lucide-react';
import { cn } from '../../lib/cn';
import { dateKeyFromTimestamp, formatFriendlyDate, todayKey } from '../../lib/date';
import { sortTasks, type TaskSort } from '../../domain/queries';
import { useAppData } from '../../store/AppStoreProvider';
import { useAppDialogs } from '../../store/AppDialogsProvider';
import { useRouter } from '../../store/RouterProvider';
import { PageHeader, SectionHeading } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { Input, Select } from '../../components/ui/Field';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { TaskRow } from '../tasks/TaskRow';
import type { Task } from '../../types';

type StatusFilter = 'open' | 'completed' | 'all';

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'completed', label: 'Completed' },
  { value: 'all', label: 'All' },
];

const SORT_OPTIONS: { value: TaskSort; label: string }[] = [
  { value: 'smart', label: 'Smart order' },
  { value: 'due', label: 'Due date' },
  { value: 'importance', label: 'Importance' },
  { value: 'created', label: 'Recently added' },
  { value: 'title', label: 'Title' },
];

interface TaskGroup {
  key: string;
  title: string;
  description?: string;
  tone?: 'danger';
  tasks: Task[];
}

export function TasksPage() {
  const data = useAppData();
  const { openTaskEditor } = useAppDialogs();
  const { navigate } = useRouter();
  const today = todayKey();
  const searchRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('open');
  const [categoryId, setCategoryId] = useState('all');
  const [sort, setSort] = useState<TaskSort>('smart');

  const openCount = data.tasks.filter((task) => !task.completed).length;
  const completedCount = data.tasks.filter((task) => task.completed).length;
  const hasFilters = search.trim() !== '' || categoryId !== 'all' || status !== 'open';

  useEffect(() => {
    const handleSearchShortcut = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (document.querySelector('dialog[open]')) return;
      event.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener('keydown', handleSearchShortcut);
    return () => window.removeEventListener('keydown', handleSearchShortcut);
  }, []);

  const groups = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    const filtered = data.tasks.filter((task) => {
      if (status === 'open' && task.completed) return false;
      if (status === 'completed' && !task.completed) return false;
      if (categoryId !== 'all' && task.categoryId !== categoryId) return false;
      if (!query) return true;
      return (
        task.title.toLocaleLowerCase().includes(query) ||
        task.description.toLocaleLowerCase().includes(query)
      );
    });

    if (status === 'completed') {
      const completed = sortTasks(
        filtered.filter((task) => task.completed),
        'created',
      ).sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''));
      return [
        {
          key: 'completed',
          title: 'Completed',
          description: 'Finished work stays here until you delete it.',
          tasks: completed,
        },
      ];
    }

    const open = filtered.filter((task) => !task.completed);
    const nextWeek = new Date(`${today}T12:00:00`);
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextWeekKey = `${nextWeek.getFullYear()}-${String(nextWeek.getMonth() + 1).padStart(
      2,
      '0',
    )}-${String(nextWeek.getDate()).padStart(2, '0')}`;

    const bucket = {
      overdue: [] as Task[],
      today: [] as Task[],
      soon: [] as Task[],
      later: [] as Task[],
      none: [] as Task[],
    };
    for (const task of open) {
      if (!task.dueDate) bucket.none.push(task);
      else if (task.dueDate < today) bucket.overdue.push(task);
      else if (task.dueDate === today) bucket.today.push(task);
      else if (task.dueDate < nextWeekKey) bucket.soon.push(task);
      else bucket.later.push(task);
    }

    const result: TaskGroup[] = [
      {
        key: 'overdue',
        title: 'Overdue',
        description: 'Not a failure — just a decision waiting to be made.',
        tone: 'danger',
        tasks: sortTasks(bucket.overdue, sort),
      },
      {
        key: 'today',
        title: 'Today',
        tasks: sortTasks(bucket.today, sort),
      },
      {
        key: 'soon',
        title: 'Next seven days',
        tasks: sortTasks(bucket.soon, sort),
      },
      {
        key: 'later',
        title: 'Later',
        tasks: sortTasks(bucket.later, sort),
      },
      {
        key: 'none',
        title: 'No due date',
        description: 'Someday tasks are allowed. They simply wait their turn.',
        tasks: sortTasks(bucket.none, sort),
      },
    ];

    if (status === 'all') {
      const completed = sortTasks(
        filtered.filter((task) => task.completed),
        'created',
      ).sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''));
      result.push({
        key: 'completed',
        title: 'Completed',
        tasks: completed,
      });
    }

    return result.filter((group) => group.tasks.length > 0);
  }, [categoryId, data.tasks, search, sort, status, today]);

  const matchingCount = groups.reduce((total, group) => total + group.tasks.length, 0);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Everything, in one place"
        title="Tasks"
        description={
          openCount === 0 && completedCount === 0
            ? 'A clear list of what needs doing, grouped by when it matters.'
            : `${openCount} open task${openCount === 1 ? '' : 's'}${
                completedCount > 0
                  ? ` · ${completedCount} completed`
                  : ''
              }. Grouped by when it matters, not by urgency theatre.`
        }
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => navigate('planner', { date: today })}
            >
              <CalendarClock className="h-4 w-4" strokeWidth={1.8} />
              Plan today
            </Button>
            <Button onClick={() => openTaskEditor({ preset: { dueDate: null } })}>
              <Plus className="h-4 w-4" strokeWidth={2} />
              New task
            </Button>
          </>
        }
      />

      <section className="rounded-2xl border border-line bg-surface shadow-[0_1px_1px_rgb(28_27_24/0.02)]">
        <div className="flex flex-col gap-3 border-b border-line/70 p-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted"
              strokeWidth={1.8}
            />
            <Input
              ref={searchRef}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search tasks…"
              aria-label="Search tasks"
              className="h-9 pl-9 pr-16"
            />
            <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-line/80 bg-raised px-1.5 font-sans text-[9px] text-ink-muted">
              /
            </kbd>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <SegmentedControl
              label="Task status"
              value={status}
              onChange={setStatus}
              options={STATUS_OPTIONS}
              size="sm"
            />
            <Select
              aria-label="Filter by category"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              wrapperClassName="w-[140px]"
              className="h-8 rounded-full pl-3 text-[11.5px]"
            >
              <option value="all">All categories</option>
              {data.categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Sort tasks"
              value={sort}
              onChange={(event) => setSort(event.target.value as TaskSort)}
              wrapperClassName="w-[136px]"
              className="h-8 rounded-full pl-3 text-[11.5px]"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            {hasFilters ? (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setStatus('open');
                  setCategoryId('all');
                  setSort('smart');
                }}
                className="pressable inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-[11.5px] font-medium text-ink-muted hover:bg-raised hover:text-ink"
              >
                <FilterX className="h-3 w-3" strokeWidth={1.8} />
                Reset
              </button>
            ) : null}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 px-4 py-2.5 text-[10.5px] text-ink-muted">
          <span>
            {matchingCount} task{matchingCount === 1 ? '' : 's'}
            {search.trim() ? ` matching “${search.trim()}”` : ''}
          </span>
          <span className="hidden sm:inline">
            {sort === 'smart' ? 'Priorities rise, then deadlines' : `Sorted by ${SORT_OPTIONS.find((option) => option.value === sort)?.label.toLowerCase()}`}
          </span>
        </div>
      </section>

      {groups.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface">
          <EmptyState
            icon={status === 'completed' ? CheckCircle2 : Search}
            title={
              search.trim()
                ? 'No tasks match'
                : status === 'completed'
                  ? 'Nothing completed yet'
                  : 'Your list is clear'
            }
            description={
              search.trim() || hasFilters
                ? 'Try a different search or loosen the filters. Nothing has been hidden from your data.'
                : 'Add a task when something needs doing. It does not need a deadline to deserve a place.'
            }
            action={
              hasFilters ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setSearch('');
                    setStatus('open');
                    setCategoryId('all');
                  }}
                >
                  Clear filters
                </Button>
              ) : (
                <Button size="sm" onClick={() => openTaskEditor({ preset: { dueDate: null } })}>
                  <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                  Add a task
                </Button>
              )
            }
          />
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <section key={group.key} aria-labelledby={`task-group-${group.key}`}>
              <SectionHeading
                title={
                  <span
                    id={`task-group-${group.key}`}
                    className={cn(group.tone === 'danger' && 'text-danger')}
                  >
                    {group.title}
                  </span>
                }
                count={group.tasks.length}
                description={group.description}
              />
              <div className="mt-2.5 divide-y divide-line/60 rounded-2xl border border-line bg-surface px-2 py-1">
                {group.tasks.map((task) => (
                  <div key={task.id} className="relative">
                    <TaskRow task={task} compact />
                    {group.key === 'completed' && task.completedAt ? (
                      <p className="pointer-events-none absolute bottom-3 right-12 hidden text-[10px] text-ink-muted/80 sm:block">
                        {formatFriendlyDate(
                          dateKeyFromTimestamp(task.completedAt) ?? today,
                          today,
                        )}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
