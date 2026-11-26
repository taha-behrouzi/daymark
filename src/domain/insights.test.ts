import { describe, expect, it } from 'vitest';
import { computeInsights } from './insights';
import { setTaskCompletion } from './tasks';
import { withTask } from '../test/factories';
import { makeData } from '../test/factories';

const TODAY = '2026-05-06';

function complete(
  data: ReturnType<typeof makeData>,
  title: string,
  at: string,
) {
  const task = data.tasks.find((candidate) => candidate.title === title);
  return setTaskCompletion(data, task?.id as string, true, new Date(`${at}T12:00:00.000Z`));
}

describe('computeInsights', () => {
  it('handles an empty workspace honestly', () => {
    const insights = computeInsights(makeData(), TODAY);
    expect(insights).toMatchObject({
      totalTasks: 0,
      completedTasks: 0,
      completionRate: 0,
      completedThisWeek: 0,
      completedLastWeek: 0,
      currentStreak: 0,
      bestStreak: 0,
      averageGoalProgress: 0,
      hasCompletionData: false,
    });
    expect(insights.activity).toHaveLength(14);
    expect(insights.activity.every((day) => day.count === 0)).toBe(true);
  });

  it('counts local completions by day, week, and weekday', () => {
    let data = makeData();
    for (const [title, at] of [
      ['Monday', '2026-05-04'],
      ['Tuesday', '2026-05-05'],
      ['Tuesday again', '2026-05-05'],
      ['Wednesday', '2026-05-06'],
      ['Last week', '2026-04-29'],
    ] as const) {
      data = withTask(data, { title });
      data = complete(data, title, at);
    }
    const insights = computeInsights(data, TODAY);
    expect(insights.totalTasks).toBe(5);
    expect(insights.completedTasks).toBe(5);
    expect(insights.completionRate).toBe(100);
    expect(insights.completedThisWeek).toBe(4);
    expect(insights.completedLastWeek).toBe(1);
    expect(insights.currentStreak).toBe(3);
    expect(insights.bestStreak).toBe(3);
    expect(insights.weekdayActivity[1]).toEqual({ weekday: 1, count: 1 });
    expect(insights.weekdayActivity[2]).toEqual({ weekday: 2, count: 2 });
    expect(insights.weekdayActivity[3]).toEqual({ weekday: 3, count: 2 });
    expect(insights.activity.find((day) => day.date === '2026-05-05')?.count).toBe(2);
    expect(insights.hasCompletionData).toBe(true);
    expect(insights.topWeekdays[0]).toEqual({ weekday: 2, count: 2 });
  });

  it('accepts a streak that reaches back to yesterday', () => {
    let data = makeData();
    data = withTask(data, { title: 'Yesterday' });
    data = setTaskCompletion(
      data,
      data.tasks[0]?.id as string,
      true,
      new Date('2026-05-05T23:30:00.000Z'),
    );
    expect(computeInsights(data, TODAY).currentStreak).toBe(1);
  });

  it('reports goal progress and counts only active goals in the average', () => {
    const data = makeData();
    const withGoal = {
      ...data,
      goals: [
        {
          id: 'goal-1',
          title: 'Active',
          description: '',
          categoryId: 'cat-personal',
          targetDate: '2026-06-01',
          progress: 40,
          status: 'active' as const,
          milestones: [],
          createdAt: '2026-05-01T09:00:00.000Z',
          updatedAt: '2026-05-01T09:00:00.000Z',
          completedAt: null,
        },
        {
          id: 'goal-2',
          title: 'Done',
          description: '',
          categoryId: 'cat-personal',
          targetDate: '2026-05-01',
          progress: 100,
          status: 'completed' as const,
          milestones: [],
          createdAt: '2026-05-01T09:00:00.000Z',
          updatedAt: '2026-05-01T09:00:00.000Z',
          completedAt: '2026-05-01T09:00:00.000Z',
        },
      ],
    };
    const insights = computeInsights(withGoal, TODAY);
    expect(insights.activeGoals).toHaveLength(1);
    expect(insights.averageGoalProgress).toBe(40);
    expect(insights.completedGoalCount).toBe(1);
  });

  it('counts completions by task completion timestamp, not due date', () => {
    let data = withTask(makeData(), { title: 'Late finish', dueDate: '2026-04-01' });
    data = setTaskCompletion(
      data,
      data.tasks[0]?.id as string,
      true,
      new Date('2026-05-06T08:00:00.000Z'),
    );
    const insights = computeInsights(data, TODAY);
    expect(insights.activity.find((day) => day.date === TODAY)?.count).toBe(1);
    expect(insights.completedThisWeek).toBe(1);
  });
});
