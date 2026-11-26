import type { PreferredPeriod, Task } from '../types';

export interface FixedScheduleBlock {
  id?: string;
  title?: string;
  startMin: number;
  endMin: number;
  taskId?: string | null;
}

export interface PlanTaskInput {
  id: string;
  title: string;
  dueDate: string | null;
  importance: Task['importance'];
  completed: boolean;
  focusDate: string | null;
  focusOrder: number | null;
  estimateMinutes: number;
  preferredPeriod: PreferredPeriod;
  createdAt: string;
}

export interface GeneratePlanOptions {
  date: string;
  dayStartMin: number;
  dayEndMin: number;
  breakMinutes: number;
  breakAfterMinutes: number;
  fixedBlocks: FixedScheduleBlock[];
}

export interface PlannedTaskBlock {
  type: 'task';
  source: 'generated';
  taskId: string;
  title: string;
  startMin: number;
  endMin: number;
}

export interface PlannedBreakBlock {
  type: 'break';
  source: 'generated';
  taskId: null;
  title: string;
  startMin: number;
  endMin: number;
}

export type PlannedBlock = PlannedTaskBlock | PlannedBreakBlock;

export interface UnscheduledTask {
  taskId: string;
  title: string;
  estimateMinutes: number;
  reason: 'no-space' | 'window-too-small';
  detail: string;
}

export interface GeneratePlanResult {
  blocks: PlannedBlock[];
  unscheduled: UnscheduledTask[];
  warnings: string[];
  scheduledMinutes: number;
  breakMinutesPlanned: number;
  freeMinutesRemaining: number;
}

interface Interval {
  startMin: number;
  endMin: number;
}

const VALID_PERIODS: readonly PreferredPeriod[] = ['any', 'morning', 'afternoon', 'evening'];
const IMPORTANCE_RANK: Record<Task['importance'], number> = {
  high: 0,
  medium: 1,
  low: 2,
  none: 3,
};

export function preferredPeriodWindow(period: PreferredPeriod): Interval | null {
  if (period === 'morning') return { startMin: 5 * 60, endMin: 12 * 60 };
  if (period === 'afternoon') return { startMin: 12 * 60, endMin: 17 * 60 };
  if (period === 'evening') return { startMin: 17 * 60, endMin: 22 * 60 };
  return null;
}

export function normalizeInterval(interval: Interval): Interval | null {
  const startMin = Math.max(0, Math.min(1440, Math.round(interval.startMin)));
  const endMin = Math.max(0, Math.min(1440, Math.round(interval.endMin)));
  if (endMin <= startMin) return null;
  return { startMin, endMin };
}

export function mergeIntervals(intervals: Interval[]): Interval[] {
  const normalized = intervals
    .map(normalizeInterval)
    .filter((interval): interval is Interval => interval !== null)
    .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
  const merged: Interval[] = [];
  for (const interval of normalized) {
    const previous = merged[merged.length - 1];
    if (!previous || interval.startMin > previous.endMin) {
      merged.push({ ...interval });
    } else {
      previous.endMin = Math.max(previous.endMin, interval.endMin);
    }
  }
  return merged;
}

/** First contiguous opening of `duration` between `from` and `limit`. */
export function findOpening(
  busyIntervals: Interval[],
  from: number,
  limit: number,
  duration: number,
): number | null {
  if (duration <= 0 || limit - from < duration) return null;
  const busy = mergeIntervals(busyIntervals);
  let cursor = Math.round(from);
  for (const interval of busy) {
    if (interval.endMin <= cursor) continue;
    if (interval.startMin >= limit) break;
    if (interval.startMin > cursor) {
      const available = Math.min(interval.startMin, limit) - cursor;
      if (available >= duration) return cursor;
    }
    cursor = Math.max(cursor, interval.endMin);
    if (cursor >= limit) return null;
  }
  return limit - cursor >= duration ? cursor : null;
}

export function getFreeGaps(
  busyIntervals: Interval[],
  window: Interval,
): Interval[] {
  const busy = mergeIntervals(busyIntervals);
  const gaps: Interval[] = [];
  let cursor = window.startMin;
  for (const interval of busy) {
    if (interval.endMin <= cursor) continue;
    if (interval.startMin >= window.endMin) break;
    if (interval.startMin > cursor) {
      gaps.push({ startMin: cursor, endMin: Math.min(interval.startMin, window.endMin) });
    }
    cursor = Math.max(cursor, interval.endMin);
    if (cursor >= window.endMin) break;
  }
  if (cursor < window.endMin) {
    gaps.push({ startMin: cursor, endMin: window.endMin });
  }
  return gaps.filter((gap) => gap.endMin > gap.startMin);
}

export function findEarliestOpening(options: {
  busy: Interval[];
  window: Interval;
  duration: number;
  preferredPeriod?: PreferredPeriod;
}): { startMin: number; respectedPreference: boolean } | null {
  const { busy, window, duration } = options;
  const period = options.preferredPeriod ?? 'any';
  const preferred = VALID_PERIODS.includes(period) ? preferredPeriodWindow(period) : null;
  if (preferred) {
    const from = Math.max(window.startMin, preferred.startMin);
    const limit = Math.min(window.endMin, preferred.endMin);
    const start = findOpening(busy, from, limit, duration);
    if (start !== null) return { startMin: start, respectedPreference: true };
  }
  const fallback = findOpening(busy, window.startMin, window.endMin, duration);
  if (fallback === null) return null;
  return { startMin: fallback, respectedPreference: preferred === null };
}

export function findOverlaps<T extends Interval>(items: T[]): Array<[T, T]> {
  const sorted = [...items].sort(
    (a, b) => a.startMin - b.startMin || a.endMin - b.endMin,
  );
  const overlaps: Array<[T, T]> = [];
  for (let index = 0; index < sorted.length; index += 1) {
    for (let inner = index + 1; inner < sorted.length; inner += 1) {
      if (sorted[inner].startMin >= sorted[index].endMin) break;
      overlaps.push([sorted[index], sorted[inner]]);
    }
  }
  return overlaps;
}

function taskDuration(task: PlanTaskInput): number {
  return Math.max(5, Math.min(480, Math.round(task.estimateMinutes)));
}

function isEligible(task: PlanTaskInput, date: string): boolean {
  if (task.completed) return false;
  const focus = task.focusDate === date && task.focusOrder !== null;
  const due = task.dueDate !== null && task.dueDate <= date;
  return focus || due;
}

export function comparePlanTasks(
  a: PlanTaskInput,
  b: PlanTaskInput,
  date: string,
): number {
  const aFocus = a.focusDate === date && a.focusOrder !== null;
  const bFocus = b.focusDate === date && b.focusOrder !== null;
  // Today's chosen priorities lead, then anything with a deadline due now.
  const aGroup = aFocus ? 0 : a.dueDate !== null && a.dueDate <= date ? 1 : 2;
  const bGroup = bFocus ? 0 : b.dueDate !== null && b.dueDate <= date ? 1 : 2;
  if (aGroup !== bGroup) return aGroup - bGroup;

  if (aFocus && bFocus) {
    const orderDiff = (a.focusOrder ?? 3) - (b.focusOrder ?? 3);
    if (orderDiff !== 0) return orderDiff;
  }

  const aDue = a.dueDate ?? '9999-99-99';
  const bDue = b.dueDate ?? '9999-99-99';
  if (aDue !== bDue) return aDue < bDue ? -1 : 1;

  const importanceDiff = IMPORTANCE_RANK[a.importance] - IMPORTANCE_RANK[b.importance];
  if (importanceDiff !== 0) return importanceDiff;

  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  return 0;
}

function freeTimeDetail(busy: Interval[], window: Interval, duration: number): string {
  const gaps = getFreeGaps(busy, window);
  const total = gaps.reduce((sum, gap) => sum + (gap.endMin - gap.startMin), 0);
  const largest = gaps.reduce((max, gap) => Math.max(max, gap.endMin - gap.startMin), 0);
  if (total <= 0) {
    return `No open time remains between ${formatMin(window.startMin)} and ${formatMin(
      window.endMin,
    )}.`;
  }
  if (total >= duration) {
    return `The open time is fragmented — the largest opening is only ${largest} minutes.`;
  }
  return `Only ${total} minutes remain, but this needs ${duration} minutes.`;
}

function formatMin(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/**
 * Deterministic day planner.
 *
 * Order: today's chosen priorities → tasks due now (oldest deadline first)
 * → remaining importance. It honors available hours, fixed events, preferred
 * periods where possible, and preserves deliberate breaks. It never drops a
 * task silently: anything that cannot fit is returned with a reason.
 */
export function generatePlan(
  tasks: PlanTaskInput[],
  options: GeneratePlanOptions,
): GeneratePlanResult {
  const warnings: string[] = [];
  const unscheduled: UnscheduledTask[] = [];
  const blocks: PlannedBlock[] = [];
  const dayWindow = normalizeInterval({
    startMin: options.dayStartMin,
    endMin: options.dayEndMin,
  });

  if (!dayWindow) {
    const eligible = tasks
      .filter((task) => isEligible(task, options.date))
      .sort((a, b) => comparePlanTasks(a, b, options.date));
    for (const task of eligible) {
      unscheduled.push({
        taskId: task.id,
        title: task.title,
        estimateMinutes: taskDuration(task),
        reason: 'window-too-small',
        detail: 'Your available time window is empty. Set your hours for this day.',
      });
    }
    return {
      blocks,
      unscheduled,
      warnings,
      scheduledMinutes: 0,
      breakMinutesPlanned: 0,
      freeMinutesRemaining: 0,
    };
  }

  const fixedBlocks = options.fixedBlocks
    .map(normalizeInterval)
    .filter((interval): interval is Interval => interval !== null);
  const manuallyScheduledTasks = new Set(
    options.fixedBlocks
      .map((block) => block.taskId ?? null)
      .filter((taskId): taskId is string => taskId !== null),
  );
  const busy: Interval[] = [...fixedBlocks];
  let cursor = dayWindow.startMin;
  let workSinceBreak = 0;
  let scheduledMinutes = 0;
  let breakMinutesPlanned = 0;

  const candidates = tasks
    .filter((task) => isEligible(task, options.date))
    .filter((task) => !manuallyScheduledTasks.has(task.id))
    .sort((a, b) => comparePlanTasks(a, b, options.date));

  const canBreak = options.breakMinutes > 0 && options.breakAfterMinutes > 0;

  for (const task of candidates) {
    if (canBreak && workSinceBreak >= options.breakAfterMinutes) {
      const breakStart = findOpening(
        busy,
        cursor,
        dayWindow.endMin,
        options.breakMinutes,
      );
      if (breakStart !== null) {
        const block: PlannedBreakBlock = {
          type: 'break',
          source: 'generated',
          taskId: null,
          title: 'Break',
          startMin: breakStart,
          endMin: breakStart + options.breakMinutes,
        };
        blocks.push(block);
        busy.push({ startMin: block.startMin, endMin: block.endMin });
        cursor = block.endMin;
        workSinceBreak = 0;
        breakMinutesPlanned += options.breakMinutes;
      } else {
        warnings.push(
          `There is no room for a ${options.breakMinutes}-minute break after ${options.breakAfterMinutes} minutes of work.`,
        );
        workSinceBreak = 0;
      }
    }

    const duration = taskDuration(task);
    let startMin: number | null = null;
    let preferenceRespected = true;
    const preferred = preferredPeriodWindow(task.preferredPeriod);

    if (preferred) {
      const from = Math.max(cursor, preferred.startMin);
      const limit = Math.min(dayWindow.endMin, preferred.endMin);
      if (limit > from) {
        startMin = findOpening(busy, from, limit, duration);
      }
      if (startMin === null) {
        startMin = findOpening(busy, cursor, dayWindow.endMin, duration);
        preferenceRespected = startMin === null;
      }
    } else {
      startMin = findOpening(busy, cursor, dayWindow.endMin, duration);
    }

    if (startMin === null) {
      unscheduled.push({
        taskId: task.id,
        title: task.title,
        estimateMinutes: duration,
        reason: 'no-space',
        detail: freeTimeDetail(
          busy,
          { startMin: cursor, endMin: dayWindow.endMin },
          duration,
        ),
      });
      continue;
    }

    if (!preferenceRespected && task.preferredPeriod !== 'any') {
      warnings.push(
        `“${task.title}” could not fit in the ${task.preferredPeriod} and was placed in another opening.`,
      );
    }

    const block: PlannedTaskBlock = {
      type: 'task',
      source: 'generated',
      taskId: task.id,
      title: task.title,
      startMin,
      endMin: startMin + duration,
    };
    blocks.push(block);
    busy.push({ startMin: block.startMin, endMin: block.endMin });
    cursor = block.endMin;
    workSinceBreak += duration;
    scheduledMinutes += duration;
  }

  const normalizedWindow = dayWindow;
  const totalFree = getFreeGaps(busy, normalizedWindow).reduce(
    (sum, gap) => sum + (gap.endMin - gap.startMin),
    0,
  );

  blocks.sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);

  return {
    blocks,
    unscheduled,
    warnings,
    scheduledMinutes,
    breakMinutesPlanned,
    freeMinutesRemaining: totalFree,
  };
}
