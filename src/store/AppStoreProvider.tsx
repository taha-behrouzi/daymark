import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { STORAGE_KEY } from '../constants';
import { createDefaultAppData } from '../domain/defaults';
import { parseStoredData } from '../lib/storage';
import type { AppData } from '../types';
import { createAppStore, type AppStore } from './appStore';

const StoreContext = createContext<AppStore | null>(null);

interface AppStoreProviderProps {
  children: ReactNode;
  store?: AppStore;
}

export function AppStoreProvider({ children, store }: AppStoreProviderProps) {
  const [appStore] = useState(() => store ?? createAppStore());

  useEffect(() => {
    if (store) return;
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      if (event.newValue === null) {
        appStore.replaceFromAnotherTab(createDefaultAppData());
        return;
      }
      try {
        const data = parseStoredData(event.newValue);
        appStore.replaceFromAnotherTab(data);
      } catch {
        // Another tab wrote unreadable data; keep this tab's working state.
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [appStore, store]);

  return <StoreContext.Provider value={appStore}>{children}</StoreContext.Provider>;
}

export function useAppStore(): AppStore {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useAppStore must be used inside AppStoreProvider.');
  return store;
}

export function useAppData(): AppData {
  const store = useAppStore();
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}

export function usePersistenceError(): string | null {
  const store = useAppStore();
  return useSyncExternalStore(
    store.subscribe,
    store.getPersistenceError,
    store.getPersistenceError,
  );
}

export function useLoadWarning(): string | null {
  const store = useAppStore();
  const [warning] = useState(() => store.getLoadWarning());
  return warning;
}
