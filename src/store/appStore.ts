import { createDefaultAppData } from '../domain/defaults';
import type { AppData } from '../types';
import {
  clearStoredData,
  getBrowserStorage,
  loadAppData,
  saveAppData,
  type StorageLike,
} from '../lib/storage';

export interface AppStore {
  getState(): AppData;
  subscribe(listener: () => void): () => void;
  /**
   * Applies a pure update. Domain errors are thrown before anything is
   * persisted; a failed browser write is surfaced through getPersistenceError.
   */
  update(updater: (state: AppData) => AppData): void;
  replace(data: AppData): void;
  replaceFromAnotherTab(data: AppData): void;
  reset(): void;
  clearStorage(): void;
  getLoadWarning(): string | null;
  getPersistenceError(): string | null;
  dismissPersistenceError(): void;
}

export interface CreateStoreOptions {
  storage?: StorageLike | null;
  initialData?: AppData;
  now?: Date;
  /** Skip the initial write, used by tests and previews. */
  skipInitialSave?: boolean;
}

export function createAppStore(options: CreateStoreOptions = {}): AppStore {
  const now = options.now ?? new Date();
  const storage = options.storage === undefined ? getBrowserStorage() : options.storage;
  const loaded =
    options.initialData !== undefined
      ? { data: options.initialData, warning: null as string | null, storageAvailable: storage !== null }
      : loadAppData(storage, now);
  let state = loaded.data;
  let loadWarning = loaded.warning;
  let persistenceError: string | null = null;
  const listeners = new Set<() => void>();

  if (!options.skipInitialSave && storage) {
    const saved = saveAppData(storage, state);
    if (!saved.ok) persistenceError = saved.error;
  }

  const emit = () => {
    for (const listener of listeners) listener();
  };

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    update(updater) {
      const next = updater(state);
      if (next === state) return;
      state = next;
      const saved = saveAppData(storage, state);
      persistenceError = saved.error;
      emit();
    },
    replace(data) {
      state = data;
      const saved = saveAppData(storage, state);
      persistenceError = saved.error;
      emit();
    },
    replaceFromAnotherTab(data) {
      state = data;
      emit();
    },
    reset() {
      state = createDefaultAppData(new Date());
      const saved = saveAppData(storage, state);
      persistenceError = saved.error;
      loadWarning = null;
      emit();
    },
    clearStorage() {
      clearStoredData(storage);
      state = createDefaultAppData(new Date());
      loadWarning = null;
      emit();
    },
    getLoadWarning: () => loadWarning,
    getPersistenceError: () => persistenceError,
    dismissPersistenceError() {
      persistenceError = null;
      emit();
    },
  };
}
