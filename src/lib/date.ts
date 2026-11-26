import { MONTH_LABELS, WEEKDAY_LABELS, WEEKDAY_SHORT } from '../constants';
import type { TimeFormat, WeekStartsOn } from '../types';

export const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

export function parseDateKey(key: string): { year: number; month: number; day: number } | null {
  if (!DATE_KEY_RE.test(key)) return null;
  const [year, month, day] = key.split('-').map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

export function isValidDateKey(key: string): boolean {
  return parseDateKey(key) !== null;
}

/** A local calendar key, deliberately avoiding `toISOString` (which shifts with UTC). */
export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function fromDateKey(key: string): Date {
  const parts = parseDateKey(key);
  if (!parts) throw new Error(`Invalid date: ${key}`);
  return new Date(parts.year, parts.month - 1, parts.day, 12, 0, 0, 0);
}

export function todayKey(now: Date = new Date()): string {
  return toDateKey(now);
}

export function addDays(key: string, amount: number): string {
  const date = fromDateKey(key);
  date.setDate(date.getDate() + amount);
  return toDateKey(date);
}

export function addMonths(key: string, amount: number): string {
  const date = fromDateKey(key);
  const targetDay = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + amount);
  const daysInTarget = new Date(date.getFullYear(), date.getMonth() + 1, 0, 12).getDate();
  date.setDate(Math.min(targetDay, daysInTarget));
  return toDateKey(date);
}

/** Calendar-day difference between two keys, independent of daylight saving time. */
export function diffCalendarDays(from: string, to: string): number {
  const a = parseDateKey(from);
  const b = parseDateKey(to);
  if (!a || !b) return 0;
  const aUtc = Date.UTC(a.year, a.month - 1, a.day);
  const bUtc = Date.UTC(b.year, b.month - 1, b.day);
  return Math.round((bUtc - aUtc) / 86_400_000);
}

export function compareDateKeys(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function isKeyInRange(key: string, start: string, end: string): boolean {
  return key >= start && key <= end;
}

export function startOfWeekKey(key: string, weekStartsOn: WeekStartsOn): string {
  const date = fromDateKey(key);
  const offset = (date.getDay() - weekStartsOn + 7) % 7;
  return addDays(key, -offset);
}

export function endOfWeekKey(key: string, weekStartsOn: WeekStartsOn): string {
  return addDays(startOfWeekKey(key, weekStartsOn), 6);
}

export function weekRange(
  key: string,
  weekStartsOn: WeekStartsOn,
): { start: string; end: string } {
  return {
    start: startOfWeekKey(key, weekStartsOn),
    end: endOfWeekKey(key, weekStartsOn),
  };
}

export function startOfMonthKey(key: string): string {
  const parts = parseDateKey(key);
  if (!parts) return key;
  return `${parts.year}-${pad2(parts.month)}-01`;
}

export function endOfMonthKey(key: string): string {
  const parts = parseDateKey(key);
  if (!parts) return key;
  const date = new Date(parts.year, parts.month, 0, 12);
  return toDateKey(date);
}

export function monthRange(key: string): { start: string; end: string } {
  return { start: startOfMonthKey(key), end: endOfMonthKey(key) };
}

export function getWeekDays(key: string, weekStartsOn: WeekStartsOn): string[] {
  const start = startOfWeekKey(key, weekStartsOn);
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

export interface MonthGridDay {
  key: string;
  inCurrentMonth: boolean;
}

/** Always six weeks (42 cells) so month layouts do not jump between months. */
export function getMonthGrid(
  year: number,
  monthIndex: number,
  weekStartsOn: WeekStartsOn,
): MonthGridDay[] {
  const firstOfMonth = `${year}-${pad2(monthIndex + 1)}-01`;
  const offset = (fromDateKey(firstOfMonth).getDay() - weekStartsOn + 7) % 7;
  const gridStart = addDays(firstOfMonth, -offset);
  return Array.from({ length: 42 }, (_, index) => {
    const key = addDays(gridStart, index);
    const parts = parseDateKey(key);
    return {
      key,
      inCurrentMonth: parts?.year === year && parts?.month === monthIndex + 1,
    };
  });
}

export function getLastNDays(endKey: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) => addDays(endKey, index - (count - 1)));
}

export function weekdayIndex(key: string): number {
  return fromDateKey(key).getDay();
}

export function formatMonthYear(year: number, monthIndex: number): string {
  return `${MONTH_LABELS[monthIndex]} ${year}`;
}

export function formatMonthYearFromKey(key: string): string {
  const parts = parseDateKey(key);
  if (!parts) return key;
  return formatMonthYear(parts.year, parts.month - 1);
}

export function formatDate(
  key: string,
  options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' },
): string {
  const date = fromDateKey(key);
  return new Intl.DateTimeFormat('en-US', options).format(date);
}

export function formatDateLong(key: string, includeYear = false): string {
  return formatDate(key, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    ...(includeYear ? { year: 'numeric' } : {}),
  });
}

export function formatDateMedium(key: string): string {
  return formatDate(key, { weekday: 'short', month: 'short', day: 'numeric' });
}

export function formatDateWithYear(key: string): string {
  const parts = parseDateKey(key);
  const currentYear = new Date().getFullYear();
  return formatDate(key, {
    month: 'short',
    day: 'numeric',
    ...(parts?.year !== currentYear ? { year: 'numeric' } : {}),
  });
}

export function formatFriendlyDate(key: string, today: string): string {
  const diff = diffCalendarDays(today, key);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff > 1 && diff < 7) {
    return formatDate(key, { weekday: 'long' });
  }
  return formatDateWithYear(key);
}

export function formatFriendlyDateShort(key: string, today: string): string {
  const diff = diffCalendarDays(today, key);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return formatDateMedium(key);
}

export function getWeekdayName(index: number): string {
  return WEEKDAY_LABELS[((index % 7) + 7) % 7] ?? '';
}

export function getWeekdayShort(index: number): string {
  return WEEKDAY_SHORT[((index % 7) + 7) % 7] ?? '';
}

export function formatTime(totalMinutes: number, format: TimeFormat): string {
  const normalized = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  if (format === '24h') {
    return `${pad2(hours)}:${pad2(minutes)}`;
  }
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const displayHour = hours % 12 === 0 ? 12 : hours % 12;
  return `${displayHour}:${pad2(minutes)} ${suffix}`;
}

export function formatTimeCompact(totalMinutes: number, format: TimeFormat): string {
  const normalized = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  if (format === '24h') {
    return `${pad2(hours)}:${pad2(minutes)}`;
  }
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const displayHour = hours % 12 === 0 ? 12 : hours % 12;
  return minutes === 0
    ? `${displayHour} ${suffix}`
    : `${displayHour}:${pad2(minutes)} ${suffix}`;
}

export function hourLabel(totalMinutes: number, format: TimeFormat): string {
  const normalized = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  if (format === '24h') return `${pad2(hours)}:00`;
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const displayHour = hours % 12 === 0 ? 12 : hours % 12;
  return `${displayHour} ${suffix}`;
}

export function formatTimeRange(
  startMin: number,
  endMin: number,
  format: TimeFormat,
): string {
  if (format === '24h') {
    return `${formatTime(startMin, '24h')}–${formatTime(endMin, '24h')}`;
  }
  const start = formatTime(startMin, '12h');
  const end = formatTime(endMin, '12h');
  const startSuffix = start.endsWith('PM') ? 'PM' : 'AM';
  const endSuffix = end.endsWith('PM') ? 'PM' : 'AM';
  if (startSuffix === endSuffix) {
    return `${start.replace(/\s?(AM|PM)$/, '')}–${end}`;
  }
  return `${start}–${end}`;
}

export function formatDuration(totalMinutes: number): string {
  const rounded = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(rounded / 60);
  const minutes = rounded % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

export function formatMinutesPrecise(totalMinutes: number): string {
  const rounded = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(rounded / 60);
  const minutes = rounded % 60;
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} hr`;
  return `${hours} hr ${minutes} min`;
}

export function minutesToTimeValue(totalMinutes: number): string {
  const normalized = Math.max(0, Math.min(1439, Math.round(totalMinutes)));
  return `${pad2(Math.floor(normalized / 60))}:${pad2(normalized % 60)}`;
}

export function timeValueToMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function snapMinutes(value: number, step = 5): number {
  return Math.round(value / step) * step;
}

export function clampMinutes(value: number): number {
  return Math.max(0, Math.min(1440, Math.round(value)));
}

export function getGreeting(now: Date = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function getDaysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0, 12).getDate();
}

export function dateKeyFromTimestamp(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return toDateKey(date);
}

export function isWeekendKey(key: string): boolean {
  const day = weekdayIndex(key);
  return day === 0 || day === 6;
}

export function formatRelativeTarget(key: string, today: string): string {
  const diff = diffCalendarDays(today, key);
  if (diff === 0) return 'Due today';
  if (diff === 1) return 'Due tomorrow';
  if (diff > 1) return `${diff} days left`;
  if (diff === -1) return '1 day overdue';
  return `${Math.abs(diff)} days overdue`;
}

export function formatMonthShort(monthIndex: number): string {
  return MONTH_LABELS[monthIndex] ?? '';
}
