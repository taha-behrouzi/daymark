import { isValidDateKey } from '../lib/date';
import { uid } from '../lib/id';
import type {
  AppData,
  PreferredPeriod,
  Task,
  TaskImportance,
} from '../types';
import { DomainError } from './errors';

export interface NewTaskInput {
  title: string;
  description?: string;
  dueDate?: string | null;
  importance?: TaskImportance;
  categoryId: string;
  estimateMinutes?: number;
  preferredPeriod?: PreferredPeriod;
  /** When set, the task is also made a priority for that day. */
  focusDate?: string | null;
}

export interface TaskPatch {
  title?: string;
  description?: string;
  dueDate?: string | null;
  importance?: TaskImportance;
  categoryId?: string;
  estimateMinutes?: number;
  preferredPeriod?: PreferredPeriod;
}

const MAX_TITLE = 180;
const MAX_DESCRIPTION = 4000;
const VALID_IMPORTANCE: readonly TaskImportance[] = ['none', 'low', 'medium', 'high'];
const VALID_PERIODS: readonly PreferredPeriod[] = ['any', 'morning', 'afternoon', 'evening'];

function normalizeTitle(value: string): string {
  const title = value.trim();
  if (!title) throw new DomainError('Give the task a title.');
  if (title.length > MAX_TITLE) {
    throw new DomainError(`Task titles can be at most ${MAX_TITLE} characters.`);
  }
  return title;
}

function normalizeDescription(value: string | undefined): string {
  if (value === undefined) return '';
  const description = value.trim();
  if (description.length > MAX_DESCRIPTION) {
    throw new DomainError(`Descriptions can be at most ${MAX_DESCRIPTION} characters.`);
  }
  return description;
}

function normalizeDueDate(value: string | null | undefined): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (!isValidDateKey(value)) throw new DomainError('Choose a valid due date.');
  return value;
}

function normalizeEstimate(value: number | undefined, fallback: number): number {
  const minutes = value ?? fallback;
  if (!Number.isInteger(minutes) || minutes < 5 || minutes > 480) {
    throw new DomainError('Estimates must be between 5 minutes and 8 hours.');
  }
  return minutes;
}

function normalizeImportance(value: TaskImportance | undefined): TaskImportance {
  const importance = value ?? 'none';
  if (!VALID_IMPORTANCE.includes(importance)) {
    throw new DomainError('Choose a valid importance level.');
  }
  return importance;
}

function normalizePeriod(value: PreferredPeriod | undefined): PreferredPeriod {
  const period = value ?? 'any';
  if (!VALID_PERIODS.includes(period)) throw new DomainError('Choose a valid time of day.');
  return period;
}

function ensureCategory(data: AppData, categoryId: string): void {
  if (!data.categories.some((category) => category.id === categoryId)) {
    throw new DomainError('Choose an existing category.');
  }
}

function ensureTask(data: AppData, taskId: string): Task {
  const task = data.tasks.find((candidate) => candidate.id === taskId);
  if (!task) throw new DomainError('That task no longer exists.');
  return task;
}

export function focusTasksForDate(data: AppData, date: string): Task[] {
  return data.tasks
    .filter((task) => task.focusDate === date && task.focusOrder !== null)
    .sort((a, b) => (a.focusOrder ?? 0) - (b.focusOrder ?? 0));
}

export function nextFocusOrder(tasks: Task[], date: string): number | null {
  const used = new Set(
    tasks
      .filter((task) => task.focusDate === date && task.focusOrder !== null)
      .map((task) => task.focusOrder as number),
  );
  for (let order = 0; order < 3; order += 1) {
    if (!used.has(order)) return order;
  }
  return null;
}

function recompactFocusOrders(tasks: Task[], date: string): Task[] {
  const ordered = tasks
    .filter((task) => task.focusDate === date && task.focusOrder !== null)
    .sort((a, b) => (a.focusOrder ?? 0) - (b.focusOrder ?? 0));
  const orderById = new Map(ordered.map((task, index) => [task.id, index]));
  return tasks.map((task) => {
    if (task.focusDate !== date) return task;
    const nextOrder = orderById.get(task.id);
    return nextOrder === undefined ? task : { ...task, focusOrder: nextOrder };
  });
}

export function createTask(
  data: AppData,
  input: NewTaskInput,
  now: Date = new Date(),
): AppData {
  ensureCategory(data, input.categoryId);
  const focusDate = input.focusDate ?? null;
  if (focusDate !== null && !isValidDateKey(focusDate)) {
    throw new DomainError('Choose a valid priority date.');
  }
  const focusOrder = focusDate === null ? null : nextFocusOrder(data.tasks, focusDate);
  if (focusDate !== null && focusOrder === null) {
    throw new DomainError('You already have three priorities for that day.');
  }

  const nowIso = now.toISOString();
  const task: Task = {
    id: uid('task'),
    title: normalizeTitle(input.title),
    description: normalizeDescription(input.description),
    dueDate: normalizeDueDate(input.dueDate),
    importance: normalizeImportance(input.importance),
    categoryId: input.categoryId,
    completed: false,
    createdAt: nowIso,
    completedAt: null,
    estimateMinutes: normalizeEstimate(input.estimateMinutes, data.settings.defaultEstimateMinutes),
    preferredPeriod: normalizePeriod(input.preferredPeriod),
    focusDate,
    focusOrder,
  };

  return {
    ...data,
    tasks: [...data.tasks, task],
  };
}

export function updateTask(
  data: AppData,
  taskId: string,
  patch: TaskPatch,
): AppData {
  const existing = ensureTask(data, taskId);
  if (patch.categoryId !== undefined) ensureCategory(data, patch.categoryId);

  const nextTitle = patch.title !== undefined ? normalizeTitle(patch.title) : existing.title;
  const updated: Task = {
    ...existing,
    title: nextTitle,
    description:
      patch.description !== undefined
        ? normalizeDescription(patch.description)
        : existing.description,
    dueDate:
      patch.dueDate !== undefined ? normalizeDueDate(patch.dueDate) : existing.dueDate,
    importance:
      patch.importance !== undefined
        ? normalizeImportance(patch.importance)
        : existing.importance,
    categoryId: patch.categoryId ?? existing.categoryId,
    estimateMinutes:
      patch.estimateMinutes !== undefined
        ? normalizeEstimate(patch.estimateMinutes, data.settings.defaultEstimateMinutes)
        : existing.estimateMinutes,
    preferredPeriod:
      patch.preferredPeriod !== undefined
        ? normalizePeriod(patch.preferredPeriod)
        : existing.preferredPeriod,
  };

  const titleChanged = nextTitle !== existing.title;
  return {
    ...data,
    tasks: data.tasks.map((task) => (task.id === taskId ? updated : task)),
    blocks: titleChanged
      ? data.blocks.map((block) =>
          block.taskId === taskId ? { ...block, title: nextTitle } : block,
        )
      : data.blocks,
  };
}

export function setTaskCompletion(
  data: AppData,
  taskId: string,
  completed: boolean,
  now: Date = new Date(),
): AppData {
  const task = ensureTask(data, taskId);
  if (task.completed === completed) return data;
  const completedAt = completed ? now.toISOString() : null;
  return {
    ...data,
    tasks: data.tasks.map((candidate) =>
      candidate.id === taskId ? { ...candidate, completed, completedAt } : candidate,
    ),
  };
}

export function toggleTaskCompletion(
  data: AppData,
  taskId: string,
  now: Date = new Date(),
): AppData {
  const task = ensureTask(data, taskId);
  return setTaskCompletion(data, taskId, !task.completed, now);
}

export function deleteTask(data: AppData, taskId: string): AppData {
  const task = ensureTask(data, taskId);
  let tasks = data.tasks.filter((candidate) => candidate.id !== taskId);
  if (task.focusDate) {
    tasks = recompactFocusOrders(tasks, task.focusDate);
  }
  return {
    ...data,
    tasks,
    blocks: data.blocks.filter((block) => block.taskId !== taskId),
  };
}

export function setTaskFocus(
  data: AppData,
  taskId: string,
  date: string,
): AppData {
  if (!isValidDateKey(date)) throw new DomainError('Choose a valid priority date.');
  const task = ensureTask(data, taskId);
  if (task.completed) {
    throw new DomainError('Reopen the task before making it a priority.');
  }
  if (task.focusDate === date) return data;

  const current = focusTasksForDate(data, date);
  if (current.length >= 3) {
    throw new DomainError('You already have three priorities for this day.');
  }

  let tasks = data.tasks;
  if (task.focusDate) {
    tasks = recompactFocusOrders(
      tasks.map((candidate) =>
        candidate.id === taskId
          ? { ...candidate, focusDate: null, focusOrder: null }
          : candidate,
      ),
      task.focusDate,
    );
  }

  const order = nextFocusOrder(tasks, date);
  if (order === null) throw new DomainError('You already have three priorities for this day.');

  tasks = tasks.map((candidate) =>
    candidate.id === taskId ? { ...candidate, focusDate: date, focusOrder: order } : candidate,
  );

  return { ...data, tasks };
}

export function removeTaskFocus(data: AppData, taskId: string): AppData {
  const task = ensureTask(data, taskId);
  if (!task.focusDate) return data;
  const tasks = recompactFocusOrders(
    data.tasks.map((candidate) =>
      candidate.id === taskId
        ? { ...candidate, focusDate: null, focusOrder: null }
        : candidate,
    ),
    task.focusDate,
  );
  return { ...data, tasks };
}

export function reorderFocusTasks(
  data: AppData,
  date: string,
  orderedTaskIds: string[],
): AppData {
  const current = focusTasksForDate(data, date);
  if (current.length !== orderedTaskIds.length) {
    throw new DomainError('Priority order is out of date. Please try again.');
  }
  const currentIds = new Set(current.map((task) => task.id));
  if (
    new Set(orderedTaskIds).size !== orderedTaskIds.length ||
    orderedTaskIds.some((id) => !currentIds.has(id))
  ) {
    throw new DomainError('Priority order is out of date. Please try again.');
  }
  const orderById = new Map(orderedTaskIds.map((id, index) => [id, index]));
  return {
    ...data,
    tasks: data.tasks.map((task) => {
      const order = orderById.get(task.id);
      return order === undefined || task.focusDate !== date
        ? task
        : { ...task, focusOrder: order };
    }),
  };
}

export function moveFocusTask(
  data: AppData,
  taskId: string,
  direction: -1 | 1,
): AppData {
  const task = ensureTask(data, taskId);
  if (!task.focusDate || task.focusOrder === null) return data;
  const current = focusTasksForDate(data, task.focusDate);
  const index = current.findIndex((candidate) => candidate.id === taskId);
  const target = index + direction;
  if (index === -1 || target < 0 || target >= current.length) return data;
  const reordered = [...current];
  const [moved] = reordered.splice(index, 1);
  reordered.splice(target, 0, moved);
  return reorderFocusTasks(
    data,
    task.focusDate,
    reordered.map((candidate) => candidate.id),
  );
}
