import { describe, expect, it } from 'vitest';
import { STORAGE_KEY } from '../constants';
import { createTask } from '../domain/tasks';
import { parseStoredData, type StorageLike } from '../lib/storage';
import { createAppStore } from './appStore';
import { makeData } from '../test/factories';

class MemoryStorage implements StorageLike {
  values = new Map<string, string>();
  failWrites = false;

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.failWrites) throw new Error('Quota exceeded');
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

const NOW = new Date('2026-05-01T09:00:00.000Z');

describe('createAppStore', () => {
  it('loads existing data and writes changes through to storage', () => {
    const storage = new MemoryStorage();
    const store = createAppStore({ storage, now: NOW, skipInitialSave: true });
    expect(store.getState().tasks).toEqual([]);

    store.update((state) =>
      createTask(state, { title: 'Persisted task', categoryId: 'cat-personal' }, NOW),
    );
    expect(store.getState().tasks[0]?.title).toBe('Persisted task');
    const raw = storage.getItem(STORAGE_KEY) as string;
    expect(parseStoredData(raw).tasks[0]?.title).toBe('Persisted task');
    expect(store.getPersistenceError()).toBeNull();
  });

  it('notifies subscribers only when state actually changes', () => {
    const storage = new MemoryStorage();
    const store = createAppStore({ storage, now: NOW, skipInitialSave: true });
    let calls = 0;
    const unsubscribe = store.subscribe(() => {
      calls += 1;
    });
    store.update((state) => state);
    expect(calls).toBe(0);
    store.update((state) =>
      createTask(state, { title: 'Changed', categoryId: 'cat-personal' }, NOW),
    );
    expect(calls).toBe(1);
    unsubscribe();
    store.update((state) => ({ ...state, version: 1 }));
    expect(calls).toBe(1);
  });

  it('surfaces write errors without dropping in-memory state', () => {
    const storage = new MemoryStorage();
    const store = createAppStore({ storage, now: NOW });
    storage.failWrites = true;
    store.update((state) => ({ ...state, settings: { ...state.settings, name: 'Taha' } }));
    expect(store.getState().settings.name).toBe('Taha');
    expect(store.getPersistenceError()).toContain('could not save');
    store.dismissPersistenceError();
    expect(store.getPersistenceError()).toBeNull();
  });

  it('replaces data from an import and persists it', () => {
    const storage = new MemoryStorage();
    const store = createAppStore({ storage, now: NOW, skipInitialSave: true });
    const replacement = makeData();
    store.replace(replacement);
    expect(store.getState()).toEqual(replacement);
    expect(parseStoredData(storage.getItem(STORAGE_KEY) as string)).toEqual(replacement);
  });

  it('syncs another tab without writing over the shared storage', () => {
    const storage = new MemoryStorage();
    const store = createAppStore({
      storage,
      initialData: makeData(),
      skipInitialSave: true,
    });
    const other = createDefaultDataWithTask();
    store.replaceFromAnotherTab(other);
    expect(store.getState().tasks[0]?.title).toBe('From another tab');
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('resets and clears storage safely', () => {
    const storage = new MemoryStorage();
    const store = createAppStore({ storage, now: NOW });
    store.update((state) =>
      createTask(state, { title: 'Delete me', categoryId: 'cat-personal' }, NOW),
    );
    store.reset();
    expect(store.getState().tasks).toEqual([]);
    expect(parseStoredData(storage.getItem(STORAGE_KEY) as string).tasks).toEqual([]);

    store.update((state) =>
      createTask(state, { title: 'Gone after clear', categoryId: 'cat-personal' }, NOW),
    );
    store.clearStorage();
    expect(store.getState().tasks).toEqual([]);
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
  });
});

function createDefaultDataWithTask() {
  return createTask(makeData(), {
    title: 'From another tab',
    categoryId: 'cat-personal',
  });
}
