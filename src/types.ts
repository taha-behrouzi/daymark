export type ThemePreference = 'light' | 'dark' | 'system';
export type TimeFormat = '12h' | '24h';
export type WeekStartsOn = 0 | 1 | 6;

export type TaskImportance = 'none' | 'low' | 'medium' | 'high';
export type PreferredPeriod = 'any' | 'morning' | 'afternoon' | 'evening';

export type CategoryColor =
  | 'ember'
  | 'moss'
  | 'ocean'
  | 'gold'
  | 'plum'
  | 'slate';

export interface Category {
  id: string;
  name: string;
  color: CategoryColor;
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  /** Local calendar date, `YYYY-MM-DD`. */
  dueDate: string | null;
  importance: TaskImportance;
  categoryId: string;
  completed: boolean;
  /** ISO timestamp. */
  createdAt: string;
  /** ISO timestamp. */
  completedAt: string | null;
  estimateMinutes: number;
  preferredPeriod: PreferredPeriod;
  /** Local calendar date. A task in a day's three priorities. */
  focusDate: string | null;
  /** 0, 1 or 2. */
  focusOrder: number | null;
}

export interface GoalMilestone {
  id: string;
  title: string;
  done: boolean;
}

export type GoalStatus = 'active' | 'completed' | 'archived';

export interface Goal {
  id: string;
  title: string;
  description: string;
  categoryId: string;
  /** Local calendar date, `YYYY-MM-DD`. */
  targetDate: string;
  progress: number;
  status: GoalStatus;
  milestones: GoalMilestone[];
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export type BlockType = 'task' | 'event' | 'break';
export type BlockSource = 'manual' | 'generated';

export interface ScheduleBlock {
  id: string;
  /** Local calendar date, `YYYY-MM-DD`. */
  date: string;
  /** Minutes from midnight, inclusive. */
  startMin: number;
  /** Minutes from midnight, exclusive. */
  endMin: number;
  type: BlockType;
  source: BlockSource;
  title: string;
  taskId: string | null;
  notes: string;
  createdAt: string;
}

export interface PlannerDay {
  startMin: number;
  endMin: number;
  breakMinutes: number;
  breakAfterMinutes: number;
}

export interface Settings {
  name: string;
  theme: ThemePreference;
  weekStartsOn: WeekStartsOn;
  timeFormat: TimeFormat;
  workStartMin: number;
  workEndMin: number;
  breakMinutes: number;
  breakAfterMinutes: number;
  defaultEstimateMinutes: number;
}

export interface AppData {
  version: 1;
  tasks: Task[];
  categories: Category[];
  goals: Goal[];
  blocks: ScheduleBlock[];
  plannerDays: Record<string, PlannerDay>;
  settings: Settings;
}

export interface CategoryColorStyle {
  label: string;
  dot: string;
  chip: string;
  soft: string;
  line: string;
}
