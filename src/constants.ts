import type { CategoryColor, CategoryColorStyle } from './types';

export const APP_NAME = 'Daymark';
export const APP_VERSION = 1 as const;
export const STORAGE_KEY = 'daymark.data.v1';
export const BACKUP_PREFIX = 'daymark.backup.';

export const CATEGORY_OTHER_ID = 'cat-other';

export const CATEGORY_COLORS: Record<CategoryColor, CategoryColorStyle> = {
  ember: {
    label: 'Ember',
    dot: 'bg-[#b5533a]',
    chip: 'bg-[#f5e7e0] text-[#8b3c27] dark:bg-[#3e2822] dark:text-[#e8b49f]',
    soft: 'bg-[#f5e7e0] dark:bg-[#3e2822]',
    line: 'border-[#d9a891] dark:border-[#6b4438]',
  },
  moss: {
    label: 'Moss',
    dot: 'bg-[#5b7157]',
    chip: 'bg-[#e8eee5] text-[#43573f] dark:bg-[#29352a] dark:text-[#b8cbb3]',
    soft: 'bg-[#e8eee5] dark:bg-[#29352a]',
    line: 'border-[#a7b9a1] dark:border-[#455842]',
  },
  ocean: {
    label: 'Ocean',
    dot: 'bg-[#4f6d86]',
    chip: 'bg-[#e5ecf1] text-[#3b556b] dark:bg-[#252f38] dark:text-[#abc2d3]',
    soft: 'bg-[#e5ecf1] dark:bg-[#252f38]',
    line: 'border-[#9bb3c4] dark:border-[#3f5668]',
  },
  gold: {
    label: 'Gold',
    dot: 'bg-[#a37b34]',
    chip: 'bg-[#f3ebd9] text-[#755719] dark:bg-[#332c1f] dark:text-[#dcc28c]',
    soft: 'bg-[#f3ebd9] dark:bg-[#332c1f]',
    line: 'border-[#cbb37c] dark:border-[#5f5236]',
  },
  plum: {
    label: 'Plum',
    dot: 'bg-[#7b5b75]',
    chip: 'bg-[#efe7ed] text-[#62455d] dark:bg-[#32272f] dark:text-[#d1b5c9]',
    soft: 'bg-[#efe7ed] dark:bg-[#32272f]',
    line: 'border-[#b99aae] dark:border-[#5c4653]',
  },
  slate: {
    label: 'Slate',
    dot: 'bg-[#6b6a64]',
    chip: 'bg-[#ebeae5] text-[#56554f] dark:bg-[#2c2b27] dark:text-[#c3c1b6]',
    soft: 'bg-[#ebeae5] dark:bg-[#2c2b27]',
    line: 'border-[#b4b2a8] dark:border-[#4f4e47]',
  },
};

export const CATEGORY_COLOR_KEYS = Object.keys(CATEGORY_COLORS) as CategoryColor[];

export const IMPORTANCE_LABELS = {
  none: 'No importance',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
} as const;

export const PREFERRED_PERIOD_LABELS = {
  any: 'Anytime',
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
} as const;

export const WEEKDAY_LABELS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export const MONTH_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export const TIME_INCREMENT_MINUTES = 15;
