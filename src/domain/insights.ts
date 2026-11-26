import {
  addDays,
  dateKeyFromTimestamp,
  diffCalendarDays,
  getLastNDays,
  monthRange,
  todayKey,
  weekRange,
} from '../lib/date';
import type { AppData, Goal, Task } from '../types';

export interface DailyActivity {
  date: string;
  count: number;
}

export interface WeekdayActivity {
  weekday: number;
  count: number;
}

export interface Insights {
  totalTasks: number;
  completedTasks: number;
  completionRate: number;
  completedThisWeek: number;
  completedLastWeek: number;
  completedThisMonth: number;
  activity: DailyActivity[];
  weekdayActivity: WeekdayActivity[];
  topWeekdays: WeekdayActivity[];
  currentStreak: number;
  bestStreak: number;
  activeGoals: Goal[];
  completedGoalCount: number;
  averageGoalProgress: number;
  hasCompletionData: boolean;
  weekStart: string;
  weekEnd: string;
  monthStart: string;
  monthEnd: string;
}

function completionKeys(tasks: Task[]): string[] {
  return tasks
    .map((task) => dateKeyFromTimestamp(task.completedAt))
    .filter((key): key is string => key !== null)
    .sort();
}

function countInRange(keys: string[], start: string, end: string): number {
  return keys.reduce((count, key) => (key >= start && key <= end ? count + 1 : count), 0);
}

function currentStreakFrom(dates: Set<string>, today: string): number {
  if (dates.size === 0) return 0;
  let cursor = dates.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (dates.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

function bestStreakFrom(sortedDates: string[]): number {
  if (sortedDates.length === 0) return 0;
  const unique = [...new Set(sortedDates)];
  let best = 1;
  let current = 1;
  for (let index = 1; index < unique.length; index += 1) {
    const gap = diffCalendarDays(unique[index - 1], unique[index]);
    if (gap === 1) {
      current += 1;
      best = Math.max(best, current);
    } else if (gap > 1) {
      current = 1;
    }
  }
  return best;
}

export function computeInsights(
  data: AppData,
  today: string = todayKey(),
): Insights {
  const allCompletionKeys = completionKeys(data.tasks);
  const week = weekRange(today, data.settings.weekStartsOn);
  const month = monthRange(today);
  const lastWeekStart = addDays(week.start, -7);
  const lastWeekEnd = addDays(week.end, -7);
  const completionDates = new Set(allCompletionKeys);
  const completedTasks = data.tasks.filter((task) => task.completed).length;
  const totalTasks = data.tasks.length;
  const activityDates = getLastNDays(today, 14);

  const weekdayCounts = Array.from({ length: 7 }, () => 0);
  for (const key of allCompletionKeys) {
    const date = new Date(`${key}T12:00:00`);
    weekdayCounts[date.getDay()] += 1;
  }
  const weekdayActivity = weekdayCounts.map((count, weekday) => ({ weekday, count }));
  const topWeekdays = [...weekdayActivity]
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count || a.weekday - b.weekday)
    .slice(0, 2);

  const activeGoals = data.goals
    .filter((goal) => goal.status === 'active')
    .sort((a, b) => a.targetDate.localeCompare(b.targetDate));
  const averageGoalProgress =
    activeGoals.length > 0
      ? Math.round(
          activeGoals.reduce((sum, goal) => sum + goal.progress, 0) / activeGoals.length,
        )
      : 0;

  return {
    totalTasks,
    completedTasks,
    completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
    completedThisWeek: countInRange(allCompletionKeys, week.start, week.end),
    completedLastWeek: countInRange(allCompletionKeys, lastWeekStart, lastWeekEnd),
    completedThisMonth: countInRange(allCompletionKeys, month.start, month.end),
    activity: activityDates.map((date) => ({
      date,
      count: completionDates.has(date) ? countOnDate(allCompletionKeys, date) : 0,
    })),
    weekdayActivity,
    topWeekdays,
    currentStreak: currentStreakFrom(completionDates, today),
    bestStreak: bestStreakFrom(allCompletionKeys),
    activeGoals,
    completedGoalCount: data.goals.filter((goal) => goal.status === 'completed').length,
    averageGoalProgress,
    hasCompletionData: allCompletionKeys.length > 0,
    weekStart: week.start,
    weekEnd: week.end,
    monthStart: month.start,
    monthEnd: month.end,
  };
}

function countOnDate(keys: string[], date: string): number {
  let count = 0;
  for (const key of keys) {
    if (key === date) count += 1;
  }
  return count;
}
