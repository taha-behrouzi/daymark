import { describe, expect, it } from 'vitest';
import {
  comparePlanTasks,
  findEarliestOpening,
  findOpening,
  findOverlaps,
  generatePlan,
  getFreeGaps,
  mergeIntervals,
  normalizeInterval,
  preferredPeriodWindow,
  type PlanTaskInput,
} from './scheduler';

const DATE = '2026-05-04';
const CREATED = '2026-05-01T09:00:00.000Z';

function task(overrides: Partial<PlanTaskInput> & { id: string }): PlanTaskInput {
  return {
    title: `Task ${overrides.id}`,
    dueDate: null,
    importance: 'none',
    completed: false,
    focusDate: null,
    focusOrder: null,
    estimateMinutes: 30,
    preferredPeriod: 'any',
    createdAt: CREATED,
    ...overrides,
  };
}

const baseOptions = {
  date: DATE,
  dayStartMin: 8 * 60,
  dayEndMin: 11 * 60,
  breakMinutes: 0,
  breakAfterMinutes: 90,
  fixedBlocks: [],
};

describe('interval helpers', () => {
  it('normalizes and merges overlapping and touching intervals', () => {
    expect(normalizeInterval({ startMin: -10, endMin: 90.4 })).toEqual({
      startMin: 0,
      endMin: 90,
    });
    expect(normalizeInterval({ startMin: 60, endMin: 60 })).toBeNull();
    expect(
      mergeIntervals([
        { startMin: 600, endMin: 660 },
        { startMin: 630, endMin: 720 },
        { startMin: 720, endMin: 780 },
        { startMin: 900, endMin: 930 },
      ]),
    ).toEqual([
      { startMin: 600, endMin: 780 },
      { startMin: 900, endMin: 930 },
    ]);
  });

  it('finds the first opening that fits, including after a busy block', () => {
    expect(findOpening([{ startMin: 540, endMin: 600 }], 480, 660, 30)).toBe(480);
    expect(findOpening([{ startMin: 480, endMin: 540 }], 480, 660, 60)).toBe(540);
    expect(findOpening([{ startMin: 480, endMin: 540 }], 480, 600, 90)).toBeNull();
    expect(
      findOpening(
        [
          { startMin: 480, endMin: 540 },
          { startMin: 560, endMin: 660 },
        ],
        480,
        660,
        30,
      ),
    ).toBeNull();
  });

  it('returns free gaps clipped to the day window', () => {
    expect(
      getFreeGaps(
        [
          { startMin: 420, endMin: 540 },
          { startMin: 600, endMin: 780 },
        ],
        { startMin: 480, endMin: 720 },
      ),
    ).toEqual([{ startMin: 540, endMin: 600 }]);
  });

  it('reports every real overlap but not touching blocks', () => {
    const overlaps = findOverlaps([
      { startMin: 480, endMin: 540, name: 'a' },
      { startMin: 540, endMin: 600, name: 'b' },
      { startMin: 570, endMin: 630, name: 'c' },
      { startMin: 590, endMin: 650, name: 'd' },
    ]);
    expect(overlaps.map(([first, second]) => `${first.name}${second.name}`)).toEqual([
      'bc',
      'bd',
      'cd',
    ]);
  });
});

describe('findEarliestOpening', () => {
  it('respects a preferred period when possible', () => {
    expect(
      findEarliestOpening({
        busy: [],
        window: { startMin: 8 * 60, endMin: 18 * 60 },
        duration: 60,
        preferredPeriod: 'afternoon',
      }),
    ).toEqual({ startMin: 12 * 60, respectedPreference: true });
  });

  it('falls back outside the preferred period and says so', () => {
    expect(
      findEarliestOpening({
        busy: [],
        window: { startMin: 7 * 60, endMin: 10 * 60 },
        duration: 60,
        preferredPeriod: 'evening',
      }),
    ).toEqual({ startMin: 7 * 60, respectedPreference: false });
  });
});

describe('generatePlan', () => {
  it('places today’s priorities first, in their chosen order', () => {
    const tasks = [
      task({ id: 'c', focusDate: DATE, focusOrder: 2, dueDate: DATE, importance: 'high' }),
      task({ id: 'a', focusDate: DATE, focusOrder: 0 }),
      task({ id: 'b', focusDate: DATE, focusOrder: 1, dueDate: DATE }),
    ];
    const result = generatePlan(tasks, baseOptions);
    expect(result.blocks.map((block) => block.taskId ?? block.type)).toEqual(['a', 'b', 'c']);
    expect(result.blocks[0]?.startMin).toBe(480);
    expect(result.blocks[0]?.endMin).toBe(510);
    expect(result.unscheduled).toEqual([]);
  });

  it('sorts by deadline, then importance, then a stable id tiebreak', () => {
    const tasks = [
      task({ id: 'later', dueDate: '2026-05-04', importance: 'high' }),
      task({ id: 'overdue', dueDate: '2026-05-02', importance: 'low' }),
      task({ id: 'high', dueDate: '2026-05-03', importance: 'high' }),
      task({ id: 'same-b', dueDate: '2026-05-03', importance: 'high' }),
      task({ id: 'completed', dueDate: '2026-05-01', completed: true }),
      task({ id: 'not-eligible' }),
    ];
    const result = generatePlan(tasks, baseOptions);
    expect(result.blocks.map((block) => block.taskId)).toEqual([
      'overdue',
      'high',
      'same-b',
      'later',
    ]);
    expect(result.unscheduled).toEqual([]);
  });

  it('avoids fixed blocks and never returns overlapping work', () => {
    const result = generatePlan(
      [task({ id: 'a', dueDate: DATE, estimateMinutes: 60 }), task({ id: 'b', dueDate: DATE })],
      {
        ...baseOptions,
        fixedBlocks: [{ startMin: 8 * 60, endMin: 9 * 60, title: 'Standup' }],
      },
    );
    expect(result.blocks.map((block) => [block.taskId, block.startMin, block.endMin])).toEqual([
      ['a', 540, 600],
      ['b', 600, 630],
    ]);
  });

  it('does not auto-schedule a task already placed manually', () => {
    const result = generatePlan(
      [task({ id: 'a', dueDate: DATE })],
      {
        ...baseOptions,
        fixedBlocks: [{ startMin: 480, endMin: 510, taskId: 'a', title: 'Manual a' }],
      },
    );
    expect(result.blocks).toEqual([]);
    expect(result.unscheduled).toEqual([]);
  });

  it('honors a preferred period and warns honestly on fallback', () => {
    const result = generatePlan(
      [task({ id: 'morning', dueDate: DATE, preferredPeriod: 'morning', estimateMinutes: 30 })],
      baseOptions,
    );
    expect(result.blocks[0]).toMatchObject({ taskId: 'morning', startMin: 480 });
    expect(result.warnings).toEqual([]);

    const fallback = generatePlan(
      [task({ id: 'evening', dueDate: DATE, preferredPeriod: 'evening' })],
      baseOptions,
    );
    expect(fallback.blocks[0]).toMatchObject({ taskId: 'evening', startMin: 480 });
    expect(fallback.warnings[0]).toContain('could not fit in the evening');
  });

  it('inserts a break after the configured amount of work', () => {
    const result = generatePlan(
      [
        task({ id: 'a', dueDate: DATE, estimateMinutes: 60 }),
        task({ id: 'b', dueDate: DATE, estimateMinutes: 60 }),
      ],
      {
        ...baseOptions,
        dayEndMin: 12 * 60,
        breakMinutes: 15,
        breakAfterMinutes: 60,
      },
    );
    expect(result.blocks).toEqual([
      { type: 'task', source: 'generated', taskId: 'a', title: 'Task a', startMin: 480, endMin: 540 },
      { type: 'break', source: 'generated', taskId: null, title: 'Break', startMin: 540, endMin: 555 },
      { type: 'task', source: 'generated', taskId: 'b', title: 'Task b', startMin: 555, endMin: 615 },
    ]);
    expect(result.breakMinutesPlanned).toBe(15);
    expect(result.scheduledMinutes).toBe(120);
  });

  it('returns unscheduled work with a reason instead of dropping it', () => {
    const result = generatePlan(
      [task({ id: 'big', dueDate: DATE, estimateMinutes: 180 })],
      { ...baseOptions, dayEndMin: 9 * 60 },
    );
    expect(result.blocks).toEqual([]);
    expect(result.unscheduled).toHaveLength(1);
    expect(result.unscheduled[0]).toMatchObject({ taskId: 'big', reason: 'no-space' });
    expect(result.unscheduled[0]?.detail).toContain('60 minutes remain');
  });

  it('handles an empty day window without inventing time', () => {
    const result = generatePlan([task({ id: 'a', dueDate: DATE })], {
      ...baseOptions,
      dayStartMin: 1_000,
      dayEndMin: 900,
    });
    expect(result.blocks).toEqual([]);
    expect(result.unscheduled[0]).toMatchObject({ reason: 'window-too-small' });
    expect(result.freeMinutesRemaining).toBe(0);
  });

  it('is deterministic for identical inputs', () => {
    const tasks = [
      task({ id: 'a', dueDate: DATE }),
      task({ id: 'b', dueDate: DATE }),
      task({ id: 'c', dueDate: DATE }),
    ];
    const first = generatePlan(tasks, baseOptions);
    const second = generatePlan([...tasks].reverse(), baseOptions);
    expect(second.blocks).toEqual(first.blocks);
  });

  it('compares eligible tasks with documented ordering', () => {
    const priority = task({ id: 'p', focusDate: DATE, focusOrder: 2 });
    const due = task({ id: 'd', dueDate: DATE, importance: 'low' });
    const dueHigh = task({ id: 'h', dueDate: DATE, importance: 'high' });
    expect(comparePlanTasks(priority, due, DATE)).toBeLessThan(0);
    expect(comparePlanTasks(dueHigh, due, DATE)).toBeLessThan(0);
  });

  it('exposes preferred period windows as half-open intervals', () => {
    expect(preferredPeriodWindow('morning')).toEqual({ startMin: 300, endMin: 720 });
    expect(preferredPeriodWindow('afternoon')).toEqual({ startMin: 720, endMin: 1020 });
    expect(preferredPeriodWindow('evening')).toEqual({ startMin: 1020, endMin: 1320 });
    expect(preferredPeriodWindow('any')).toBeNull();
  });
});
