import { createDefaultAppData } from '../domain/defaults';
import { createTask, type NewTaskInput } from '../domain/tasks';
import type { AppData, Task } from '../types';

export const FIXED_NOW = new Date('2026-05-01T09:00:00.000Z');

export function makeData(): AppData {
  return createDefaultAppData(FIXED_NOW);
}

export function withTask(
  data: AppData,
  input: Partial<NewTaskInput> & { title: string },
  now: Date = FIXED_NOW,
): AppData {
  return createTask(
    data,
    {
      categoryId: 'cat-personal',
      ...input,
    },
    now,
  );
}

export function taskByTitle(data: AppData, title: string): Task {
  const task = data.tasks.find((candidate) => candidate.title === title);
  if (!task) throw new Error(`Missing test task: ${title}`);
  return task;
}

export function allTaskTitles(data: AppData): string[] {
  return data.tasks.map((task) => task.title);
}
