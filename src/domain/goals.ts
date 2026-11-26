import { isValidDateKey } from '../lib/date';
import { uid } from '../lib/id';
import type { AppData, Goal, GoalMilestone, GoalStatus } from '../types';
import { DomainError } from './errors';

export interface GoalMilestoneInput {
  id?: string;
  title: string;
  done?: boolean;
}

export interface NewGoalInput {
  title: string;
  description?: string;
  categoryId: string;
  targetDate: string;
  progress?: number;
  milestones?: GoalMilestoneInput[];
}

export interface GoalPatch {
  title?: string;
  description?: string;
  categoryId?: string;
  targetDate?: string;
  progress?: number;
  milestones?: GoalMilestoneInput[];
}

const MAX_TITLE = 160;
const MAX_DESCRIPTION = 4000;
const MAX_MILESTONES = 50;
const MAX_MILESTONE_TITLE = 160;

function normalizeTitle(value: string): string {
  const title = value.trim();
  if (!title) throw new DomainError('Give the goal a title.');
  if (title.length > MAX_TITLE) {
    throw new DomainError(`Goal titles can be at most ${MAX_TITLE} characters.`);
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

function normalizeTargetDate(value: string): string {
  if (!isValidDateKey(value)) throw new DomainError('Choose a valid target date.');
  return value;
}

function normalizeProgress(value: number): number {
  if (!Number.isFinite(value)) throw new DomainError('Progress must be a number.');
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeMilestones(inputs: GoalMilestoneInput[]): GoalMilestone[] {
  if (inputs.length > MAX_MILESTONES) {
    throw new DomainError(`A goal can have at most ${MAX_MILESTONES} milestones.`);
  }
  const used = new Set<string>();
  return inputs.map((input) => {
    const title = input.title.trim();
    if (!title) throw new DomainError('Milestones need a title.');
    if (title.length > MAX_MILESTONE_TITLE) {
      throw new DomainError(
        `Milestone titles can be at most ${MAX_MILESTONE_TITLE} characters.`,
      );
    }
    const suppliedId =
      input.id && /^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(input.id) && !used.has(input.id)
        ? input.id
        : uid('ms');
    used.add(suppliedId);
    return { id: suppliedId, title, done: input.done ?? false };
  });
}

function ensureCategory(data: AppData, categoryId: string): void {
  if (!data.categories.some((category) => category.id === categoryId)) {
    throw new DomainError('Choose an existing category.');
  }
}

function findGoal(data: AppData, goalId: string): Goal {
  const goal = data.goals.find((candidate) => candidate.id === goalId);
  if (!goal) throw new DomainError('That goal no longer exists.');
  return goal;
}

export function computeMilestoneProgress(milestones: GoalMilestone[]): number | null {
  if (milestones.length === 0) return null;
  const done = milestones.filter((milestone) => milestone.done).length;
  return Math.round((done / milestones.length) * 100);
}

export function addGoal(
  data: AppData,
  input: NewGoalInput,
  now: Date = new Date(),
): AppData {
  ensureCategory(data, input.categoryId);
  const milestones = normalizeMilestones(input.milestones ?? []);
  const milestoneProgress = computeMilestoneProgress(milestones);
  const nowIso = now.toISOString();
  const goal: Goal = {
    id: uid('goal'),
    title: normalizeTitle(input.title),
    description: normalizeDescription(input.description),
    categoryId: input.categoryId,
    targetDate: normalizeTargetDate(input.targetDate),
    progress:
      input.progress !== undefined
        ? normalizeProgress(input.progress)
        : (milestoneProgress ?? 0),
    status: 'active',
    milestones,
    createdAt: nowIso,
    updatedAt: nowIso,
    completedAt: null,
  };
  return { ...data, goals: [...data.goals, goal] };
}

export function updateGoal(
  data: AppData,
  goalId: string,
  patch: GoalPatch,
  now: Date = new Date(),
): AppData {
  const existing = findGoal(data, goalId);
  if (patch.categoryId !== undefined) ensureCategory(data, patch.categoryId);
  const milestones =
    patch.milestones !== undefined
      ? normalizeMilestones(patch.milestones)
      : existing.milestones;
  const progress =
    patch.progress !== undefined
      ? normalizeProgress(patch.progress)
      : existing.progress;

  return {
    ...data,
    goals: data.goals.map((goal) =>
      goal.id === goalId
        ? {
            ...goal,
            title: patch.title !== undefined ? normalizeTitle(patch.title) : goal.title,
            description:
              patch.description !== undefined
                ? normalizeDescription(patch.description)
                : goal.description,
            categoryId: patch.categoryId ?? goal.categoryId,
            targetDate:
              patch.targetDate !== undefined
                ? normalizeTargetDate(patch.targetDate)
                : goal.targetDate,
            progress,
            milestones,
            updatedAt: now.toISOString(),
          }
        : goal,
    ),
  };
}

export function toggleGoalMilestone(
  data: AppData,
  goalId: string,
  milestoneId: string,
  now: Date = new Date(),
): AppData {
  const goal = findGoal(data, goalId);
  if (goal.status !== 'active') {
    throw new DomainError('Reopen this goal before editing its milestones.');
  }
  const milestone = goal.milestones.find((candidate) => candidate.id === milestoneId);
  if (!milestone) throw new DomainError('That milestone no longer exists.');
  const milestones = goal.milestones.map((candidate) =>
    candidate.id === milestoneId ? { ...candidate, done: !candidate.done } : candidate,
  );
  const synced = computeMilestoneProgress(milestones);
  return {
    ...data,
    goals: data.goals.map((candidate) =>
      candidate.id === goalId
        ? {
            ...candidate,
            milestones,
            progress: synced ?? candidate.progress,
            updatedAt: now.toISOString(),
          }
        : candidate,
    ),
  };
}

export function setGoalProgress(
  data: AppData,
  goalId: string,
  progress: number,
  now: Date = new Date(),
): AppData {
  const goal = findGoal(data, goalId);
  if (goal.status !== 'active') {
    throw new DomainError('Reopen this goal before changing its progress.');
  }
  return {
    ...data,
    goals: data.goals.map((candidate) =>
      candidate.id === goalId
        ? { ...candidate, progress: normalizeProgress(progress), updatedAt: now.toISOString() }
        : candidate,
    ),
  };
}

export function setGoalStatus(
  data: AppData,
  goalId: string,
  status: GoalStatus,
  now: Date = new Date(),
): AppData {
  const goal = findGoal(data, goalId);
  const nowIso = now.toISOString();
  return {
    ...data,
    goals: data.goals.map((candidate) => {
      if (candidate.id !== goalId) return candidate;
      if (status === 'completed') {
        return {
          ...candidate,
          status,
          progress: 100,
          completedAt: nowIso,
          updatedAt: nowIso,
        };
      }
      if (status === 'active') {
        const milestoneProgress = computeMilestoneProgress(candidate.milestones);
        return {
          ...candidate,
          status,
          // A completed goal is recorded at 100%. When it is reopened, let the
          // milestones tell the more honest story again.
          progress:
            goal.status === 'completed' && milestoneProgress !== null
              ? milestoneProgress
              : candidate.progress,
          completedAt: null,
          updatedAt: nowIso,
        };
      }
      return {
        ...candidate,
        status,
        completedAt:
          goal.status === 'completed' ? (candidate.completedAt ?? nowIso) : candidate.completedAt,
        updatedAt: nowIso,
      };
    }),
  };
}

export function deleteGoal(data: AppData, goalId: string): AppData {
  findGoal(data, goalId);
  return { ...data, goals: data.goals.filter((goal) => goal.id !== goalId) };
}
