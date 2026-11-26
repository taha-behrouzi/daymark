import type { AppData, Settings, ThemePreference, TimeFormat, WeekStartsOn } from '../types';
import { DomainError } from './errors';

const THEMES: readonly ThemePreference[] = ['light', 'dark', 'system'];
const TIME_FORMATS: readonly TimeFormat[] = ['12h', '24h'];
const WEEK_STARTS: readonly WeekStartsOn[] = [0, 1, 6];

function integer(
  value: number,
  label: string,
  min: number,
  max: number,
): number {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new DomainError(`${label} must be a whole number between ${min} and ${max}.`);
  }
  return value;
}

/** Validates and applies a settings patch. */
export function updateSettings(data: AppData, patch: Partial<Settings>): AppData {
  const next: Settings = { ...data.settings, ...patch };

  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (name.length > 60) {
      throw new DomainError('Your name can be at most 60 characters.');
    }
    next.name = name;
  }
  if (patch.theme !== undefined && !THEMES.includes(patch.theme)) {
    throw new DomainError('Choose a valid theme.');
  }
  if (patch.timeFormat !== undefined && !TIME_FORMATS.includes(patch.timeFormat)) {
    throw new DomainError('Choose a valid time format.');
  }
  if (patch.weekStartsOn !== undefined && !WEEK_STARTS.includes(patch.weekStartsOn)) {
    throw new DomainError('Choose a valid first day of the week.');
  }

  integer(next.workStartMin, 'The start of your day', 0, 1439);
  integer(next.workEndMin, 'The end of your day', 1, 1440);
  if (next.workEndMin - next.workStartMin < 15) {
    throw new DomainError('Your day needs at least 15 minutes between start and end.');
  }
  integer(next.breakMinutes, 'Break length', 0, 120);
  integer(next.breakAfterMinutes, 'Break interval', 15, 480);
  integer(next.defaultEstimateMinutes, 'The default estimate', 5, 480);

  return { ...data, settings: next };
}
