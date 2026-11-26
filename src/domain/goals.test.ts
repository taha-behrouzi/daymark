import { describe, expect, it } from 'vitest';
import {
  addGoal,
  computeMilestoneProgress,
  deleteGoal,
  setGoalProgress,
  setGoalStatus,
  toggleGoalMilestone,
  updateGoal,
} from './goals';
import { makeData, FIXED_NOW } from '../test/factories';

const TARGET = '2026-12-31';

function withGoal(data = makeData()) {
  const next = addGoal(
    data,
    {
      title: '  Finish the portfolio  ',
      description: '  A small, honest home.  ',
      categoryId: 'cat-work',
      targetDate: TARGET,
      milestones: [
        { title: 'Wireframe' },
        { title: 'Build' },
        { title: 'Publish' },
      ],
    },
    FIXED_NOW,
  );
  return { data: next, goal: next.goals[0]! };
}

describe('goal creation', () => {
  it('trims input and derives progress from milestones', () => {
    const { goal } = withGoal();
    expect(goal).toMatchObject({
      title: 'Finish the portfolio',
      description: 'A small, honest home.',
      categoryId: 'cat-work',
      targetDate: TARGET,
      progress: 0,
      status: 'active',
      completedAt: null,
    });
    expect(goal.milestones.map((milestone) => milestone.title)).toEqual([
      'Wireframe',
      'Build',
      'Publish',
    ]);
    expect(goal.milestones.every((milestone) => !milestone.done)).toBe(true);
    expect(goal.createdAt).toBe(FIXED_NOW.toISOString());
  });

  it('rejects empty titles, unknown categories, and invalid dates', () => {
    const data = makeData();
    expect(() =>
      addGoal(data, { title: '  ', categoryId: 'cat-work', targetDate: TARGET }),
    ).toThrow('Give the goal a title');
    expect(() =>
      addGoal(data, { title: 'x', categoryId: 'cat-missing', targetDate: TARGET }),
    ).toThrow('Choose an existing category');
    expect(() =>
      addGoal(data, { title: 'x', categoryId: 'cat-work', targetDate: '2026-02-30' }),
    ).toThrow('valid target date');
  });
});

describe('goal milestones', () => {
  it('computes rounded progress from completed milestones', () => {
    expect(computeMilestoneProgress([])).toBeNull();
    expect(
      computeMilestoneProgress([
        { id: 'a', title: 'A', done: true },
        { id: 'b', title: 'B', done: false },
        { id: 'c', title: 'C', done: false },
      ]),
    ).toBe(33);
  });

  it('syncs progress when a milestone is toggled', () => {
    const { data, goal } = withGoal();
    const first = goal.milestones[0]!;
    const next = toggleGoalMilestone(data, goal.id, first.id, FIXED_NOW);
    expect(next.goals[0]?.progress).toBe(33);
    expect(next.goals[0]?.milestones[0]?.done).toBe(true);

    const reverted = toggleGoalMilestone(next, goal.id, first.id, FIXED_NOW);
    expect(reverted.goals[0]?.progress).toBe(0);
  });

  it('refuses to edit milestones on a goal that is not active', () => {
    const { data, goal } = withGoal();
    const completed = setGoalStatus(data, goal.id, 'archived', FIXED_NOW);
    expect(() =>
      toggleGoalMilestone(completed, goal.id, goal.milestones[0]!.id, FIXED_NOW),
    ).toThrow('Reopen this goal');
  });
});

describe('goal status', () => {
  it('records completion at 100% and restores honest progress on reopen', () => {
    const { data, goal } = withGoal();
    const first = goal.milestones[0]!;
    const oneThird = toggleGoalMilestone(data, goal.id, first.id, FIXED_NOW);

    const completed = setGoalStatus(oneThird, goal.id, 'completed', FIXED_NOW);
    expect(completed.goals[0]).toMatchObject({
      status: 'completed',
      progress: 100,
      completedAt: FIXED_NOW.toISOString(),
    });

    const reopened = setGoalStatus(completed, goal.id, 'active', FIXED_NOW);
    expect(reopened.goals[0]).toMatchObject({
      status: 'active',
      progress: 33,
      completedAt: null,
    });
  });

  it('keeps hand-set progress when a goal has no milestones', () => {
    const base = addGoal(
      makeData(),
      { title: 'Read more', categoryId: 'cat-study', targetDate: TARGET },
      FIXED_NOW,
    );
    const goal = base.goals[0]!;
    const progressed = setGoalProgress(base, goal.id, 40, FIXED_NOW);
    const completed = setGoalStatus(progressed, goal.id, 'completed', FIXED_NOW);
    const reopened = setGoalStatus(completed, goal.id, 'active', FIXED_NOW);
    expect(reopened.goals[0]?.progress).toBe(100);
  });

  it('archives a completed goal without losing completion details', () => {
    const { data, goal } = withGoal();
    const completed = setGoalStatus(data, goal.id, 'completed', FIXED_NOW);
    const archived = setGoalStatus(completed, goal.id, 'archived', FIXED_NOW);
    expect(archived.goals[0]).toMatchObject({
      status: 'archived',
      progress: 100,
      completedAt: FIXED_NOW.toISOString(),
    });
  });
});

describe('goal edits and deletion', () => {
  it('updates fields, milestones, and progress', () => {
    const { data, goal } = withGoal();
    const next = updateGoal(
      data,
      goal.id,
      {
        title: 'Finish the new portfolio',
        milestones: [{ id: goal.milestones[0]!.id, title: 'Wireframe', done: true }],
        progress: 50,
      },
      FIXED_NOW,
    );
    expect(next.goals[0]).toMatchObject({
      title: 'Finish the new portfolio',
      progress: 50,
    });
    expect(next.goals[0]?.milestones).toHaveLength(1);
    expect(next.goals[0]?.milestones[0]?.done).toBe(true);
  });

  it('deletes only the requested goal', () => {
    const { data, goal } = withGoal();
    const extra = addGoal(
      data,
      { title: 'Read twelve books', categoryId: 'cat-study', targetDate: TARGET },
      FIXED_NOW,
    );
    const next = deleteGoal(extra, goal.id);
    expect(next.goals.map((candidate) => candidate.title)).toEqual([
      'Read twelve books',
    ]);
    expect(() => deleteGoal(next, goal.id)).toThrow('no longer exists');
  });
});
