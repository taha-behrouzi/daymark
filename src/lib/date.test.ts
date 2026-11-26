import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  dateKeyFromTimestamp,
  diffCalendarDays,
  formatDuration,
  formatTime,
  formatTimeCompact,
  formatTimeRange,
  fromDateKey,
  getMonthGrid,
  getWeekDays,
  isValidDateKey,
  minutesToTimeValue,
  monthRange,
  parseDateKey,
  startOfWeekKey,
  timeValueToMinutes,
  toDateKey,
  todayKey,
  weekRange,
} from './date';

describe('date keys', () => {
  it('round-trips local calendar dates without UTC drift', () => {
    const key = '2026-11-24';
    expect(toDateKey(fromDateKey(key))).toBe(key);
    expect(fromDateKey(key).getHours()).toBe(12);
    expect(parseDateKey(key)).toEqual({ year: 2026, month: 11, day: 24 });
    expect(todayKey(new Date(2026, 10, 24, 23, 30))).toBe('2026-11-24');
  });

  it('rejects impossible dates and malformed keys', () => {
    expect(isValidDateKey('2026-02-29')).toBe(false);
    expect(isValidDateKey('2024-02-29')).toBe(true);
    expect(isValidDateKey('2026-2-01')).toBe(false);
    expect(isValidDateKey('tomorrow')).toBe(false);
    expect(parseDateKey('2026-13-01')).toBeNull();
  });

  it('adds days and months across boundaries with clamping', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29');
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-15');
  });

  it('counts calendar days across daylight-saving changes', () => {
    expect(diffCalendarDays('2026-03-07', '2026-03-09')).toBe(2);
    expect(diffCalendarDays('2026-10-31', '2026-11-02')).toBe(2);
    expect(diffCalendarDays('2026-05-04', '2026-05-04')).toBe(0);
  });

  it('derives a local date key from a timestamp', () => {
    const date = new Date(2026, 4, 4, 0, 30);
    expect(dateKeyFromTimestamp(date.toISOString())).toBe('2026-05-04');
    expect(dateKeyFromTimestamp(null)).toBeNull();
    expect(dateKeyFromTimestamp('nonsense')).toBeNull();
  });
});

describe('weeks and months', () => {
  it('supports the three allowed week starts', () => {
    expect(startOfWeekKey('2026-05-06', 1)).toBe('2026-05-04');
    expect(startOfWeekKey('2026-05-06', 0)).toBe('2026-05-03');
    expect(startOfWeekKey('2026-05-06', 6)).toBe('2026-05-02');
    expect(weekRange('2026-05-06', 1)).toEqual({
      start: '2026-05-04',
      end: '2026-05-10',
    });
    expect(getWeekDays('2026-05-06', 1)).toEqual([
      '2026-05-04',
      '2026-05-05',
      '2026-05-06',
      '2026-05-07',
      '2026-05-08',
      '2026-05-09',
      '2026-05-10',
    ]);
  });

  it('returns a stable six-week month grid', () => {
    const grid = getMonthGrid(2026, 4, 1);
    expect(grid).toHaveLength(42);
    expect(grid[0]?.key).toBe('2026-04-27');
    expect(grid[0]?.inCurrentMonth).toBe(false);
    expect(grid.filter((cell) => cell.inCurrentMonth)).toHaveLength(31);
    expect(monthRange('2026-05-19')).toEqual({
      start: '2026-05-01',
      end: '2026-05-31',
    });
  });
});

describe('time display', () => {
  it('normalizes time input helpers', () => {
    expect(minutesToTimeValue(0)).toBe('00:00');
    expect(minutesToTimeValue(600)).toBe('10:00');
    expect(minutesToTimeValue(1440)).toBe('23:59');
    expect(timeValueToMinutes('00:00')).toBe(0);
    expect(timeValueToMinutes('23:59')).toBe(1439);
    expect(timeValueToMinutes('24:00')).toBeNull();
    expect(timeValueToMinutes('9:5')).toBeNull();
  });

  it('formats durations and times in both formats', () => {
    expect(formatDuration(0)).toBe('0m');
    expect(formatDuration(90)).toBe('1h 30m');
    expect(formatDuration(120)).toBe('2h');
    expect(formatTime(0, '24h')).toBe('00:00');
    expect(formatTime(1080, '24h')).toBe('18:00');
    expect(formatTime(1080, '12h')).toBe('6:00 PM');
    expect(formatTime(0, '12h')).toBe('12:00 AM');
    expect(formatTimeCompact(1080, '12h')).toBe('6 PM');
    expect(formatTimeCompact(1110, '12h')).toBe('6:30 PM');
    expect(formatTimeRange(540, 600, '24h')).toBe('09:00–10:00');
    expect(formatTimeRange(540, 600, '12h')).toBe('9:00–10:00 AM');
    expect(formatTimeRange(690, 780, '12h')).toBe('11:30 AM–1:00 PM');
  });
});
