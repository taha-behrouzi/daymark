import { Component, useEffect, type ErrorInfo, type ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { useRouter } from './store/RouterProvider';
import { AppShell } from './components/layout/AppShell';
import { LogoMark } from './components/ui/Logo';
import { Button } from './components/ui/Button';
import { TodayPage } from './features/today/TodayPage';
import { TasksPage } from './features/tasks/TasksPage';
import { PlannerPage } from './features/planner/PlannerPage';
import { GoalsPage } from './features/goals/GoalsPage';
import { CalendarPage } from './features/calendar/CalendarPage';
import { InsightsPage } from './features/insights/InsightsPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { SECTION_LABELS } from './lib/router';

function CurrentPage() {
  const { route } = useRouter();

  useEffect(() => {
    const base = 'Daymark — Make your day clearer';
    document.title =
      route.section === 'today'
        ? base
        : `${SECTION_LABELS[route.section]} · Daymark`;
  }, [route.section]);

  switch (route.section) {
    case 'today':
      return <TodayPage />;
    case 'tasks':
      return <TasksPage />;
    case 'planner':
      return <PlannerPage />;
    case 'goals':
      return <GoalsPage />;
    case 'calendar':
      return <CalendarPage />;
    case 'insights':
      return <InsightsPage />;
    case 'settings':
      return <SettingsPage />;
    default:
      return <TodayPage />;
  }
}

export function App() {
  return (
    <AppShell>
      <CurrentPage />
    </AppShell>
  );
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class AppErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Daymark hit an unexpected error.', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-dvh items-center justify-center bg-canvas px-5 py-12">
        <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-7 shadow-soft">
          <LogoMark className="h-9 w-9" />
          <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
            Something went wrong
          </p>
          <h1 className="mt-2 font-display text-[30px] font-normal leading-[1.1] tracking-[-0.03em] text-ink">
            Daymark lost its place.
          </h1>
          <p className="mt-3 text-[12.5px] leading-relaxed text-ink-muted">
            Your saved data is still in this browser. Reloading usually restores the page. If
            this keeps happening, export a backup from Settings before making other changes.
          </p>
          <pre className="mt-4 max-h-24 overflow-auto rounded-xl bg-canvas/70 px-3 py-2 text-[10.5px] leading-relaxed text-ink-muted">
            {this.state.error.message}
          </pre>
          <div className="mt-5 flex gap-2">
            <Button onClick={() => window.location.reload()}>
              <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.9} />
              Reload Daymark
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                this.setState({ error: null });
                window.location.hash = '#/today';
              }}
            >
              Back to Today
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
