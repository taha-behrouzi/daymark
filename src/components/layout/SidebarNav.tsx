import { Settings2 } from 'lucide-react';
import { sections, type NavItem } from './navigation';
import { useRouter } from '../../store/RouterProvider';
import { useAppData, useAppStore } from '../../store/AppStoreProvider';
import { cn } from '../../lib/cn';
import { Moon, Sun } from 'lucide-react';
import { IconButton } from '../ui/Button';

interface SidebarNavProps {
  todayCount: number;
}

function sectionBadge(section: NavItem['section'], counts: Record<string, number>): number | null {
  return counts[section] ?? null;
}

export function SidebarNav({ todayCount }: SidebarNavProps) {
  const { route } = useRouter();
  const data = useAppData();
  const store = useAppStore();

  const openTaskCount = data.tasks.filter((task) => !task.completed).length;
  const activeGoalCount = data.goals.filter((goal) => goal.status === 'active').length;
  const counts: Record<string, number> = {
    today: todayCount,
    tasks: openTaskCount,
    goals: activeGoalCount,
  };

  const daily = sections.filter((item) =>
    ['today', 'tasks', 'planner', 'calendar'].includes(item.section),
  );
  const reflect = sections.filter((item) =>
    ['goals', 'insights'].includes(item.section),
  );

  const isDark = data.settings.theme === 'dark';
  const toggleTheme = () => {
    store.update((state) => ({
      ...state,
      settings: { ...state.settings, theme: isDark ? 'light' : 'dark' },
    }));
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <nav aria-label="Sections" className="flex flex-col gap-5">
        <div>
          <p className="mb-2 px-3 text-[9.5px] font-semibold uppercase tracking-[0.18em] text-ink-muted/70">
            Daily
          </p>
          <ul className="space-y-0.5">
            {daily.map((item) => (
              <SidebarLink
                key={item.section}
                item={item}
                active={route.section === item.section}
                badge={sectionBadge(item.section, counts)}
              />
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-2 px-3 text-[9.5px] font-semibold uppercase tracking-[0.18em] text-ink-muted/70">
            Direction
          </p>
          <ul className="space-y-0.5">
            {reflect.map((item) => (
              <SidebarLink
                key={item.section}
                item={item}
                active={route.section === item.section}
                badge={sectionBadge(item.section, counts)}
              />
            ))}
          </ul>
        </div>
      </nav>

      <div className="mt-auto border-t border-line/80 pt-3">
        <SidebarLink
          item={sections.find((item) => item.section === 'settings') as NavItem}
          active={route.section === 'settings'}
        />
        <div className="mt-1 flex items-center justify-between rounded-lg px-3 py-1.5">
          <span className="text-[11px] text-ink-muted">Appearance</span>
          <IconButton
            label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
            size="sm"
            onClick={toggleTheme}
            className="h-7 w-7"
          >
            {isDark ? (
              <Sun className="h-3.5 w-3.5" strokeWidth={1.8} />
            ) : (
              <Moon className="h-3.5 w-3.5" strokeWidth={1.8} />
            )}
          </IconButton>
        </div>
        <a
          href="#/settings"
          className="mt-0.5 flex items-center gap-2 rounded-lg px-3 py-1.5 text-[10.5px] text-ink-muted/70 transition-colors hover:text-ink-muted"
        >
          <Settings2 className="h-3 w-3" strokeWidth={1.8} />
          Local-first · v1.0
        </a>
      </div>
    </div>
  );
}

function SidebarLink({
  item,
  active,
  badge,
}: {
  item: NavItem;
  active: boolean;
  badge?: number | null;
}) {
  const Icon = item.icon;
  return (
    <li>
      <a
        href={item.href}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'group flex h-9 items-center gap-2.5 rounded-lg px-3 text-[13px] font-medium transition-colors',
          active
            ? 'border border-line/80 bg-surface text-ink shadow-[0_1px_1px_rgb(28_27_24/0.03)]'
            : 'border border-transparent text-ink-soft hover:bg-raised/70 hover:text-ink',
        )}
      >
        <Icon
          className={cn(
            'h-[16px] w-[16px] shrink-0 transition-colors',
            active ? 'text-accent' : 'text-ink-muted group-hover:text-ink-soft',
          )}
          strokeWidth={active ? 2 : 1.7}
        />
        <span className="truncate">{item.label}</span>
        {badge && badge > 0 ? (
          <span
            className={cn(
              'ml-auto font-tabular text-[10px] font-semibold',
              active ? 'text-ink-muted' : 'text-ink-muted/75',
            )}
          >
            {badge}
          </span>
        ) : null}
      </a>
    </li>
  );
}
