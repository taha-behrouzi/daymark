import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, Menu as MenuIcon, Plus, X } from 'lucide-react';
import { Logo, LogoMark } from '../ui/Logo';
import { IconButton } from '../ui/Button';
import { Kbd } from '../ui/Meta';
import {
  useAppData,
  useLoadWarning,
  usePersistenceError,
} from '../../store/AppStoreProvider';
import { useAppDialogs } from '../../store/AppDialogsProvider';
import { useRouter } from '../../store/RouterProvider';
import { todayKey } from '../../lib/date';
import { sections } from './navigation';
import { cn } from '../../lib/cn';
import { MobileMoreDialog } from './MobileMoreDialog';
import { SidebarNav } from './SidebarNav';
import { ShortcutsDialog } from './ShortcutsDialog';
import type { AppSection } from '../../lib/router';

const GO_TO: Record<string, AppSection> = {
  t: 'today',
  k: 'tasks',
  p: 'planner',
  c: 'calendar',
  o: 'goals',
  i: 'insights',
  s: 'settings',
};

function isTypingTarget(target: EventTarget | null): boolean {
  return Boolean(
    (target as HTMLElement | null)?.closest(
      'input, textarea, select, [contenteditable="true"]',
    ),
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { route, navigate } = useRouter();
  const data = useAppData();
  const { openTaskEditor } = useAppDialogs();
  const [moreOpen, setMoreOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [dismissedNotice, setDismissedNotice] = useState(false);
  const goPrefixRef = useRef<number | null>(null);
  const loadWarning = useLoadWarning();
  const persistenceError = usePersistenceError();
  const today = todayKey();

  const todayCount = data.tasks.filter(
    (task) =>
      !task.completed &&
      (task.dueDate === today || task.focusDate === today),
  ).length;

  const primaryNav = sections.filter((item) => item.primary);
  const notice = persistenceError ?? loadWarning;
  const moreSectionActive = ['goals', 'insights', 'settings'].includes(route.section);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;

      const hasDialog = Boolean(document.querySelector('dialog[open]'));
      if (hasDialog) return;

      const key = event.key.toLowerCase();

      if (event.key === '?') {
        event.preventDefault();
        setShortcutsOpen(true);
        return;
      }

      const prefixAt = goPrefixRef.current;
      goPrefixRef.current = null;
      if (prefixAt !== null && Date.now() - prefixAt < 1600 && GO_TO[key]) {
        event.preventDefault();
        navigate(GO_TO[key]);
        return;
      }

      if (key === 'g') {
        goPrefixRef.current = Date.now();
        return;
      }

      if (key !== 'n') return;
      event.preventDefault();
      openTaskEditor({ preset: { dueDate: today } });
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate, openTaskEditor, today]);

  return (
    <div className="min-h-dvh bg-canvas">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-lg bg-ink px-3 py-2 text-[12px] font-medium text-canvas focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Skip to content
      </a>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col border-r border-line/80 px-4 py-6 md:flex lg:px-5">
        <a href="#/today" className="mb-7 block rounded-lg px-1">
          <Logo showTagline />
        </a>

        <button
          type="button"
          onClick={() => openTaskEditor({ preset: { dueDate: today } })}
          className="pressable mb-7 flex h-10 w-full items-center gap-2.5 rounded-xl border border-line bg-surface px-3 text-[13px] font-medium text-ink shadow-soft hover:border-line-strong"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink text-canvas">
            <Plus className="h-3.5 w-3.5" strokeWidth={2} />
          </span>
          New task
          <span className="ml-auto">
            <Kbd>N</Kbd>
          </span>
        </button>

        <SidebarNav todayCount={todayCount} />
        <div className="mt-auto pt-6 text-[10.5px] leading-relaxed text-ink-muted/70">
          Everything is stored in this browser.
          <br />
          Make your day clearer.
        </div>
      </aside>

      <div className="md:pl-[248px]">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-line/70 bg-canvas/90 px-4 backdrop-blur-md md:hidden">
          <a href="#/today" className="flex items-center gap-2">
            <LogoMark className="h-6 w-6" />
            <span className="font-display text-[20px] font-medium tracking-[-0.03em]">
              daymark
            </span>
          </a>
          <div className="flex items-center gap-1">
            <IconButton
              label="New task"
              size="md"
              variant="subtle"
              onClick={() => openTaskEditor({ preset: { dueDate: today } })}
              className="text-ink"
            >
              <Plus className="h-4 w-4" strokeWidth={2} />
            </IconButton>
            <IconButton label="More pages" size="md" onClick={() => setMoreOpen(true)}>
              <MenuIcon className="h-[18px] w-[18px]" strokeWidth={1.8} />
            </IconButton>
          </div>
        </header>

        <main
          id="main-content"
          className="mx-auto w-full max-w-[1200px] px-4 pb-28 pt-6 sm:px-6 sm:pt-8 md:px-8 md:pb-16 md:pt-10 lg:px-12"
        >
          {notice && !dismissedNotice ? (
            <div className="mb-6 flex items-start gap-3 rounded-xl border border-gold/25 bg-gold-soft px-4 py-3 text-gold">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.9} />
              <p className="min-w-0 flex-1 text-[12px] leading-relaxed">{notice}</p>
              <IconButton
                label="Dismiss notice"
                size="sm"
                className="-mr-1.5 -mt-1 h-6 w-6 text-gold hover:bg-gold/10 hover:text-gold"
                onClick={() => setDismissedNotice(true)}
              >
                <X className="h-3 w-3" strokeWidth={2} />
              </IconButton>
            </div>
          ) : null}
          <div key={route.section} className="animate-page-in">
            {children}
          </div>
        </main>
      </div>

      <nav
        aria-label="Primary navigation"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line/80 bg-canvas/95 backdrop-blur-md md:hidden"
      >
        <div className="safe-bottom mx-auto flex h-16 max-w-md items-stretch justify-around px-2">
          {primaryNav.map((item) => {
            const active = route.section === item.section;
            const Icon = item.icon;
            return (
              <a
                key={item.section}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-lg text-[10px] font-medium transition-colors',
                  active ? 'text-ink' : 'text-ink-muted hover:text-ink-soft',
                )}
              >
                <Icon
                  className={cn(
                    'h-[19px] w-[19px]',
                    active ? 'text-accent' : 'text-ink-muted',
                  )}
                  strokeWidth={active ? 2 : 1.7}
                />
                <span>{item.shortLabel ?? item.label}</span>
                {active ? (
                  <span className="absolute bottom-1.5 h-0.5 w-4 rounded-full bg-accent" />
                ) : null}
              </a>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={cn(
              'relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-lg text-[10px] font-medium transition-colors',
              moreOpen || moreSectionActive ? 'text-ink' : 'text-ink-muted hover:text-ink-soft',
            )}
          >
            <MenuIcon
              className={cn(
                'h-[19px] w-[19px]',
                moreSectionActive ? 'text-accent' : 'text-ink-muted',
              )}
              strokeWidth={1.7}
            />
            <span>More</span>
            {moreSectionActive ? (
              <span className="absolute bottom-1.5 h-0.5 w-4 rounded-full bg-accent" />
            ) : null}
          </button>
        </div>
      </nav>

      {moreOpen ? <MobileMoreDialog onClose={() => setMoreOpen(false)} /> : null}
      {shortcutsOpen ? <ShortcutsDialog onClose={() => setShortcutsOpen(false)} /> : null}
    </div>
  );
}
