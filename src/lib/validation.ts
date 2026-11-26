import {
  CATEGORY_COLORS,
  CATEGORY_OTHER_ID,
} from '../constants';
import type {
  AppData,
  BlockSource,
  BlockType,
  Category,
  CategoryColor,
  Goal,
  GoalMilestone,
  GoalStatus,
  PlannerDay,
  PreferredPeriod,
  ScheduleBlock,
  Settings,
  Task,
  TaskImportance,
  ThemePreference,
  TimeFormat,
  WeekStartsOn,
} from '../types';
import { isValidDateKey } from '../lib/date';

const MAX_TASKS = 5000;
const MAX_GOALS = 1000;
const MAX_BLOCKS = 10000;
const MAX_CATEGORIES = 50;
const MAX_PLANNER_DAYS = 5000;
const MAX_IMPORT_BYTES = 5_000_000;

export class DataValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DataValidationError';
  }
}

function invalid(path: string, message: string): never {
  throw new DataValidationError(`${path} ${message}`);
}

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown, path: string): UnknownRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    invalid(path, 'must be an object.');
  }
  return value as UnknownRecord;
}

function asArray(value: unknown, path: string, max: number, required = true): unknown[] {
  if (value === undefined && !required) return [];
  if (!Array.isArray(value)) invalid(path, 'must be a list.');
  if (value.length > max) invalid(path, `contains too many entries (maximum ${max}).`);
  return value;
}

function requiredString(
  record: UnknownRecord,
  key: string,
  path: string,
  max: number,
): string {
  const value = record[key];
  if (value === undefined || value === null) invalid(`${path}.${key}`, 'is required.');
  if (typeof value !== 'string') invalid(`${path}.${key}`, 'must be text.');
  const trimmed = value.trim();
  if (!trimmed) invalid(`${path}.${key}`, 'cannot be empty.');
  if (trimmed.length > max) invalid(`${path}.${key}`, `is too long (maximum ${max} characters).`);
  return trimmed;
}

function optionalString(
  record: UnknownRecord,
  key: string,
  path: string,
  max: number,
  fallback = '',
): string {
  const value = record[key];
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'string') invalid(`${path}.${key}`, 'must be text.');
  if (value.length > max) invalid(`${path}.${key}`, `is too long (maximum ${max} characters).`);
  return value.trim();
}

function optionalBoolean(
  record: UnknownRecord,
  key: string,
  path: string,
  fallback = false,
): boolean {
  const value = record[key];
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'boolean') invalid(`${path}.${key}`, 'must be true or false.');
  return value;
}

function requiredBoolean(record: UnknownRecord, key: string, path: string): boolean {
  const value = record[key];
  if (typeof value !== 'boolean') invalid(`${path}.${key}`, 'must be true or false.');
  return value;
}

function requiredInteger(
  record: UnknownRecord,
  key: string,
  path: string,
  min: number,
  max: number,
): number {
  const value = record[key];
  return integerValue(value, `${path}.${key}`, min, max);
}

function optionalInteger(
  record: UnknownRecord,
  key: string,
  path: string,
  min: number,
  max: number,
  fallback: number,
): number {
  const value = record[key];
  if (value === undefined || value === null) return fallback;
  return integerValue(value, `${path}.${key}`, min, max);
}

function integerValue(value: unknown, path: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    invalid(path, 'must be a whole number.');
  }
  if (value < min || value > max) invalid(path, `must be between ${min} and ${max}.`);
  return value;
}

function enumValue<T extends string>(
  value: unknown,
  allowed: readonly T[],
  path: string,
): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    invalid(path, `must be one of: ${allowed.join(', ')}.`);
  }
  return value as T;
}

function optionalEnum<T extends string>(
  record: UnknownRecord,
  key: string,
  allowed: readonly T[],
  path: string,
  fallback: T,
): T {
  const value = record[key];
  if (value === undefined || value === null) return fallback;
  return enumValue(value, allowed, `${path}.${key}`);
}

function readId(record: UnknownRecord, key: string, path: string): string {
  const id = requiredString(record, key, path, 100);
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(id)) {
    invalid(`${path}.${key}`, 'contains unsupported characters.');
  }
  return id;
}

function readDateKey(value: unknown, path: string): string {
  if (typeof value !== 'string' || !isValidDateKey(value)) {
    invalid(path, 'must be a valid date in YYYY-MM-DD format.');
  }
  return value;
}

function optionalDateKey(
  record: UnknownRecord,
  key: string,
  path: string,
): string | null {
  const value = record[key];
  if (value === undefined || value === null) return null;
  return readDateKey(value, `${path}.${key}`);
}

function readIsoTimestamp(value: unknown, path: string): string {
  if (typeof value !== 'string') invalid(path, 'must be a valid timestamp.');
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) invalid(path, 'must be a valid timestamp.');
  return date.toISOString();
}

function requiredTimestamp(record: UnknownRecord, key: string, path: string): string {
  return readIsoTimestamp(record[key], `${path}.${key}`);
}

function optionalTimestamp(
  record: UnknownRecord,
  key: string,
  path: string,
): string | null {
  const value = record[key];
  if (value === undefined || value === null) return null;
  return readIsoTimestamp(value, `${path}.${key}`);
}

const TASK_IMPORTANCE_VALUES: readonly TaskImportance[] = [
  'none',
  'low',
  'medium',
  'high',
];
const PREFERRED_PERIOD_VALUES: readonly PreferredPeriod[] = [
  'any',
  'morning',
  'afternoon',
  'evening',
];
const GOAL_STATUS_VALUES: readonly GoalStatus[] = ['active', 'completed', 'archived'];
const BLOCK_TYPE_VALUES: readonly BlockType[] = ['task', 'event', 'break'];
const BLOCK_SOURCE_VALUES: readonly BlockSource[] = ['manual', 'generated'];
const THEME_VALUES: readonly ThemePreference[] = ['light', 'dark', 'system'];
const TIME_FORMAT_VALUES: readonly TimeFormat[] = ['12h', '24h'];
const WEEK_START_VALUES: readonly WeekStartsOn[] = [0, 1, 6];
const COLOR_VALUES = Object.keys(CATEGORY_COLORS) as CategoryColor[];

function parseCategory(input: unknown, index: number): Category {
  const path = `categories[${index}]`;
  const record = asRecord(input, path);
  return {
    id: readId(record, 'id', path),
    name: requiredString(record, 'name', path, 24),
    color: enumValue(record.color, COLOR_VALUES, `${path}.color`),
    createdAt: requiredTimestamp(record, 'createdAt', path),
  };
}

function parseTask(input: unknown, index: number): Task {
  const path = `tasks[${index}]`;
  const record = asRecord(input, path);
  const focusDate = optionalDateKey(record, 'focusDate', path);
  const rawFocusOrder = record.focusOrder;
  let focusOrder: number | null = null;

  if (focusDate === null) {
    if (rawFocusOrder !== undefined && rawFocusOrder !== null) {
      invalid(`${path}.focusOrder`, 'must be empty when the task is not a priority.');
    }
  } else {
    if (rawFocusOrder === undefined || rawFocusOrder === null) {
      invalid(`${path}.focusOrder`, 'is required for a priority task.');
    }
    focusOrder = integerValue(rawFocusOrder, `${path}.focusOrder`, 0, 2);
  }

  const completed = optionalBoolean(record, 'completed', path, false);
  const rawCompletedAt = optionalTimestamp(record, 'completedAt', path);
  if (completed && rawCompletedAt === null) {
    invalid(`${path}.completedAt`, 'is required for a completed task.');
  }
  if (!completed && rawCompletedAt !== null) {
    invalid(`${path}.completedAt`, 'must be empty for an open task.');
  }

  return {
    id: readId(record, 'id', path),
    title: requiredString(record, 'title', path, 180),
    description: optionalString(record, 'description', path, 4000),
    dueDate: optionalDateKey(record, 'dueDate', path),
    importance: optionalEnum(record, 'importance', TASK_IMPORTANCE_VALUES, path, 'none'),
    categoryId: readId(record, 'categoryId', path),
    completed,
    createdAt: requiredTimestamp(record, 'createdAt', path),
    completedAt: rawCompletedAt,
    estimateMinutes: optionalInteger(record, 'estimateMinutes', path, 5, 480, 30),
    preferredPeriod: optionalEnum(
      record,
      'preferredPeriod',
      PREFERRED_PERIOD_VALUES,
      path,
      'any',
    ),
    focusDate,
    focusOrder,
  };
}

function parseMilestone(input: unknown, index: number, goalPath: string): GoalMilestone {
  const path = `${goalPath}.milestones[${index}]`;
  const record = asRecord(input, path);
  return {
    id: readId(record, 'id', path),
    title: requiredString(record, 'title', path, 160),
    done: requiredBoolean(record, 'done', path),
  };
}

function parseGoal(input: unknown, index: number): Goal {
  const path = `goals[${index}]`;
  const record = asRecord(input, path);
  const status = enumValue(record.status, GOAL_STATUS_VALUES, `${path}.status`);
  const completedAt = optionalTimestamp(record, 'completedAt', path);
  if (status === 'active' && completedAt !== null) {
    invalid(`${path}.completedAt`, 'must be empty for an active goal.');
  }
  if (status === 'completed' && completedAt === null) {
    invalid(`${path}.completedAt`, 'is required for a completed goal.');
  }

  const milestoneInputs = asArray(record.milestones, `${path}.milestones`, 50, false);
  const milestones = milestoneInputs.map((milestone, milestoneIndex) =>
    parseMilestone(milestone, milestoneIndex, path),
  );
  const milestoneIds = new Set<string>();
  for (const milestone of milestones) {
    if (milestoneIds.has(milestone.id)) {
      invalid(`${path}.milestones`, 'contains duplicate milestone IDs.');
    }
    milestoneIds.add(milestone.id);
  }

  return {
    id: readId(record, 'id', path),
    title: requiredString(record, 'title', path, 160),
    description: optionalString(record, 'description', path, 4000),
    categoryId: readId(record, 'categoryId', path),
    targetDate: readDateKey(record.targetDate, `${path}.targetDate`),
    progress: requiredInteger(record, 'progress', path, 0, 100),
    status,
    milestones,
    createdAt: requiredTimestamp(record, 'createdAt', path),
    updatedAt: requiredTimestamp(record, 'updatedAt', path),
    completedAt,
  };
}

function parseBlock(input: unknown, index: number): ScheduleBlock {
  const path = `blocks[${index}]`;
  const record = asRecord(input, path);
  const type = enumValue(record.type, BLOCK_TYPE_VALUES, `${path}.type`);
  const source = optionalEnum(record, 'source', BLOCK_SOURCE_VALUES, path, 'manual');
  const startMin = requiredInteger(record, 'startMin', path, 0, 1439);
  const endMin = requiredInteger(record, 'endMin', path, 1, 1440);
  if (startMin >= endMin) invalid(`${path}.endMin`, 'must be later than the start time.');
  if (endMin - startMin < 5) invalid(`${path}.endMin`, 'must be at least five minutes long.');

  const rawTaskId = record.taskId;
  let taskId: string | null = null;
  if (type === 'task') {
    if (typeof rawTaskId !== 'string') invalid(`${path}.taskId`, 'is required for task blocks.');
    taskId = readId(record, 'taskId', path);
  } else if (rawTaskId !== undefined && rawTaskId !== null) {
    invalid(`${path}.taskId`, 'must be empty for events and breaks.');
  }

  return {
    id: readId(record, 'id', path),
    date: readDateKey(record.date, `${path}.date`),
    startMin,
    endMin,
    type,
    source,
    title: requiredString(record, 'title', path, 180),
    taskId,
    notes: optionalString(record, 'notes', path, 1000),
    createdAt: requiredTimestamp(record, 'createdAt', path),
  };
}

function parsePlannerDay(input: unknown, path: string): PlannerDay {
  const record = asRecord(input, path);
  const startMin = requiredInteger(record, 'startMin', path, 0, 1439);
  const endMin = requiredInteger(record, 'endMin', path, 1, 1440);
  if (startMin >= endMin) invalid(`${path}.endMin`, 'must be later than the start time.');
  if (endMin - startMin < 15) invalid(`${path}.endMin`, 'must allow at least 15 minutes.');
  return {
    startMin,
    endMin,
    breakMinutes: requiredInteger(record, 'breakMinutes', path, 0, 120),
    breakAfterMinutes: requiredInteger(record, 'breakAfterMinutes', path, 15, 480),
  };
}

function parsePlannerDays(input: unknown): Record<string, PlannerDay> {
  if (input === undefined || input === null) return {};
  const record = asRecord(input, 'plannerDays');
  const keys = Object.keys(record);
  if (keys.length > MAX_PLANNER_DAYS) {
    invalid('plannerDays', `contains too many days (maximum ${MAX_PLANNER_DAYS}).`);
  }
  const days: Record<string, PlannerDay> = {};
  for (const key of keys) {
    if (!isValidDateKey(key)) invalid(`plannerDays["${key}"]`, 'is not a valid date key.');
    days[key] = parsePlannerDay(record[key], `plannerDays["${key}"]`);
  }
  return days;
}

function parseSettings(input: unknown): Settings {
  const path = 'settings';
  const record = asRecord(input, path);
  const startMin = requiredInteger(record, 'workStartMin', path, 0, 1439);
  const endMin = requiredInteger(record, 'workEndMin', path, 1, 1440);
  if (startMin >= endMin) invalid(`${path}.workEndMin`, 'must be later than the start time.');
  if (endMin - startMin < 15) invalid(`${path}.workEndMin`, 'must allow at least 15 minutes.');
  const weekStartsOn = requiredInteger(record, 'weekStartsOn', path, 0, 6);
  if (!WEEK_START_VALUES.includes(weekStartsOn as WeekStartsOn)) {
    invalid(`${path}.weekStartsOn`, 'must be 0 (Sunday), 1 (Monday) or 6 (Saturday).');
  }

  return {
    name: optionalString(record, 'name', path, 60),
    theme: enumValue(record.theme, THEME_VALUES, `${path}.theme`),
    weekStartsOn: weekStartsOn as WeekStartsOn,
    timeFormat: enumValue(record.timeFormat, TIME_FORMAT_VALUES, `${path}.timeFormat`),
    workStartMin: startMin,
    workEndMin: endMin,
    breakMinutes: requiredInteger(record, 'breakMinutes', path, 0, 120),
    breakAfterMinutes: requiredInteger(record, 'breakAfterMinutes', path, 15, 480),
    defaultEstimateMinutes: requiredInteger(record, 'defaultEstimateMinutes', path, 5, 480),
  };
}

/** Validates and rebuilds an AppData object, dropping unknown fields. */
export function validateAppData(input: unknown): AppData {
  const record = asRecord(input, 'The data');
  if (record.version !== 1) {
    invalid('The data version', 'must be 1. This file may come from an unsupported version.');
  }

  const categoryInputs = asArray(record.categories, 'categories', MAX_CATEGORIES);
  if (categoryInputs.length === 0) invalid('categories', 'must include at least one category.');
  const categories = categoryInputs.map(parseCategory);
  const categoryIds = new Set<string>();
  const categoryNames = new Set<string>();
  for (const category of categories) {
    if (categoryIds.has(category.id)) invalid('categories', 'contains duplicate category IDs.');
    categoryIds.add(category.id);
    const normalizedName = category.name.toLocaleLowerCase();
    if (categoryNames.has(normalizedName)) {
      invalid('categories', `contains more than one category named “${category.name}”.`);
    }
    categoryNames.add(normalizedName);
  }
  if (!categoryIds.has(CATEGORY_OTHER_ID)) {
    invalid('categories', 'must include the built-in Other category.');
  }

  const taskInputs = asArray(record.tasks, 'tasks', MAX_TASKS);
  const tasks = taskInputs.map(parseTask);
  const taskIds = new Set<string>();
  const focusSlots = new Map<string, Map<number, string>>();
  for (const task of tasks) {
    if (taskIds.has(task.id)) invalid('tasks', 'contains duplicate task IDs.');
    taskIds.add(task.id);
    if (!categoryIds.has(task.categoryId)) {
      invalid(`Task “${task.title}”`, 'refers to a category that does not exist.');
    }
    if (task.focusDate !== null && task.focusOrder !== null) {
      const slots = focusSlots.get(task.focusDate) ?? new Map<number, string>();
      if (slots.size >= 3) {
        invalid(`The priorities for ${task.focusDate}`, 'cannot contain more than three tasks.');
      }
      if (slots.has(task.focusOrder)) {
        invalid(`The priorities for ${task.focusDate}`, 'contains duplicate priority positions.');
      }
      slots.set(task.focusOrder, task.id);
      focusSlots.set(task.focusDate, slots);
    }
  }

  const goalInputs = asArray(record.goals, 'goals', MAX_GOALS);
  const goals = goalInputs.map(parseGoal);
  const goalIds = new Set<string>();
  for (const goal of goals) {
    if (goalIds.has(goal.id)) invalid('goals', 'contains duplicate goal IDs.');
    goalIds.add(goal.id);
    if (!categoryIds.has(goal.categoryId)) {
      invalid(`Goal “${goal.title}”`, 'refers to a category that does not exist.');
    }
  }

  const blockInputs = asArray(record.blocks, 'blocks', MAX_BLOCKS, false);
  const blocks = blockInputs.map(parseBlock);
  const blockIds = new Set<string>();
  const scheduledTaskDays = new Set<string>();
  for (const block of blocks) {
    if (blockIds.has(block.id)) invalid('blocks', 'contains duplicate block IDs.');
    blockIds.add(block.id);
    if (block.taskId !== null) {
      if (!taskIds.has(block.taskId)) {
        invalid(`Scheduled block “${block.title}”`, 'refers to a task that does not exist.');
      }
      const occurrence = `${block.taskId}:${block.date}`;
      if (scheduledTaskDays.has(occurrence)) {
        invalid(
          `Scheduled block “${block.title}”`,
          'duplicates a task already scheduled on that day.',
        );
      }
      scheduledTaskDays.add(occurrence);
    }
  }

  const settings = parseSettings(record.settings);
  const plannerDays = parsePlannerDays(record.plannerDays);

  return {
    version: 1,
    tasks,
    categories,
    goals,
    blocks,
    plannerDays,
    settings,
  };
}

export interface ImportSummary {
  exportedAt: string | null;
  tasks: number;
  openTasks: number;
  goals: number;
  categories: number;
  blocks: number;
}

export interface ParsedImport {
  data: AppData;
  summary: ImportSummary;
}

/**
 * Accepts a Daymark export wrapper (`{ app: 'daymark', version: 1, data }`)
 * or a raw AppData object. Nothing is written until the caller confirms.
 */
export function parseImportText(text: string): ParsedImport {
  if (!text.trim()) {
    throw new DataValidationError('The selected file is empty.');
  }
  if (text.length > MAX_IMPORT_BYTES) {
    throw new DataValidationError('The selected file is too large (maximum 5 MB).');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new DataValidationError('The selected file is not valid JSON.');
  }

  const root = asRecord(parsed, 'The file');
  let dataInput: unknown = root;
  let exportedAt: string | null = null;

  if ('app' in root) {
    if (root.app !== 'daymark') {
      throw new DataValidationError('This is not a Daymark export file.');
    }
    if (root.version !== 1) {
      throw new DataValidationError('This Daymark file uses an unsupported version.');
    }
    if (!('data' in root)) {
      throw new DataValidationError('The Daymark file is missing its data.');
    }
    dataInput = root.data;
    if (typeof root.exportedAt === 'string') {
      const date = new Date(root.exportedAt);
      if (!Number.isNaN(date.getTime())) exportedAt = date.toISOString();
    }
  }

  const data = validateAppData(dataInput);
  return {
    data,
    summary: {
      exportedAt,
      tasks: data.tasks.length,
      openTasks: data.tasks.filter((task) => !task.completed).length,
      goals: data.goals.length,
      categories: data.categories.length,
      blocks: data.blocks.length,
    },
  };
}

export function createExportPayload(data: AppData): {
  app: 'daymark';
  version: 1;
  exportedAt: string;
  data: AppData;
} {
  return {
    app: 'daymark',
    version: 1,
    exportedAt: new Date().toISOString(),
    data,
  };
}
