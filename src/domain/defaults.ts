import { CATEGORY_OTHER_ID } from '../constants';
import type { AppData, Category, Settings } from '../types';

export const DEFAULT_SETTINGS: Settings = {
  name: '',
  theme: 'light',
  weekStartsOn: 1,
  timeFormat: '24h',
  workStartMin: 8 * 60,
  workEndMin: 18 * 60,
  breakMinutes: 15,
  breakAfterMinutes: 90,
  defaultEstimateMinutes: 30,
};

export function createDefaultCategories(nowIso: string): Category[] {
  return [
    {
      id: 'cat-personal',
      name: 'Personal',
      color: 'ember',
      createdAt: nowIso,
    },
    {
      id: 'cat-study',
      name: 'Study',
      color: 'ocean',
      createdAt: nowIso,
    },
    {
      id: 'cat-work',
      name: 'Work',
      color: 'slate',
      createdAt: nowIso,
    },
    {
      id: 'cat-health',
      name: 'Health',
      color: 'moss',
      createdAt: nowIso,
    },
    {
      id: 'cat-finance',
      name: 'Finance',
      color: 'gold',
      createdAt: nowIso,
    },
    {
      id: CATEGORY_OTHER_ID,
      name: 'Other',
      color: 'plum',
      createdAt: nowIso,
    },
  ];
}

export function createDefaultAppData(now: Date = new Date()): AppData {
  return {
    version: 1,
    tasks: [],
    categories: createDefaultCategories(now.toISOString()),
    goals: [],
    blocks: [],
    plannerDays: {},
    settings: { ...DEFAULT_SETTINGS },
  };
}

export function getCategoryColorFallback(): 'plum' {
  return 'plum';
}

export function getDefaultCategoryId(categories: Category[]): string {
  return (
    categories.find((category) => category.id === CATEGORY_OTHER_ID)?.id ??
    categories[0]?.id ??
    CATEGORY_OTHER_ID
  );
}
