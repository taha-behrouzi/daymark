import { describe, expect, it } from 'vitest';
import {
  createTask,
  deleteTask,
  focusTasksForDate,
  moveFocusTask,
  nextFocusOrder,
  removeTaskFocus,
  reorderFocusTasks,
  setTaskCompletion,
  setTaskFocus,
  toggleTaskCompletion,
  updateTask,
} from './tasks';
import { makeData, taskByTitle, withTask } from '../test/factories';

const DATE = '2026-05-04';
const NEXT_DATE = '2026-05-05';

describe('task creation and validation', () => {
  it('trims text, applies defaults, and creates a stable task', () => {
    const data = withTask(makeData(), { title: '  Read a chapter  ' });
    const task = data.tasks[0];
    expect(task).toMatchObject({
      title: 'Read a chapter',
      description: '',
      dueDate: null,
      importance: 'none',
      categoryId: 'cat-personal',
      completed: false,
      estimateMinutes: 30,
      preferredPeriod: 'any',
      focusDate: null,
      focusOrder: null,
    });
    expect(task?.createdAt).toBe('2026-05-01T09:00:00.000Z');
  });

  it('rejects empty titles, bad categories, invalid dates and estimates', () => {
    const data = makeData();
    expect(() => createTask(data, { title: '   ', categoryId: 'cat-personal' })).toThrow(
      'Give the task a title',
    );
    expect(() => createTask(data, { title: 'x', categoryId: 'cat-missing' })).toThrow(
      'Choose an existing category',
    );
    expect(() =>
      createTask(data, { title: 'x', categoryId: 'cat-personal', dueDate: '2026-02-30' }),
    ).toThrow('valid due date');
    expect(() =>
      createTask(data, { title: 'x', categoryId: 'cat-personal', estimateMinutes: 4 }),
    ).toThrow('between 5 minutes and 8 hours');
  });

  it('updates the task and any linked block title together', () => {
    let data = withTask(makeData(), { title: 'Old title' });
    const task = taskByTitle(data, 'Old title');
    data = {
      ...data,
      blocks: [
        {
          id: 'block-1',
          date: DATE,
          startMin: 480,
          endMin: 510,
          type: 'task',
          source: 'manual',
          title: 'Old title',
          taskId: task.id,
          notes: '',
          createdAt: '2026-05-01T09:00:00.000Z',
        },
      ],
    };
    const updated = updateTask(data, task.id, { title: 'New title', estimateMinutes: 45 });
    expect(updated.tasks[0]).toMatchObject({ title: 'New title', estimateMinutes: 45 });
    expect(updated.blocks[0]?.title).toBe('New title');
  });
});

describe('completion', () => {
  it('records a timestamp on completion and clears it on reopen', () => {
    let data = withTask(makeData(), { title: 'Finish me' });
    const task = taskByTitle(data, 'Finish me');
    const now = new Date('2026-05-04T15:30:00.000Z');

    data = setTaskCompletion(data, task.id, true, now);
    expect(data.tasks[0]).toMatchObject({
      completed: true,
      completedAt: '2026-05-04T15:30:00.000Z',
    });

    data = toggleTaskCompletion(data, task.id, new Date('2026-05-05T08:00:00.000Z'));
    expect(data.tasks[0]).toMatchObject({ completed: false, completedAt: null });
  });

  it('is idempotent when the task is already in the requested state', () => {
    const data = withTask(makeData(), { title: 'Still open' });
    const task = taskByTitle(data, 'Still open');
    expect(setTaskCompletion(data, task.id, false)).toBe(data);
  });

  it('does not remove a completed task from its priorities', () => {
    let data = withTask(makeData(), { title: 'Priority', focusDate: DATE });
    const task = taskByTitle(data, 'Priority');
    data = setTaskCompletion(data, task.id, true);
    expect(data.tasks[0]?.focusDate).toBe(DATE);
    expect(data.tasks[0]?.focusOrder).toBe(0);
  });
});

describe('daily priorities', () => {
  it('allows at most three priorities per date', () => {
    let data = makeData();
    for (const title of ['One', 'Two', 'Three']) {
      data = withTask(data, { title, focusDate: DATE });
    }
    expect(focusTasksForDate(data, DATE)).toHaveLength(3);
    expect(nextFocusOrder(data.tasks, DATE)).toBeNull();
    expect(() => withTask(data, { title: 'Four', focusDate: DATE })).toThrow(
      'already have three priorities',
    );
  });

  it('tracks priorities separately by date', () => {
    const data = withTask(makeData(), { title: 'Today', focusDate: DATE });
    expect(() =>
      withTask(data, { title: 'Tomorrow', focusDate: NEXT_DATE, categoryId: 'cat-personal' }),
    ).not.toThrow();
    expect(focusTasksForDate(data, DATE)).toHaveLength(1);
  });

  it('reorders priorities and compacts the remaining order slots', () => {
    let data = makeData();
    for (const title of ['One', 'Two', 'Three']) {
      data = withTask(data, { title, focusDate: DATE });
    }
    const order = focusTasksForDate(data, DATE).map((task) => task.id);

    data = reorderFocusTasks(data, DATE, [order[2] as string, order[0] as string, order[1] as string]);
    expect(focusTasksForDate(data, DATE).map((task) => task.title)).toEqual([
      'Three',
      'One',
      'Two',
    ]);

    data = moveFocusTask(data, order[0] as string, -1);
    expect(focusTasksForDate(data, DATE).map((task) => task.title)).toEqual([
      'One',
      'Three',
      'Two',
    ]);

    data = removeTaskFocus(data, order[1] as string);
    expect(focusTasksForDate(data, DATE).map((task) => task.focusOrder)).toEqual([0, 1]);
  });

  it('removes and re-adds a priority without leaving duplicates', () => {
    let data = withTask(makeData(), { title: 'Move me', focusDate: DATE });
    const task = taskByTitle(data, 'Move me');
    data = setTaskFocus(data, task.id, NEXT_DATE);
    expect(data.tasks[0]).toMatchObject({ focusDate: NEXT_DATE, focusOrder: 0 });
    data = setTaskFocus(data, task.id, DATE);
    expect(data.tasks[0]).toMatchObject({ focusDate: DATE, focusOrder: 0 });
    expect(() => setTaskFocus(data, task.id, 'not-a-date')).toThrow('valid priority date');
  });

  it('refuses priorities that would exceed three slots', () => {
    let data = makeData();
    for (const title of ['One', 'Two', 'Three']) {
      data = withTask(data, { title, focusDate: DATE });
    }
    data = withTask(data, { title: 'Later' });
    const later = taskByTitle(data, 'Later');
    expect(() => setTaskFocus(data, later.id, DATE)).toThrow('already have three priorities');
  });

  it('rejects reordering data that is out of date', () => {
    const data = withTask(makeData(), { title: 'One', focusDate: DATE });
    expect(() => reorderFocusTasks(data, DATE, [])).toThrow('out of date');
    expect(() => reorderFocusTasks(data, DATE, ['task-missing'])).toThrow('out of date');
  });
});

describe('deletion and focus order', () => {
  it('deletes a task, its blocks, and closes the gap in priority order', () => {
    let data = makeData();
    for (const title of ['One', 'Two', 'Three']) {
      data = withTask(data, { title, focusDate: DATE });
    }
    const middle = taskByTitle(data, 'Two');
    const remaining = taskByTitle(data, 'Three');
    data = {
      ...data,
      blocks: [
        {
          id: 'block-1',
          date: DATE,
          startMin: 480,
          endMin: 510,
          type: 'task',
          source: 'manual',
          title: 'Two',
          taskId: middle.id,
          notes: '',
          createdAt: '2026-05-01T09:00:00.000Z',
        },
      ],
    };
    data = deleteTask(data, middle.id);
    expect(data.tasks).toHaveLength(2);
    expect(data.blocks).toHaveLength(0);
    const third = data.tasks.find((task) => task.id === remaining.id);
    expect(third?.focusOrder).toBe(1);
  });

  it('refuses operations on a missing task', () => {
    const data = makeData();
    expect(() => deleteTask(data, 'task-missing')).toThrow('no longer exists');
    expect(() => setTaskFocus(data, 'task-missing', DATE)).toThrow('no longer exists');
  });
});
