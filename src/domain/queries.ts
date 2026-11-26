import { addDays, compareDateKeys, dateKeyFromTimestamp, isValidDateKey } from '../lib/date';
import type { AppData, Category, ScheduleBlock, Task } from '../types';

export type TaskSort = 'smart' | 'due' | 'importance' | 'created' | 'title';

const IMPORTANCE_RANK: Record<Task['importance'], number> = {
  high: 0,
  medium: 1,
  low: 2,
  none: 3,
};

export function getCategory(data: AppData, categoryId: string): Category {
  return (
    data.categories.find((category) => category.id === categoryId) ??
    data.categories[data.categories.length - 1]
  );
}

export function openTasks(data: AppData): Task[] {
  return data.tasks.filter((task) => !task.completed);
}

export function tasksDueOn(data: AppData, date: string): Task[] {
  return data.tasks.filter((task) => task.dueDate === date);
}

export function focusTasks(data: AppData, date: string): Task[] {
  return data.tasks
    .filter((task) => task.focusDate === date && task.focusOrder !== null)
    .sort((a, b) => (a.focusOrder ?? 0) - (b.focusOrder ?? 0));
}

export function scheduledTaskIdsOn(data: AppData, date: string): Set<string> {
  return new Set(
    data.blocks
      .filter((block) => block.date === date && block.type === 'task' && block.taskId)
      .map((block) => block.taskId as string),
  );
}

/**
 * The tasks that count toward today: due today, chosen as a priority, or
 * deliberately scheduled today. No hidden calculations.
 */
export function todayPlannedTasks(data: AppData, date: string): Task[] {
  const scheduledIds = scheduledTaskIdsOn(data, date);
  return data.tasks.filter(
    (task) =>
      task.dueDate === date ||
      task.focusDate === date ||
      scheduledIds.has(task.id),
  );
}

export function completedOn(tasks: Task[], date: string): Task[] {
  return tasks.filter((task) => dateKeyFromTimestamp(task.completedAt) === date);
}

export function overdueTasks(data: AppData, today: string): Task[] {
  return data.tasks
    .filter((task) => !task.completed && task.dueDate !== null && task.dueDate < today)
    .sort((a, b) => compareDateKeys(a.dueDate ?? '', b.dueDate ?? ''));
}

export interface UpcomingDeadline {
  task: Task;
  date: string;
}

export function upcomingDeadlines(
  data: AppData,
  fromDate: string,
  days = 7,
  includeOverdue = false,
): UpcomingDeadline[] {
  const end = addDays(fromDate, days);
  return data.tasks
    .filter(
      (task) =>
        !task.completed &&
        task.dueDate !== null &&
        (includeOverdue ? task.dueDate <= end : task.dueDate > fromDate && task.dueDate <= end),
    )
    .sort((a, b) => {
      const dateCompare = compareDateKeys(a.dueDate ?? '', b.dueDate ?? '');
      if (dateCompare !== 0) return dateCompare;
      return IMPORTANCE_RANK[a.importance] - IMPORTANCE_RANK[b.importance];
    })
    .map((task) => ({ task, date: task.dueDate as string }));
}

export function sortTasks(tasks: Task[], sort: TaskSort): Task[] {
  const copy = [...tasks];
  if (sort === 'title') {
    copy.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
    return copy;
  }
  if (sort === 'created') {
    copy.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return copy;
  }
  if (sort === 'importance') {
    copy.sort(
      (a, b) =>
        Number(a.completed) - Number(b.completed) ||
        IMPORTANCE_RANK[a.importance] - IMPORTANCE_RANK[b.importance] ||
        compareDateKeys(a.dueDate ?? '9999-99-99', b.dueDate ?? '9999-99-99'),
    );
    return copy;
  }
  if (sort === 'due') {
    copy.sort(
      (a, b) =>
        Number(a.completed) - Number(b.completed) ||
        compareDateKeys(a.dueDate ?? '9999-99-99', b.dueDate ?? '9999-99-99') ||
        IMPORTANCE_RANK[a.importance] - IMPORTANCE_RANK[b.importance],
    );
    return copy;
  }
  copy.sort(
    (a, b) =>
      Number(a.completed) - Number(b.completed) ||
      Number(a.dueDate === null) - Number(b.dueDate === null) ||
      compareDateKeys(a.dueDate ?? '9999-99-99', b.dueDate ?? '9999-99-99') ||
      IMPORTANCE_RANK[a.importance] - IMPORTANCE_RANK[b.importance] ||
      (a.createdAt < b.createdAt ? 1 : -1),
  );
  return copy;
}

export function isTaskOverdue(task: Task, today: string): boolean {
  return !task.completed && task.dueDate !== null && task.dueDate < today;
}

export function blockTask(data: AppData, block: ScheduleBlock): Task | null {
  if (!block.taskId) return null;
  return data.tasks.find((task) => task.id === block.taskId) ?? null;
}

export function isValidPlannerDate(date: string): boolean {
  return isValidDateKey(date);
}

export interface CalendarDayData {
  blocks: ScheduleBlock[];
  dueTasks: Task[];
  unscheduledDueTasks: Task[];
}

/**
 * Calendar entries are derived, not duplicated. A task appears as a scheduled
 * block when it is on the timeline; only unscheduled deadlines appear separately.
 */
export function calendarDayData(data: AppData, date: string): CalendarDayData {
  const blocks = data.blocks
    .filter((block) => block.date === date)
    .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
  const dueTasks = data.tasks
    .filter((task) => task.dueDate === date)
    .sort((a, b) => Number(a.completed) - Number(b.completed));
  const scheduledTaskIds = new Set(
    blocks
      .filter((block) => block.type === 'task' && block.taskId)
      .map((block) => block.taskId as string),
  );
  return {
    blocks,
    dueTasks,
    unscheduledDueTasks: dueTasks.filter((task) => !scheduledTaskIds.has(task.id)),
  };
}

export function weekCompletionDates(tasks: Task[]): string[] {
  return tasks
    .map((task) => dateKeyFromTimestamp(task.completedAt))
    .filter((key): key is string => key !== null);
}
