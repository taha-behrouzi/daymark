import { CATEGORY_OTHER_ID } from '../constants';
import { uid } from '../lib/id';
import type { AppData, Category, CategoryColor } from '../types';
import { DomainError } from './errors';

const MAX_CATEGORY_NAME = 24;
const MAX_CATEGORIES = 30;
const VALID_COLORS: readonly CategoryColor[] = [
  'ember',
  'moss',
  'ocean',
  'gold',
  'plum',
  'slate',
];

function normalizeName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new DomainError('Give the category a name.');
  if (trimmed.length > MAX_CATEGORY_NAME) {
    throw new DomainError(`Category names can be at most ${MAX_CATEGORY_NAME} characters.`);
  }
  return trimmed;
}

function ensureUniqueName(data: AppData, name: string, ignoreId?: string): void {
  const normalized = name.toLocaleLowerCase();
  if (
    data.categories.some(
      (category) =>
        category.id !== ignoreId && category.name.toLocaleLowerCase() === normalized,
    )
  ) {
    throw new DomainError('A category with that name already exists.');
  }
}

function normalizeColor(color: CategoryColor): CategoryColor {
  if (!VALID_COLORS.includes(color)) throw new DomainError('Choose a valid category color.');
  return color;
}

export function addCategory(
  data: AppData,
  input: { name: string; color: CategoryColor },
  now: Date = new Date(),
): AppData {
  if (data.categories.length >= MAX_CATEGORIES) {
    throw new DomainError(`You can have at most ${MAX_CATEGORIES} categories.`);
  }
  const name = normalizeName(input.name);
  ensureUniqueName(data, name);
  const category: Category = {
    id: uid('cat'),
    name,
    color: normalizeColor(input.color),
    createdAt: now.toISOString(),
  };
  return { ...data, categories: [...data.categories, category] };
}

export function updateCategory(
  data: AppData,
  categoryId: string,
  patch: { name?: string; color?: CategoryColor },
): AppData {
  const existing = data.categories.find((category) => category.id === categoryId);
  if (!existing) throw new DomainError('That category no longer exists.');
  const name = patch.name !== undefined ? normalizeName(patch.name) : existing.name;
  ensureUniqueName(data, name, categoryId);
  const color = patch.color !== undefined ? normalizeColor(patch.color) : existing.color;
  return {
    ...data,
    categories: data.categories.map((category) =>
      category.id === categoryId ? { ...category, name, color } : category,
    ),
  };
}

export function deleteCategory(data: AppData, categoryId: string): AppData {
  if (categoryId === CATEGORY_OTHER_ID) {
    throw new DomainError('The Other category is built in and cannot be deleted.');
  }
  if (!data.categories.some((category) => category.id === categoryId)) {
    throw new DomainError('That category no longer exists.');
  }
  return {
    ...data,
    categories: data.categories.filter((category) => category.id !== categoryId),
    tasks: data.tasks.map((task) =>
      task.categoryId === categoryId ? { ...task, categoryId: CATEGORY_OTHER_ID } : task,
    ),
    goals: data.goals.map((goal) =>
      goal.categoryId === categoryId ? { ...goal, categoryId: CATEGORY_OTHER_ID } : goal,
    ),
  };
}
