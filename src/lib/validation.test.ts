import { describe, expect, it } from 'vitest';
import {
  createExportPayload,
  DataValidationError,
  parseImportText,
  validateAppData,
} from './validation';
import { makeData, withTask } from '../test/factories';

function invalidMessage(fn: () => unknown): string {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(DataValidationError);
    return error instanceof Error ? error.message : '';
  }
  throw new Error('Expected a DataValidationError.');
}

describe('validateAppData', () => {
  it('round-trips the default workspace and drops unknown fields', () => {
    const data = makeData();
    const validated = validateAppData({ ...data, extra: 'ignored' });
    expect(validated).toEqual(data);
  });

  it('requires version 1 and the built-in Other category', () => {
    const data = makeData();
    expect(invalidMessage(() => validateAppData({ ...data, version: 2 }))).toContain(
      'version',
    );
    expect(
      invalidMessage(() =>
        validateAppData({
          ...data,
          categories: data.categories.filter((category) => category.id !== 'cat-other'),
        }),
      ),
    ).toContain('Other category');
  });

  it('rejects duplicate IDs and duplicate category names', () => {
    let data = withTask(makeData(), { title: 'One' });
    data = withTask(data, { title: 'Two' });
    const duplicate = {
      ...data,
      tasks: [data.tasks[0], { ...data.tasks[1], id: data.tasks[0]?.id }],
    };
    expect(invalidMessage(() => validateAppData(duplicate))).toContain('duplicate task IDs');

    const duplicateNames = {
      ...data,
      categories: data.categories.map((category, index) =>
        index === 1 ? { ...category, name: 'personal' } : category,
      ),
    };
    expect(invalidMessage(() => validateAppData(duplicateNames))).toContain(
      'more than one category',
    );
  });

  it('rejects more than three priorities and duplicate positions', () => {
    let data = makeData();
    for (const title of ['One', 'Two', 'Three']) {
      data = withTask(data, { title, focusDate: '2026-05-04' });
    }
    const fourPriorities = {
      ...data,
      tasks: [
        ...data.tasks,
        {
          ...(data.tasks[0] as (typeof data.tasks)[number]),
          id: 'task-four',
          title: 'Four',
          focusDate: '2026-05-04',
          focusOrder: 0,
        },
      ],
    };
    expect(invalidMessage(() => validateAppData(fourPriorities))).toContain(
      'more than three tasks',
    );

    const duplicatePosition = {
      ...data,
      tasks: data.tasks.map((task, index) =>
        index === 1 ? { ...task, focusOrder: 0 } : task,
      ),
    };
    expect(invalidMessage(() => validateAppData(duplicatePosition))).toContain(
      'duplicate priority positions',
    );
  });

  it('rejects inconsistent completion and goal state', () => {
    const data = makeData();
    expect(
      invalidMessage(() =>
        validateAppData({
          ...data,
          tasks: [
            {
              id: 'task-1',
              title: 'Open but stamped',
              description: '',
              dueDate: null,
              importance: 'none',
              categoryId: 'cat-personal',
              completed: false,
              createdAt: '2026-05-01T09:00:00.000Z',
              completedAt: '2026-05-01T10:00:00.000Z',
              estimateMinutes: 30,
              preferredPeriod: 'any',
              focusDate: null,
              focusOrder: null,
            },
          ],
        }),
      ),
    ).toContain('completedAt');

    expect(
      invalidMessage(() =>
        validateAppData({
          ...data,
          goals: [
            {
              id: 'goal-1',
              title: 'Half-finished',
              description: '',
              categoryId: 'cat-personal',
              targetDate: '2026-06-01',
              progress: 50,
              status: 'completed',
              milestones: [],
              createdAt: '2026-05-01T09:00:00.000Z',
              updatedAt: '2026-05-01T09:00:00.000Z',
              completedAt: null,
            },
          ],
        }),
      ),
    ).toContain('goal');
  });

  it('rejects blocks with invalid times, tasks, and schedules', () => {
    const data = makeData();
    const baseBlock = {
      id: 'block-1',
      date: '2026-05-04',
      startMin: 480,
      endMin: 540,
      type: 'event',
      source: 'manual',
      title: 'Event',
      taskId: null,
      notes: '',
      createdAt: '2026-05-01T09:00:00.000Z',
    };
    expect(
      invalidMessage(() => validateAppData({ ...data, blocks: [{ ...baseBlock, startMin: 540 }] })),
    ).toContain('later than the start');
    expect(
      invalidMessage(() =>
        validateAppData({ ...data, blocks: [{ ...baseBlock, endMin: 1441 }] }),
      ),
    ).toContain('between');
    expect(
      invalidMessage(() =>
        validateAppData({ ...data, blocks: [{ ...baseBlock, type: 'task', taskId: null }] }),
      ),
    ).toContain('taskId');
  });

  it('rejects invalid settings windows', () => {
    const data = makeData();
    expect(
      invalidMessage(() =>
        validateAppData({
          ...data,
          settings: { ...data.settings, workStartMin: 1080, workEndMin: 480 },
        }),
      ),
    ).toContain('later than the start');
  });

  it('accepts a deeply valid imported workspace', () => {
    const data = withTask(makeData(), {
      title: 'Imported',
      dueDate: '2026-05-04',
      estimateMinutes: 45,
      preferredPeriod: 'morning',
      importance: 'high',
    });
    const exported = createExportPayload(data);
    expect(parseImportText(JSON.stringify(exported)).data.tasks[0]?.title).toBe('Imported');
  });
});

describe('parseImportText', () => {
  it('accepts both the export wrapper and raw AppData', () => {
    const data = makeData();
    expect(parseImportText(JSON.stringify(createExportPayload(data))).data).toEqual(data);
    expect(parseImportText(JSON.stringify(data)).data).toEqual(data);
  });

  it('summarizes the import without writing it', () => {
    let data = withTask(makeData(), { title: 'One', dueDate: '2026-05-04' });
    data = withTask(data, { title: 'Two' });
    const parsed = parseImportText(JSON.stringify(createExportPayload(data)));
    expect(parsed.summary).toMatchObject({
      tasks: 2,
      openTasks: 2,
      goals: 0,
      categories: 6,
      blocks: 0,
    });
    expect(parsed.summary.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('rejects missing, empty, wrong, and unsupported files', () => {
    expect(invalidMessage(() => parseImportText(''))).toContain('empty');
    expect(invalidMessage(() => parseImportText('{nope'))).toContain('not valid JSON');
    expect(
      invalidMessage(() => parseImportText(JSON.stringify({ app: 'other', version: 1 }))),
    ).toContain('not a Daymark');
    const data = makeData();
    expect(
      invalidMessage(() =>
        parseImportText(JSON.stringify({ app: 'daymark', version: 9, data })),
      ),
    ).toContain('unsupported version');
    expect(
      invalidMessage(() => parseImportText(JSON.stringify({ app: 'daymark', version: 1 }))),
    ).toContain('missing its data');
  });

  it('accepts an unknown exportedAt but reports null', () => {
    const data = makeData();
    const parsed = parseImportText(
      JSON.stringify({
        app: 'daymark',
        version: 1,
        exportedAt: 'not a date',
        data,
      }),
    );
    expect(parsed.summary.exportedAt).toBeNull();
  });
});
