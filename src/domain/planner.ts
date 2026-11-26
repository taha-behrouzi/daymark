import { isValidDateKey } from '../lib/date';
import { uid } from '../lib/id';
import type {
  AppData,
  BlockType,
  PlannerDay,
  ScheduleBlock,
  Task,
} from '../types';
import { DomainError } from './errors';
import type { PlannedBlock } from './scheduler';
import { findOverlaps } from './scheduler';

export interface NewBlockInput {
  date: string;
  startMin: number;
  endMin: number;
  type: BlockType;
  taskId?: string | null;
  title?: string;
  notes?: string;
}

export interface BlockPatch {
  date?: string;
  startMin?: number;
  endMin?: number;
  title?: string;
  notes?: string;
}

export interface ScheduleConflict {
  first: ScheduleBlock;
  second: ScheduleBlock;
}

const MIN_BLOCK_MINUTES = 5;

export function getPlannerDay(data: AppData, date: string): PlannerDay {
  if (!isValidDateKey(date)) throw new DomainError('Choose a valid date.');
  const override = data.plannerDays[date];
  if (override) return { ...override };
  return {
    startMin: data.settings.workStartMin,
    endMin: data.settings.workEndMin,
    breakMinutes: data.settings.breakMinutes,
    breakAfterMinutes: data.settings.breakAfterMinutes,
  };
}

function normalizeClock(
  value: number,
  label: string,
  min: number,
  max: number,
): number {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new DomainError(`${label} must be a valid time.`);
  }
  return value;
}

function validateWindow(startMin: number, endMin: number): void {
  normalizeClock(startMin, 'The start time', 0, 1439);
  normalizeClock(endMin, 'The end time', 1, 1440);
  if (endMin <= startMin) {
    throw new DomainError('The end time must be later than the start time.');
  }
  if (endMin - startMin < 15) {
    throw new DomainError('Leave at least 15 minutes in the available window.');
  }
}

export function updatePlannerDay(
  data: AppData,
  date: string,
  patch: Partial<PlannerDay>,
): AppData {
  if (!isValidDateKey(date)) throw new DomainError('Choose a valid date.');
  const existing = getPlannerDay(data, date);
  const next: PlannerDay = {
    startMin: patch.startMin ?? existing.startMin,
    endMin: patch.endMin ?? existing.endMin,
    breakMinutes: patch.breakMinutes ?? existing.breakMinutes,
    breakAfterMinutes: patch.breakAfterMinutes ?? existing.breakAfterMinutes,
  };
  validateWindow(next.startMin, next.endMin);
  normalizeClock(next.breakMinutes, 'The break length', 0, 120);
  normalizeClock(next.breakAfterMinutes, 'The break interval', 15, 480);

  return {
    ...data,
    plannerDays: {
      ...data.plannerDays,
      [date]: next,
    },
  };
}

export function resetPlannerDay(data: AppData, date: string): AppData {
  if (!(date in data.plannerDays)) return data;
  const plannerDays = { ...data.plannerDays };
  delete plannerDays[date];
  return { ...data, plannerDays };
}

export function blocksForDate(data: AppData, date: string): ScheduleBlock[] {
  return data.blocks
    .filter((block) => block.date === date)
    .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
}

export function scheduleConflictsForDate(data: AppData, date: string): ScheduleConflict[] {
  return findOverlaps(blocksForDate(data, date)).map(([first, second]) => ({
    first,
    second,
  }));
}

function findTask(data: AppData, taskId: string): Task {
  const task = data.tasks.find((candidate) => candidate.id === taskId);
  if (!task) throw new DomainError('That task no longer exists.');
  return task;
}

function formatClock(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

function findOverlappingBlock(
  blocks: ScheduleBlock[],
  candidate: { startMin: number; endMin: number },
  ignoreId?: string,
): ScheduleBlock | null {
  return (
    blocks.find(
      (block) =>
        block.id !== ignoreId &&
        block.startMin < candidate.endMin &&
        candidate.startMin < block.endMin,
    ) ?? null
  );
}

function ensureTaskNotScheduledOnDate(
  blocks: ScheduleBlock[],
  taskId: string,
  date: string,
  ignoreId?: string,
): void {
  if (
    blocks.some(
      (block) =>
        block.id !== ignoreId && block.taskId === taskId && block.date === date,
    )
  ) {
    throw new DomainError('That task is already scheduled on this day.');
  }
}

function normalizeBlockTitle(value: string | undefined): string {
  const title = value?.trim() ?? '';
  if (!title) throw new DomainError('Give this time block a title.');
  if (title.length > 180) throw new DomainError('Time block titles can be at most 180 characters.');
  return title;
}

function buildBlock(
  input: {
    date: string;
    startMin: number;
    endMin: number;
    type: BlockType;
    taskId: string | null;
    title: string;
    notes: string;
    source: 'manual' | 'generated';
  },
  now: Date,
): ScheduleBlock {
  if (!isValidDateKey(input.date)) throw new DomainError('Choose a valid date.');
  normalizeClock(input.startMin, 'The start time', 0, 1439);
  normalizeClock(input.endMin, 'The end time', 1, 1440);
  if (input.endMin - input.startMin < MIN_BLOCK_MINUTES) {
    throw new DomainError('Time blocks must be at least five minutes long.');
  }
  return {
    id: uid('block'),
    date: input.date,
    startMin: input.startMin,
    endMin: input.endMin,
    type: input.type,
    source: input.source,
    title: input.title,
    taskId: input.taskId,
    notes: input.notes,
    createdAt: now.toISOString(),
  };
}

export function addScheduleBlock(
  data: AppData,
  input: NewBlockInput,
  now: Date = new Date(),
): AppData {
  if (!isValidDateKey(input.date)) throw new DomainError('Choose a valid date.');
  const dateBlocks = blocksForDate(data, input.date);
  let title: string;
  let taskId: string | null = null;

  if (input.type === 'task') {
    if (!input.taskId) throw new DomainError('Choose a task for this block.');
    const task = findTask(data, input.taskId);
    ensureTaskNotScheduledOnDate(data.blocks, task.id, input.date);
    title = task.title;
    taskId = task.id;
  } else if (input.type === 'event') {
    title = normalizeBlockTitle(input.title);
  } else {
    if (input.taskId) throw new DomainError('Breaks cannot be linked to a task.');
    title = input.title?.trim() || 'Break';
  }

  const overlap = findOverlappingBlock(dateBlocks, {
    startMin: input.startMin,
    endMin: input.endMin,
  });
  if (overlap) {
    throw new DomainError(
      `That time overlaps “${overlap.title}” (${formatClock(overlap.startMin)}–${formatClock(
        overlap.endMin,
      )}).`,
    );
  }

  const block = buildBlock(
    {
      date: input.date,
      startMin: input.startMin,
      endMin: input.endMin,
      type: input.type,
      taskId,
      title,
      notes: input.notes?.trim() ?? '',
      source: 'manual',
    },
    now,
  );

  return { ...data, blocks: [...data.blocks, block] };
}

export function updateScheduleBlock(
  data: AppData,
  blockId: string,
  patch: BlockPatch,
): AppData {
  const existing = data.blocks.find((block) => block.id === blockId);
  if (!existing) throw new DomainError('That time block no longer exists.');
  const date = patch.date ?? existing.date;
  if (!isValidDateKey(date)) throw new DomainError('Choose a valid date.');
  const startMin = patch.startMin ?? existing.startMin;
  const endMin = patch.endMin ?? existing.endMin;
  normalizeClock(startMin, 'The start time', 0, 1439);
  normalizeClock(endMin, 'The end time', 1, 1440);
  if (endMin - startMin < MIN_BLOCK_MINUTES) {
    throw new DomainError('Time blocks must be at least five minutes long.');
  }

  const dateBlocks = blocksForDate(data, date);
  if (existing.taskId) {
    ensureTaskNotScheduledOnDate(data.blocks, existing.taskId, date, blockId);
  }
  const overlap = findOverlappingBlock(dateBlocks, { startMin, endMin }, blockId);
  if (overlap) {
    throw new DomainError(
      `That time overlaps “${overlap.title}” (${formatClock(overlap.startMin)}–${formatClock(
        overlap.endMin,
      )}).`,
    );
  }

  const title =
    existing.type === 'task'
      ? existing.title
      : patch.title !== undefined
        ? normalizeBlockTitle(patch.title)
        : existing.title;

  return {
    ...data,
    blocks: data.blocks.map((block) =>
      block.id === blockId
        ? {
            ...block,
            date,
            startMin,
            endMin,
            title,
            notes: patch.notes !== undefined ? patch.notes.trim() : block.notes,
            source: 'manual',
          }
        : block,
    ),
  };
}

export function deleteScheduleBlock(data: AppData, blockId: string): AppData {
  if (!data.blocks.some((block) => block.id === blockId)) {
    throw new DomainError('That time block no longer exists.');
  }
  return { ...data, blocks: data.blocks.filter((block) => block.id !== blockId) };
}

export function scheduleTaskAt(
  data: AppData,
  taskId: string,
  date: string,
  startMin: number,
  now: Date = new Date(),
): AppData {
  const task = findTask(data, taskId);
  ensureTaskNotScheduledOnDate(data.blocks, task.id, date);
  return addScheduleBlock(
    data,
    {
      date,
      startMin,
      endMin: startMin + task.estimateMinutes,
      type: 'task',
      taskId: task.id,
    },
    now,
  );
}

export function applyGeneratedPlan(
  data: AppData,
  date: string,
  drafts: PlannedBlock[],
  now: Date = new Date(),
): AppData {
  if (!isValidDateKey(date)) throw new DomainError('Choose a valid date.');
  const kept = data.blocks.filter(
    (block) => !(block.date === date && block.source === 'generated'),
  );
  const newBlocks: ScheduleBlock[] = [];

  for (const draft of drafts) {
    let title: string;
    let taskId: string | null = null;
    if (draft.type === 'task') {
      const task = findTask(data, draft.taskId);
      ensureTaskNotScheduledOnDate([...kept, ...newBlocks], task.id, date);
      title = task.title;
      taskId = task.id;
    } else {
      title = draft.title.trim() || 'Break';
    }
    const overlap = findOverlappingBlock([...kept, ...newBlocks], {
      startMin: draft.startMin,
      endMin: draft.endMin,
    });
    if (overlap) {
      throw new DomainError(
        `The generated plan conflicts with “${overlap.title}”. Please adjust your schedule and try again.`,
      );
    }
    const block = buildBlock(
      {
        date,
        startMin: draft.startMin,
        endMin: draft.endMin,
        type: draft.type,
        taskId,
        title,
        notes: '',
        source: 'generated',
      },
      now,
    );
    newBlocks.push(block);
  }

  return { ...data, blocks: [...kept, ...newBlocks] };
}

export function clearGeneratedPlan(data: AppData, date: string): AppData {
  return {
    ...data,
    blocks: data.blocks.filter(
      (block) => !(block.date === date && block.source === 'generated'),
    ),
  };
}
