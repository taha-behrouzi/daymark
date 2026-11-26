import { useEffect } from 'react';
import { useAppData } from '../store/AppStoreProvider';
import type { ThemePreference } from '../types';

function prefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function resolveDark(theme: ThemePreference): boolean {
  if (theme === 'dark') return true;
  if (theme === 'light') return false;
  return prefersDark();
}

export function applyTheme(theme: ThemePreference): void {
  const dark = resolveDark(theme);
  document.documentElement.classList.toggle('dark', dark);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', dark ? '#141311' : '#f7f5f0');
  }
}

export function ThemeController() {
  const data = useAppData();
  const theme = data.settings.theme;

  useEffect(() => {
    applyTheme(theme);
    if (theme !== 'system') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [theme]);

  return null;
}
