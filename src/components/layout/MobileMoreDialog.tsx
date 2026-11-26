import { ChevronRight, Monitor, Moon, Sun } from 'lucide-react';
import { Dialog } from '../ui/Dialog';
import { SegmentedControl } from '../ui/SegmentedControl';
import { useAppData, useAppStore } from '../../store/AppStoreProvider';
import { sections } from './navigation';
import type { ThemePreference } from '../../types';
import { cn } from '../../lib/cn';

export function MobileMoreDialog({ onClose }: { onClose: () => void }) {
  const data = useAppData();
  const store = useAppStore();
  const items = sections.filter((item) =>
    ['goals', 'insights', 'settings'].includes(item.section),
  );

  return (
    <Dialog
      onClose={onClose}
      eyebrow="Navigate"
      title="More"
      size="sm"
      description="Plans, perspective, and preferences."
    >
      <div className="space-y-5">
        <div className="space-y-1">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <a
                key={item.section}
                href={item.href}
                onClick={onClose}
                className="group flex items-center gap-3 rounded-xl border border-transparent px-2 py-3 transition-colors hover:border-line hover:bg-canvas/40"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-raised text-ink-soft">
                  <Icon className="h-4 w-4" strokeWidth={1.7} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-medium text-ink">
                    {item.label}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-ink-muted">
                    {item.section === 'goals'
                      ? 'Direction beyond today'
                      : item.section === 'insights'
                        ? 'Patterns in what you finish'
                        : 'Preferences and data'}
                  </span>
                </span>
                <ChevronRight
                  className="h-4 w-4 text-ink-muted transition-transform group-hover:translate-x-0.5"
                  strokeWidth={1.8}
                />
              </a>
            );
          })}
        </div>

        <div className="border-t border-line pt-4">
          <p className="mb-2.5 text-[11px] font-medium text-ink-soft">Appearance</p>
          <SegmentedControl<ThemePreference>
            label="Theme"
            value={data.settings.theme}
            onChange={(theme) =>
              store.update((state) => ({
                ...state,
                settings: { ...state.settings, theme },
              }))
            }
            options={[
              { value: 'light', label: 'Light', icon: <Sun className="h-3 w-3" /> },
              {
                value: 'system',
                label: 'System',
                icon: <Monitor className="h-3 w-3" />,
              },
              { value: 'dark', label: 'Dark', icon: <Moon className="h-3 w-3" /> },
            ]}
            size="sm"
            className={cn('w-full justify-between')}
          />
        </div>

        <p className="rounded-xl bg-raised/60 px-3 py-2.5 text-[11px] leading-relaxed text-ink-muted">
          Your tasks, goals, and plans live only in this browser. Export a copy from
          Settings whenever you like.
        </p>
      </div>
    </Dialog>
  );
}
