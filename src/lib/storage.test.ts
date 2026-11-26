import { describe, expect, it } from 'vitest';
import { BACKUP_PREFIX, STORAGE_KEY } from '../constants';
import {
  clearStoredData,
  loadAppData,
  parseStoredData,
  saveAppData,
  type StorageLike,
} from './storage';
import { createDefaultAppData } from '../domain/defaults';
import { makeData, withTask } from '../test/factories';

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

const NOW = new Date('2026-05-01T12:00:00.000Z');

describe('loadAppData', () => {
  it('returns defaults for an empty storage', () => {
    const storage = new MemoryStorage();
    const result = loadAppData(storage, NOW);
    expect(result.warning).toBeNull();
    expect(result.data).toEqual(createDefaultAppData(NOW));
  });

  it('loads and validates a saved workspace', () => {
    const storage = new MemoryStorage();
    const data = withTask(makeData(), { title: 'Persisted' });
    storage.setItem(STORAGE_KEY, JSON.stringify(data));
    const result = loadAppData(storage, NOW);
    expect(result.warning).toBeNull();
    expect(result.data.tasks[0]?.title).toBe('Persisted');
  });

  it('preserves corrupt raw data under a backup key and starts fresh', () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, '{broken');
    const result = loadAppData(storage, NOW);
    expect(result.warning).toContain('local backup');
    const backupKeys = [...storage.values.keys()].filter((key) =>
      key.startsWith(BACKUP_PREFIX),
    );
    expect(backupKeys).toHaveLength(1);
    expect(storage.getItem(backupKeys[0] as string)).toBe('{broken');
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
    expect(result.data.tasks).toEqual([]);
  });

  it('keeps the raw data if a backup cannot be written', () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, '{broken');
    storage.failWrites = true;
    const result = loadAppData(storage, NOW);
    expect(result.warning).not.toContain('local backup');
    expect(storage.getItem(STORAGE_KEY)).toBe('{broken');
  });

  it('returns an honest warning when storage is unavailable', () => {
    const result = loadAppData(null, NOW);
    expect(result.storageAvailable).toBe(false);
    expect(result.warning).toContain('storage is unavailable');
  });
});

describe('saving', () => {
  it('serializes the workspace and reports write failure', () => {
    const storage = new MemoryStorage();
    const data = withTask(makeData(), { title: 'Saved' });
    expect(saveAppData(storage, data)).toEqual({ ok: true, error: null });
    const raw = storage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    expect(parseStoredData(raw as string).tasks[0]?.title).toBe('Saved');

    storage.failWrites = true;
    expect(saveAppData(storage, data).ok).toBe(false);
    expect(saveAppData(null, data).error).toContain('unavailable');
  });

  it('clears only the app key and ignores storage failures', () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, 'x');
    storage.setItem(`${BACKUP_PREFIX}keep`, 'y');
    clearStoredData(storage);
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
    expect(storage.getItem(`${BACKUP_PREFIX}keep`)).toBe('y');
    storage.failWrites = true;
    expect(() => clearStoredData(storage)).not.toThrow();
  });

  it('rejects corrupt serialized data when parsed directly', () => {
    expect(() => parseStoredData('{"version":1}')).toThrow();
  });
});
