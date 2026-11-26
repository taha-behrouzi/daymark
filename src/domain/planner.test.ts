import { describe, expect, it } from 'vitest';
import {
  addScheduleBlock,
  applyGeneratedPlan,
  blocksForDate,
  clearGeneratedPlan,
  deleteScheduleBlock,
  getPlannerDay,
  resetPlannerDay,
  scheduleConflictsForDate,
  scheduleTaskAt,
  updatePlannerDay,
  updateScheduleBlock,
} from './planner';
import type { PlannedBlock } from './scheduler';
import { makeData, taskByTitle, withTask } from '../test/factories';

const DATE = '2026-05-04';
const OTHER_DATE = '2026-05-05';
const NOW = new Date('2026-05-01T09:00:00.000Z');

function taskBlock(taskId: string, title: string, startMin: number, endMin: number): PlannedBlock {
  return {
    type: 'task',
    source: 'generated',
    taskId,
    title,
    startMin,
    endMin,
  };
}

describe('day hours', () => {
  it('uses weekly defaults until a day overrides them', () => {
    const data = makeData();
    expect(getPlannerDay(data, DATE)).toEqual({
      startMin: 480,
      endMin: 1080,
      breakMinutes: 15,
      breakAfterMinutes: 90,
    });
    const updated = updatePlannerDay(data, DATE, { startMin: 600, endMin: 960 });
    expect(getPlannerDay(updated, DATE)).toEqual({
      startMin: 600,
      endMin: 960,
      breakMinutes: 15,
      breakAfterMinutes: 90,
    });
    expect(getPlannerDay(updated, OTHER_DATE).startMin).toBe(480);
  });

  it('validates windows and resets an override without touching others', () => {
    const data = makeData();
    expect(() => updatePlannerDay(data, DATE, { startMin: 600, endMin: 600 })).toThrow(
      'later than the start time',
    );
    expect(() => updatePlannerDay(data, DATE, { startMin: 600, endMin: 610 })).toThrow(
      'at least 15 minutes',
    );
    let updated = updatePlannerDay(data, DATE, { startMin: 600, endMin: 960 });
    updated = updatePlannerDay(updated, OTHER_DATE, { startMin: 540, endMin: 900 });
    updated = resetPlannerDay(updated, DATE);
    expect(getPlannerDay(updated, DATE).startMin).toBe(480);
    expect(getPlannerDay(updated, OTHER_DATE).startMin).toBe(540);
    expect(resetPlannerDay(updated, '2026-05-06')).toBe(updated);
  });
});

describe('manual schedule blocks', () => {
  it('adds an event, trims notes, and rejects overlaps', () => {
    let data = addScheduleBlock(
      makeData(),
      {
        date: DATE,
        startMin: 540,
        endMin: 600,
        type: 'event',
        title: '  Dentist  ',
        notes: '  bring forms  ',
      },
      NOW,
    );
    const block = blocksForDate(data, DATE)[0];
    expect(block).toMatchObject({
      type: 'event',
      title: 'Dentist',
      notes: 'bring forms',
      source: 'manual',
      taskId: null,
      startMin: 540,
      endMin: 600,
    });
    expect(block?.createdAt).toBe(NOW.toISOString());
    expect(() =>
      addScheduleBlock(data, {
        date: DATE,
        startMin: 570,
        endMin: 630,
        type: 'event',
        title: 'Overlap',
      }),
    ).toThrow('overlaps “Dentist”');
    data = deleteScheduleBlock(data, block?.id as string);
    expect(blocksForDate(data, DATE)).toEqual([]);
  });

  it('links a task block and prevents scheduling that task twice in a day', () => {
    let data = withTask(makeData(), { title: 'Write report', estimateMinutes: 45 });
    const task = taskByTitle(data, 'Write report');
    data = addScheduleBlock(
      data,
      {
        date: DATE,
        startMin: 480,
        endMin: 525,
        type: 'task',
        taskId: task.id,
      },
      NOW,
    );
    expect(blocksForDate(data, DATE)[0]?.title).toBe('Write report');
    expect(() =>
      addScheduleBlock(data, {
        date: DATE,
        startMin: 600,
        endMin: 645,
        type: 'task',
        taskId: task.id,
      }),
    ).toThrow('already scheduled');
    expect(() =>
      addScheduleBlock(data, {
        date: OTHER_DATE,
        startMin: 600,
        endMin: 645,
        type: 'task',
        taskId: task.id,
      }),
    ).not.toThrow();
  });

  it('requires titles for events but not breaks', () => {
    const data = makeData();
    expect(() =>
      addScheduleBlock(data, {
        date: DATE,
        startMin: 480,
        endMin: 510,
        type: 'event',
        title: '   ',
      }),
    ).toThrow('title');
    let withBreak = addScheduleBlock(data, {
      date: DATE,
      startMin: 480,
      endMin: 495,
      type: 'break',
    });
    expect(blocksForDate(withBreak, DATE)[0]?.title).toBe('Break');
    withBreak = addScheduleBlock(withBreak, {
      date: DATE,
      startMin: 500,
      endMin: 515,
      type: 'break',
      title: 'Tea',
    });
    expect(blocksForDate(withBreak, DATE).find((block) => block.title === 'Tea')?.type).toBe(
      'break',
    );
  });

  it('converts a generated block to manual when edited', () => {
    const data = withTask(makeData(), { title: 'Review' });
    const task = taskByTitle(data, 'Review');
    const planned = applyGeneratedPlan(data, DATE, [taskBlock(task.id, 'Review', 480, 510)]);
    const generated = blocksForDate(planned, DATE)[0];
    expect(generated?.source).toBe('generated');
    const edited = updateScheduleBlock(planned, generated?.id as string, {
      startMin: 600,
      endMin: 630,
    });
    expect(blocksForDate(edited, DATE)[0]).toMatchObject({
      source: 'manual',
      startMin: 600,
      endMin: 630,
    });
  });

  it('validates moving blocks and honors ignore-self overlap checks', () => {
    let data = addScheduleBlock(makeData(), {
      date: DATE,
      startMin: 480,
      endMin: 540,
      type: 'event',
      title: 'Focus',
    });
    const first = blocksForDate(data, DATE)[0];
    data = addScheduleBlock(data, {
      date: DATE,
      startMin: 600,
      endMin: 660,
      type: 'event',
      title: 'Call',
    });
    const second = blocksForDate(data, DATE)[1];
    expect(() =>
      updateScheduleBlock(data, first?.id as string, { startMin: 570, endMin: 630 }),
    ).toThrow('overlaps “Call”');
    const moved = updateScheduleBlock(data, second?.id as string, {
      startMin: 540,
      endMin: 600,
    });
    expect(blocksForDate(moved, DATE).map((block) => block.title)).toEqual(['Focus', 'Call']);
    expect(() =>
      updateScheduleBlock(moved, first?.id as string, { startMin: 700, endMin: 690 }),
    ).toThrow('five minutes');
  });

  it('detects imported overlaps for display without preventing import', () => {
    const data = makeData();
    const overlapping = {
      ...data,
      blocks: [
        {
          id: 'block-a',
          date: DATE,
          startMin: 480,
          endMin: 540,
          type: 'event' as const,
          source: 'manual' as const,
          title: 'A',
          taskId: null,
          notes: '',
          createdAt: NOW.toISOString(),
        },
        {
          id: 'block-b',
          date: DATE,
          startMin: 510,
          endMin: 570,
          type: 'event' as const,
          source: 'manual' as const,
          title: 'B',
          taskId: null,
          notes: '',
          createdAt: NOW.toISOString(),
        },
      ],
    };
    expect(scheduleConflictsForDate(overlapping, DATE)).toHaveLength(1);
    expect(scheduleConflictsForDate(overlapping, OTHER_DATE)).toHaveLength(0);
  });
});

describe('generated plans', () => {
  it('replaces generated blocks but preserves hand-placed blocks', () => {
    let data = withTask(makeData(), { title: 'Write' });
    const task = taskByTitle(data, 'Write');
    data = addScheduleBlock(
      data,
      {
        date: DATE,
        startMin: 480,
        endMin: 510,
        type: 'event',
        title: 'Standup',
      },
      NOW,
    );
    const manualId = blocksForDate(data, DATE)[0]?.id;
    data = applyGeneratedPlan(data, DATE, [taskBlock(task.id, 'Write', 540, 570)], NOW);
    expect(blocksForDate(data, DATE)).toHaveLength(2);
    expect(blocksForDate(data, DATE)[0]?.id).toBe(manualId);

    data = clearGeneratedPlan(data, DATE);
    expect(blocksForDate(data, DATE)).toHaveLength(1);
    expect(blocksForDate(data, DATE)[0]?.source).toBe('manual');
  });

  it('refuses a generated plan that conflicts with manual time', () => {
    let data = withTask(makeData(), { title: 'Write' });
    const task = taskByTitle(data, 'Write');
    data = addScheduleBlock(
      data,
      {
        date: DATE,
        startMin: 480,
        endMin: 540,
        type: 'event',
        title: 'Standup',
      },
      NOW,
    );
    expect(() =>
      applyGeneratedPlan(data, DATE, [taskBlock(task.id, 'Write', 510, 540)], NOW),
    ).toThrow('conflicts with “Standup”');
  });

  it('creates task blocks from the current task titles and ids', () => {
    let data = withTask(makeData(), { title: 'Draft' });
    const task = taskByTitle(data, 'Draft');
    data = applyGeneratedPlan(data, DATE, [taskBlock(task.id, 'Stale title', 480, 510)], NOW);
    expect(blocksForDate(data, DATE)[0]).toMatchObject({
      title: 'Draft',
      taskId: task.id,
      type: 'task',
      source: 'generated',
    });
  });

  it('schedules a task at the requested time using its estimate', () => {
    let data = withTask(makeData(), { title: 'Call', estimateMinutes: 45 });
    const task = taskByTitle(data, 'Call');
    data = scheduleTaskAt(data, task.id, DATE, 600, NOW);
    expect(blocksForDate(data, DATE)[0]).toMatchObject({
      startMin: 600,
      endMin: 645,
      type: 'task',
      taskId: task.id,
      source: 'manual',
    });
    expect(() => scheduleTaskAt(data, task.id, DATE, 660, NOW)).toThrow('already scheduled');
  });
});
