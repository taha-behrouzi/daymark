import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  buildHash,
  parseHash,
  type AppSection,
  type Route,
} from '../lib/router';

interface RouterValue {
  route: Route;
  navigate: (
    section: AppSection,
    query?: Record<string, string | undefined>,
  ) => void;
}

const RouterContext = createContext<RouterValue | null>(null);

export function RouterProvider({ children }: { children: ReactNode }) {
  const [route, setRoute] = useState<Route>(() =>
    parseHash(typeof window === 'undefined' ? '' : window.location.hash),
  );

  useEffect(() => {
    const sync = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', sync);
    window.addEventListener('popstate', sync);
    return () => {
      window.removeEventListener('hashchange', sync);
      window.removeEventListener('popstate', sync);
    };
  }, []);

  const navigate = useCallback(
    (section: AppSection, query: Record<string, string | undefined> = {}) => {
      const nextHash = buildHash(section, query);
      if (window.location.hash === nextHash) {
        setRoute(parseHash(nextHash));
        return;
      }
      window.location.hash = nextHash;
      window.scrollTo({ top: 0, behavior: 'instant' });
    },
    [],
  );

  const value = useMemo(() => ({ route, navigate }), [route, navigate]);

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function useRouter(): RouterValue {
  const value = useContext(RouterContext);
  if (!value) throw new Error('useRouter must be used inside RouterProvider.');
  return value;
}
