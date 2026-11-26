import { Kbd } from '../ui/Meta';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';

interface ShortcutsDialogProps {
  onClose: () => void;
}

const GROUPS: { title: string; shortcuts: { keys: string[]; label: string }[] }[] = [
  {
    title: 'Anywhere',
    shortcuts: [
      { keys: ['N'], label: 'New task' },
      { keys: ['?'], label: 'Open this reference' },
      { keys: ['Esc'], label: 'Close a dialog' },
    ],
  },
  {
    title: 'Move around',
    shortcuts: [
      { keys: ['G', 'T'], label: 'Today' },
      { keys: ['G', 'K'], label: 'Tasks' },
      { keys: ['G', 'P'], label: 'Planner' },
      { keys: ['G', 'C'], label: 'Calendar' },
      { keys: ['G', 'O'], label: 'Goals' },
      { keys: ['G', 'I'], label: 'Insights' },
      { keys: ['G', 'S'], label: 'Settings' },
    ],
  },
  {
    title: 'On the Tasks page',
    shortcuts: [{ keys: ['/'], label: 'Focus the search field' }],
  },
];

export function ShortcutsDialog({ onClose }: ShortcutsDialogProps) {
  return (
    <Dialog
      onClose={onClose}
      eyebrow="Reference"
      title="Keyboard shortcuts"
      description="Shortcuts stay quiet while you are typing. Press G, then a letter, to move between pages."
      size="md"
      footer={
        <Button variant="secondary" size="sm" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="space-y-6">
        {GROUPS.map((group) => (
          <section key={group.title}>
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.15em] text-ink-muted">
              {group.title}
            </h3>
            <ul className="mt-2 divide-y divide-line/60">
              {group.shortcuts.map((shortcut) => (
                <li
                  key={shortcut.label}
                  className="flex items-center justify-between gap-4 py-2 text-[12.5px] text-ink-soft"
                >
                  <span>{shortcut.label}</span>
                  <span className="flex shrink-0 items-center gap-1">
                    {shortcut.keys.map((key, index) => (
                      <span key={key} className="flex items-center gap-1">
                        {index > 0 ? <span className="text-[9px] text-ink-muted">then</span> : null}
                        <Kbd>{key}</Kbd>
                      </span>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <p className="rounded-xl bg-raised/60 px-3.5 py-2.5 text-[11px] leading-relaxed text-ink-muted">
          Shortcuts pause while a text field is focused, so you can always type a letter
          without triggering anything.
        </p>
      </div>
    </Dialog>
  );
}
