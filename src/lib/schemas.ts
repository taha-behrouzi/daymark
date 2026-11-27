import { z } from 'zod';
import type {
  ThemePreference,
  TimeFormat,
  TaskImportance,
  PreferredPeriod,
  CategoryColor,
  GoalStatus,
  BlockType,
  BlockSource,
} from '../types';

// ============================================================================
// Primitive validators
// ============================================================================

const DateKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date key (YYYY-MM-DD)').refine(
  (key) => {
    const [year, month, day] = key.split('-').map(Number);
    if (month < 1 || month > 12 || day < 1 || day > 31) return false;
    const date = new Date(year, month - 1, day, 12, 0, 0, 0);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  },
  'Invalid calendar date',
);

const IsoTimestampSchema = z.string().datetime({ offset: true });

const UidSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/, 'Invalid ID format');

const NonEmptyString = (max: number) => z.string().min(1).max(max).trim();

const OptionalString = (max: number) => z.string().max(max).trim().optional().nullable().transform((v) => v ?? '');

const PositiveMinutesSchema = z.number().int().min(5).max(480);

// ============================================================================
// Enums (kept in sync with types.ts)
// ============================================================================

export const ThemePreferenceSchema = z.enum(['light', 'dark', 'system']) satisfies z.ZodType<ThemePreference>;
export const TimeFormatSchema = z.enum(['12h', '24h']) satisfies z.ZodType<TimeFormat>;
export const WeekStartsOnSchema = z
  .enum(['0', '1', '6'])
  .transform((v) => Number(v))
  .pipe(z.number().int().min(0).max(6).refine((n): n is 0 | 1 | 6 => n === 0 || n === 1 || n === 6));
export const TaskImportanceSchema = z.enum(['none', 'low', 'medium', 'high']) satisfies z.ZodType<TaskImportance>;
export const PreferredPeriodSchema = z.enum(['any', 'morning', 'afternoon', 'evening']) satisfies z.ZodType<PreferredPeriod>;
export const CategoryColorSchema = z.enum(['ember', 'moss', 'ocean', 'gold', 'plum', 'slate']) satisfies z.ZodType<CategoryColor>;
export const GoalStatusSchema = z.enum(['active', 'completed', 'archived']) satisfies z.ZodType<GoalStatus>;
export const BlockTypeSchema = z.enum(['task', 'event', 'break']) satisfies z.ZodType<BlockType>;
export const BlockSourceSchema = z.enum(['manual', 'generated']) satisfies z.ZodType<BlockSource>;

// ============================================================================
// Domain entity schemas
// ============================================================================

export const CategorySchema = z.object({
  id: UidSchema,
  name: NonEmptyString(24),
  color: CategoryColorSchema,
  createdAt: IsoTimestampSchema,
});

export const TaskSchema = z.object({
  id: UidSchema,
  title: NonEmptyString(180),
  description: OptionalString(4000),
  dueDate: DateKeySchema.nullable(),
  importance: TaskImportanceSchema.default('none'),
  categoryId: UidSchema,
  completed: z.boolean().default(false),
  createdAt: IsoTimestampSchema,
  completedAt: IsoTimestampSchema.nullable(),
  estimateMinutes: PositiveMinutesSchema.default(30),
  preferredPeriod: PreferredPeriodSchema.default('any'),
  focusDate: DateKeySchema.nullable(),
  focusOrder: z.number().int().min(0).max(2).nullable(),
}).refine(
  (task) => task.focusDate === null || (task.focusOrder !== null && task.focusOrder >= 0 && task.focusOrder <= 2),
  { message: 'focusOrder required when focusDate is set', path: ['focusOrder'] },
).refine(
  (task) => task.focusDate !== null || task.focusOrder === null,
  { message: 'focusOrder must be null when focusDate is null', path: ['focusOrder'] },
).refine(
  (task) => !task.completed || task.completedAt !== null,
  { message: 'completedAt required when completed is true', path: ['completedAt'] },
).refine(
  (task) => task.completed || task.completedAt === null,
  { message: 'completedAt must be null when completed is false', path: ['completedAt'] },
);

export const GoalMilestoneSchema = z.object({
  id: UidSchema,
  title: NonEmptyString(160),
  done: z.boolean(),
});

export const GoalSchema = z.object({
  id: UidSchema,
  title: NonEmptyString(160),
  description: OptionalString(4000),
  categoryId: UidSchema,
  targetDate: DateKeySchema,
  progress: z.number().int().min(0).max(100),
  status: GoalStatusSchema,
  milestones: z.array(GoalMilestoneSchema).max(50),
  createdAt: IsoTimestampSchema,
  updatedAt: IsoTimestampSchema,
  completedAt: IsoTimestampSchema.nullable(),
}).refine(
  (goal) => goal.status !== 'active' || goal.completedAt === null,
  { message: 'completedAt must be null for active goals', path: ['completedAt'] },
).refine(
  (goal) => goal.status !== 'completed' || goal.completedAt !== null,
  { message: 'completedAt required for completed goals', path: ['completedAt'] },
).refine(
  (goal) => {
    const ids = new Set(goal.milestones.map((m) => m.id));
    return ids.size === goal.milestones.length;
  },
  { message: 'Duplicate milestone IDs', path: ['milestones'] },
);

export const ScheduleBlockSchema = z.object({
  id: UidSchema,
  date: DateKeySchema,
  startMin: z.number().int().min(0).max(1439),
  endMin: z.number().int().min(1).max(1440),
  type: BlockTypeSchema,
  source: BlockSourceSchema.default('manual'),
  title: NonEmptyString(180),
  taskId: UidSchema.nullable(),
  notes: OptionalString(1000),
  createdAt: IsoTimestampSchema,
}).refine((block) => block.endMin > block.startMin, {
  message: 'endMin must be greater than startMin',
  path: ['endMin'],
}).refine((block) => block.endMin - block.startMin >= 5, {
  message: 'Block must be at least 5 minutes',
  path: ['endMin'],
}).refine(
  (block) => block.type !== 'task' || block.taskId !== null,
  { message: 'taskId required for task blocks', path: ['taskId'] },
).refine(
  (block) => block.type === 'task' || block.taskId === null,
  { message: 'taskId must be null for non-task blocks', path: ['taskId'] },
);

export const PlannerDaySchema = z.object({
  startMin: z.number().int().min(0).max(1439),
  endMin: z.number().int().min(1).max(1440),
  breakMinutes: z.number().int().min(0).max(120),
  breakAfterMinutes: z.number().int().min(15).max(480),
}).refine((day) => day.endMin > day.startMin, {
  message: 'endMin must be greater than startMin',
  path: ['endMin'],
}).refine((day) => day.endMin - day.startMin >= 15, {
  message: 'Planning window must be at least 15 minutes',
  path: ['endMin'],
});

export const SettingsSchema = z.object({
  name: OptionalString(60),
  theme: ThemePreferenceSchema.default('light'),
  weekStartsOn: WeekStartsOnSchema.default(1),
  timeFormat: TimeFormatSchema.default('24h'),
  workStartMin: z.number().int().min(0).max(1439).default(480),
  workEndMin: z.number().int().min(1).max(1440).default(1080),
  breakMinutes: z.number().int().min(0).max(120).default(10),
  breakAfterMinutes: z.number().int().min(15).max(480).default(90),
  defaultEstimateMinutes: PositiveMinutesSchema.default(30),
}).refine((s) => s.workEndMin > s.workStartMin, {
  message: 'workEndMin must be greater than workStartMin',
  path: ['workEndMin'],
}).refine((s) => s.workEndMin - s.workStartMin >= 15, {
  message: 'Work window must be at least 15 minutes',
  path: ['workEndMin'],
});

// ============================================================================
// AppData schema (root)
// ============================================================================

export const AppDataSchema = z.object({
  version: z.literal(1),
  tasks: z.array(TaskSchema).max(5000),
  categories: z.array(CategorySchema).min(1).max(50),
  goals: z.array(GoalSchema).max(1000),
  blocks: z.array(ScheduleBlockSchema).max(10000),
  plannerDays: z.record(DateKeySchema, PlannerDaySchema),
  settings: SettingsSchema,
}).refine(
  (data) => {
    const categoryIds = new Set(data.categories.map((c) => c.id));
    return data.tasks.every((t) => categoryIds.has(t.categoryId));
  },
  { message: 'Task references non-existent category', path: ['tasks'] },
).refine(
  (data) => {
    const categoryIds = new Set(data.categories.map((c) => c.id));
    return data.goals.every((g) => categoryIds.has(g.categoryId));
  },
  { message: 'Goal references non-existent category', path: ['goals'] },
).refine(
  (data) => {
    const taskIds = new Set(data.tasks.map((t) => t.id));
    return data.blocks.filter((b) => b.type === 'task').every((b) => taskIds.has(b.taskId!));
  },
  { message: 'Block references non-existent task', path: ['blocks'] },
).refine(
  (data) => {
    const seen = new Set<string>();
    for (const block of data.blocks) {
      if (block.type === 'task' && block.taskId) {
        const key = `${block.taskId}:${block.date}`;
        if (seen.has(key)) return false;
        seen.add(key);
      }
    }
    return true;
  },
  { message: 'Duplicate task scheduling on same day', path: ['blocks'] },
).refine(
  (data) => {
    const focusSlots = new Map<string, Map<number, string>>();
    for (const task of data.tasks) {
      if (task.focusDate !== null && task.focusOrder !== null) {
        const slots = focusSlots.get(task.focusDate) ?? new Map();
        if (slots.size >= 3) return false;
        if (slots.has(task.focusOrder)) return false;
        slots.set(task.focusOrder, task.id);
        focusSlots.set(task.focusDate, slots);
      }
    }
    return true;
  },
  { message: 'Invalid focus order (max 3 per day, no duplicates)', path: ['tasks'] },
).refine(
  (data) => data.categories.some((c) => c.id === 'cat-other'),
  { message: 'Missing required "Other" category', path: ['categories'] },
).refine(
  (data) => {
    const names = new Set(data.categories.map((c) => c.name.toLocaleLowerCase()));
    return names.size === data.categories.length;
  },
  { message: 'Duplicate category names (case-insensitive)', path: ['categories'] },
);

// ============================================================================
// Inferred types (single source of truth)
// ============================================================================

export type Category = z.infer<typeof CategorySchema>;
export type Task = z.infer<typeof TaskSchema>;
export type GoalMilestone = z.infer<typeof GoalMilestoneSchema>;
export type Goal = z.infer<typeof GoalSchema>;
export type ScheduleBlock = z.infer<typeof ScheduleBlockSchema>;
export type PlannerDay = z.infer<typeof PlannerDaySchema>;
export type Settings = z.infer<typeof SettingsSchema>;
export type AppData = z.infer<typeof AppDataSchema>;

// ============================================================================
// Validation helpers
// ============================================================================

export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly issues: z.ZodIssue[],
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function validateAppData(input: unknown): AppData {
  const result = AppDataSchema.safeParse(input);
  if (!result.success) {
    throw new ValidationError('Invalid AppData', result.error.issues);
  }
  return result.data;
}

export function validatePartialAppData(input: unknown): Partial<AppData> {
  const result = AppDataSchema.partial().safeParse(input);
  if (!result.success) {
    throw new ValidationError('Invalid partial AppData', result.error.issues);
  }
  return result.data;
}

// ============================================================================
// Import/Export wrapper schema
// ============================================================================

export const ExportWrapperSchema = z.object({
  app: z.literal('daymark'),
  version: z.literal(1),
  exportedAt: IsoTimestampSchema,
  data: AppDataSchema,
});

export type ExportWrapper = z.infer<typeof ExportWrapperSchema>;

export function createExportWrapper(data: AppData): ExportWrapper {
  return {
    app: 'daymark',
    version: 1,
    exportedAt: new Date().toISOString(),
    data,
  };
}

export function parseImportWrapper(text: string): { data: AppData; exportedAt: string | null } {
  if (!text.trim()) throw new ValidationError('Empty import file', []);
  if (text.length > 5_000_000) throw new ValidationError('File too large (max 5 MB)', []);

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ValidationError('Invalid JSON', []);
  }

  const result = ExportWrapperSchema.safeParse(parsed);
  if (!result.success) {
    // Try raw AppData (backwards compat)
    const rawResult = AppDataSchema.safeParse(parsed);
    if (!rawResult.success) {
      throw new ValidationError('Not a valid Daymark export', result.error.issues);
    }
    return { data: rawResult.data, exportedAt: null };
  }

  return { data: result.data.data, exportedAt: result.data.exportedAt };
}