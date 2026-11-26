import { BACKUP_PREFIX, STORAGE_KEY } from '../constants';
import type { AppData } from '../types';
import { createDefaultAppData } from '../domain/defaults';
import { DataValidationError, validateAppData } from './validation';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface LoadResult {
  data: AppData;
  warning: string | null;
  storageAvailable: boolean;
}

export interface SaveResult {
  ok: boolean;
  error: string | null;
}

export function getBrowserStorage(): StorageLike | null {
  if (typeof window === 'undefined') return null;
  try {
    const storage = window.localStorage;
    const probe = '__daymark_probe__';
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}

function backupKey(now: Date): string {
  return `${BACKUP_PREFIX}${now.toISOString().replace(/[:.]/g, '-')}`;
}

/**
 * Loads saved data defensively. Corrupt data is preserved under a backup key
 * instead of being silently overwritten.
 */
export function loadAppData(
  storage: StorageLike | null,
  now: Date = new Date(),
): LoadResult {
  const defaults = createDefaultAppData(now);
  if (!storage) {
    return {
      data: defaults,
      warning:
        'Browser storage is unavailable. Daymark will still work, but changes will not be saved after you close this tab.',
      storageAvailable: false,
    };
  }

  let raw: string | null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return {
      data: defaults,
      warning:
        'Daymark could not read browser storage, so it started with a clean workspace.',
      storageAvailable: false,
    };
  }

  if (!raw) {
    return { data: defaults, warning: null, storageAvailable: true };
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return {
      data: validateAppData(parsed),
      warning: null,
      storageAvailable: true,
    };
  } catch (error) {
    let backupSaved = false;
    try {
      storage.setItem(backupKey(now), raw);
      storage.removeItem(STORAGE_KEY);
      backupSaved = true;
    } catch {
      // A full or disabled storage may prevent the backup as well.
    }
    const detail =
      error instanceof DataValidationError
        ? ` ${error.message}`
        : ' The saved file was not readable.';
    return {
      data: defaults,
      warning: backupSaved
        ? `Your saved Daymark data could not be loaded, so a fresh workspace was opened. The previous data was kept as a local backup.${detail}`
        : `Your saved Daymark data could not be loaded, so a fresh workspace was opened.${detail}`,
      storageAvailable: true,
    };
  }
}

export function saveAppData(storage: StorageLike | null, data: AppData): SaveResult {
  if (!storage) {
    return {
      ok: false,
      error: 'Browser storage is unavailable. Changes are kept only in this tab.',
    };
  }
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(data));
    return { ok: true, error: null };
  } catch {
    return {
      ok: false,
      error:
        'Daymark could not save to browser storage. Your browser storage may be full or unavailable.',
    };
  }
}

export function readRawStoredData(storage: StorageLike | null): string | null {
  if (!storage) return null;
  try {
    return storage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function parseStoredData(raw: string): AppData {
  return validateAppData(JSON.parse(raw) as unknown);
}

export function clearStoredData(storage: StorageLike | null): void {
  if (!storage) return;
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing else to do; the in-memory reset still takes effect.
  }
}
