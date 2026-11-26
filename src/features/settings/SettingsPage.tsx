import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from 'react';
import {
  Check,
  Download,
  HardDrive,
  Keyboard,
  Monitor,
  Moon,
  Palette,
  Plus,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  Upload,
  User,
} from 'lucide-react';
import {
  CATEGORY_COLORS,
  CATEGORY_OTHER_ID,
} from '../../constants';
import {
  formatDate,
  formatDateLong,
  minutesToTimeValue,
  timeValueToMinutes,
  todayKey,
} from '../../lib/date';
import { cn } from '../../lib/cn';
import { downloadTextFile, readTextFile } from '../../lib/download';
import { createExportPayload, parseImportText, type ParsedImport } from '../../lib/validation';
import { DEFAULT_SETTINGS } from '../../domain/defaults';
import { updateSettings } from '../../domain/settings';
import { useAppData, useAppStore } from '../../store/AppStoreProvider';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Field, Input, Select } from '../../components/ui/Field';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { Kbd } from '../../components/ui/Meta';
import { ProgressBar } from '../../components/ui/Progress';
import { Dialog } from '../../components/ui/Dialog';
import { useToast } from '../../components/ui/toast';
import { useConfirm } from '../../components/ui/confirm';
import { CategoryEditorDialog } from './CategoryEditorDialog';
import type {
  Settings,
  ThemePreference,
  TimeFormat,
  WeekStartsOn,
} from '../../types';

interface PlanDraft {
  weekStartsOn: WeekStartsOn;
  timeFormat: TimeFormat;
  workStart: string;
  workEnd: string;
  breakMinutes: string;
  breakAfterMinutes: string;
  defaultEstimateMinutes: string;
}

function endInputValue(minutes: number): string {
  return minutes >= 1440 ? '00:00' : minutesToTimeValue(minutes);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function draftFromSettings(settings: Settings): PlanDraft {
  return {
    weekStartsOn: settings.weekStartsOn,
    timeFormat: settings.timeFormat,
    workStart: minutesToTimeValue(settings.workStartMin),
    workEnd: endInputValue(settings.workEndMin),
    breakMinutes: String(settings.breakMinutes),
    breakAfterMinutes: String(settings.breakAfterMinutes),
    defaultEstimateMinutes: String(settings.defaultEstimateMinutes),
  };
}

const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ['N'], label: 'New task' },
  { keys: ['/'], label: 'Focus task search on the Tasks page' },
  { keys: ['G', 'T'], label: 'Go to Today' },
  { keys: ['G', 'K'], label: 'Go to Tasks' },
  { keys: ['G', 'P'], label: 'Go to Planner' },
  { keys: ['G', 'C'], label: 'Go to Calendar' },
  { keys: ['G', 'O'], label: 'Go to Goals' },
  { keys: ['G', 'I'], label: 'Go to Insights' },
  { keys: ['G', 'S'], label: 'Go to Settings' },
  { keys: ['?'], label: 'Show keyboard shortcuts' },
  { keys: ['Esc'], label: 'Close a dialog' },
];

export function SettingsPage() {
  const data = useAppData();
  const store = useAppStore();
  const toast = useToast();
  const confirm = useConfirm();
  const today = todayKey();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(data.settings.name);
  const [planDraft, setPlanDraft] = useState<PlanDraft>(() =>
    draftFromSettings(data.settings),
  );
  const [planError, setPlanError] = useState<string | null>(null);
  const [planSaved, setPlanSaved] = useState(false);
  const [categoryDialog, setCategoryDialog] = useState<{ categoryId?: string } | null>(null);
  const [pendingImport, setPendingImport] = useState<ParsedImport | null>(null);
  const [importing, setImporting] = useState(false);
  const settings = data.settings;

  useEffect(() => {
    setName(settings.name);
  }, [settings.name]);

  useEffect(() => {
    setPlanDraft(draftFromSettings(settings));
  }, [
    settings.breakAfterMinutes,
    settings.breakMinutes,
    settings.defaultEstimateMinutes,
    settings.timeFormat,
    settings.weekStartsOn,
    settings.workEndMin,
    settings.workStartMin,
  ]);

  const serialized = JSON.stringify(data);
  const storageBytes = new TextEncoder().encode(serialized).length;

  const applySettings = (patch: Partial<Settings>, successMessage?: string) => {
    try {
      store.update((state) => updateSettings(state, patch));
      if (successMessage) toast({ title: successMessage, tone: 'success' });
    } catch (error) {
      toast({
        title: 'Could not save that setting',
        description: error instanceof Error ? error.message : undefined,
        tone: 'error',
      });
    }
  };

  const handleNameSubmit = (event: FormEvent) => {
    event.preventDefault();
    applySettings({ name }, 'Name saved');
  };

  const handleTheme = (theme: ThemePreference) => {
    applySettings({ theme });
  };

  const updateDraft = <Key extends keyof PlanDraft>(key: Key, value: PlanDraft[Key]) => {
    setPlanDraft((current) => ({ ...current, [key]: value }));
    setPlanSaved(false);
    setPlanError(null);
  };

  const handlePlanningSubmit = (event: FormEvent) => {
    event.preventDefault();
    const startMin = timeValueToMinutes(planDraft.workStart);
    const rawEnd = timeValueToMinutes(planDraft.workEnd);
    const endMin = planDraft.workEnd === '00:00' ? 1440 : rawEnd;
    if (startMin === null) {
      setPlanError('Choose a valid start time.');
      return;
    }
    if (endMin === null) {
      setPlanError('Choose a valid end time.');
      return;
    }
    const breakMinutes = Number(planDraft.breakMinutes);
    const breakAfterMinutes = Number(planDraft.breakAfterMinutes);
    const defaultEstimateMinutes = Number(planDraft.defaultEstimateMinutes);
    if (!Number.isInteger(breakMinutes) || breakMinutes < 0 || breakMinutes > 120) {
      setPlanError('Break length must be a whole number between 0 and 120.');
      return;
    }
    if (
      !Number.isInteger(breakAfterMinutes) ||
      breakAfterMinutes < 15 ||
      breakAfterMinutes > 480
    ) {
      setPlanError('Break interval must be between 15 and 480 minutes.');
      return;
    }
    if (
      !Number.isInteger(defaultEstimateMinutes) ||
      defaultEstimateMinutes < 5 ||
      defaultEstimateMinutes > 480
    ) {
      setPlanError('Default estimate must be between 5 and 480 minutes.');
      return;
    }
    try {
      store.update((state) =>
        updateSettings(state, {
          weekStartsOn: planDraft.weekStartsOn,
          timeFormat: planDraft.timeFormat,
          workStartMin: startMin,
          workEndMin: endMin,
          breakMinutes,
          breakAfterMinutes,
          defaultEstimateMinutes,
        }),
      );
      setPlanError(null);
      setPlanSaved(true);
      toast({ title: 'Planning preferences saved', tone: 'success' });
      window.setTimeout(() => setPlanSaved(false), 2400);
    } catch (error) {
      setPlanError(
        error instanceof Error ? error.message : 'These planning preferences could not be saved.',
      );
    }
  };

  const handleExport = () => {
    try {
      const payload = createExportPayload(data);
      const stamp = new Date().toISOString().slice(0, 10);
      downloadTextFile(`daymark-${stamp}.json`, JSON.stringify(payload, null, 2));
      toast({ title: 'Backup exported', description: 'Keep it somewhere safe.', tone: 'success' });
    } catch {
      toast({ title: 'Export failed', tone: 'error' });
    }
  };

  const handleFileChosen = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setImporting(true);
    try {
      const text = await readTextFile(file);
      const parsed = parseImportText(text);
      setPendingImport(parsed);
    } catch (error) {
      toast({
        title: 'That file could not be imported',
        description: error instanceof Error ? error.message : 'It may not be a Daymark backup.',
        tone: 'error',
        duration: 8000,
      });
    } finally {
      setImporting(false);
    }
  };

  const confirmImport = () => {
    if (!pendingImport) return;
    try {
      store.replace(pendingImport.data);
      toast({
        title: 'Workspace replaced',
        description: `${pendingImport.summary.tasks} task${
          pendingImport.summary.tasks === 1 ? '' : 's'
        } and ${pendingImport.summary.goals} goal${
          pendingImport.summary.goals === 1 ? '' : 's'
        } restored.`,
        tone: 'success',
      });
      setPendingImport(null);
    } catch {
      toast({ title: 'The import could not be saved', tone: 'error' });
    }
  };

  const handleReset = async () => {
    const shouldReset = await confirm({
      title: 'Reset Daymark completely?',
      description: (
        <>
          This removes every task, goal, category, schedule block, and preference stored in this
          browser. Export a backup first if there is anything you want to keep. This cannot be
          undone.
        </>
      ),
      confirmLabel: 'Reset everything',
      tone: 'danger',
      requireText: 'RESET',
    });
    if (!shouldReset) return;
    try {
      store.clearStorage();
      toast({ title: 'Daymark reset', description: 'A clean workspace is ready.', tone: 'success' });
    } catch {
      toast({ title: 'The reset could not be completed', tone: 'error' });
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Make it yours"
        title="Settings"
        description="How Daymark looks, how it plans, and where your data lives. Nothing leaves this browser unless you export it."
      />

      <SettingsCard
        icon={User}
        title="You & appearance"
        description="A name for the greeting, and a theme that suits the light in the room."
      >
        <div className="grid gap-6 sm:grid-cols-2">
          <form onSubmit={handleNameSubmit} className="space-y-3">
            <Field
              label="Your name"
              htmlFor="settings-name"
              hint="Optional. Used only in the greeting on Today."
            >
              <Input
                id="settings-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="What should Daymark call you?"
                maxLength={60}
                autoComplete="given-name"
              />
            </Field>
            <Button
              type="submit"
              variant="secondary"
              size="sm"
              disabled={name.trim() === settings.name}
            >
              <Check className="h-3.5 w-3.5" strokeWidth={2} />
              Save name
            </Button>
          </form>

          <div>
            <p className="text-[12px] font-medium text-ink-soft">Theme</p>
            <p className="mt-1 text-[11.5px] leading-relaxed text-ink-muted">
              Light is the warm paper default. System follows your device.
            </p>
            <SegmentedControl<ThemePreference>
              label="Theme"
              value={settings.theme}
              onChange={handleTheme}
              options={[
                { value: 'light', label: 'Light', icon: <Sun className="h-3 w-3" /> },
                { value: 'system', label: 'System', icon: <Monitor className="h-3 w-3" /> },
                { value: 'dark', label: 'Dark', icon: <Moon className="h-3 w-3" /> },
              ]}
              size="sm"
              className="mt-3 w-full justify-between"
            />
            <div className="mt-4 rounded-xl border border-line/70 bg-canvas/40 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <Palette className="h-3.5 w-3.5 text-accent" strokeWidth={1.8} />
                <p className="text-[10.5px] leading-relaxed text-ink-muted">
                  The theme applies immediately and is remembered on this device.
                </p>
              </div>
            </div>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard
        icon={SlidersHorizontal}
        title="Planning defaults"
        description="The quiet rules the planner starts from. Any single day can have different hours from the Planner."
      >
        <form onSubmit={handlePlanningSubmit} className="space-y-5">
          {planError ? (
            <div
              role="alert"
              className="rounded-xl border border-danger/20 bg-danger-soft px-3.5 py-2.5 text-[12px] leading-relaxed text-danger"
            >
              {planError}
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Week starts on" htmlFor="settings-week-start">
              <Select
                id="settings-week-start"
                value={String(planDraft.weekStartsOn)}
                onChange={(event) =>
                  updateDraft('weekStartsOn', Number(event.target.value) as WeekStartsOn)
                }
              >
                <option value="1">Monday</option>
                <option value="0">Sunday</option>
                <option value="6">Saturday</option>
              </Select>
            </Field>
            <Field label="Time format" htmlFor="settings-time-format">
              <Select
                id="settings-time-format"
                value={planDraft.timeFormat}
                onChange={(event) =>
                  updateDraft('timeFormat', event.target.value as TimeFormat)
                }
              >
                <option value="24h">24-hour · 18:00</option>
                <option value="12h">12-hour · 6:00 PM</option>
              </Select>
            </Field>
            <Field
              label="Default estimate"
              htmlFor="settings-estimate"
              hint="Used for new tasks."
            >
              <div className="relative">
                <Input
                  id="settings-estimate"
                  type="number"
                  min={5}
                  max={480}
                  step={5}
                  value={planDraft.defaultEstimateMinutes}
                  onChange={(event) => updateDraft('defaultEstimateMinutes', event.target.value)}
                  className="pr-12"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-ink-muted">
                  min
                </span>
              </div>
            </Field>
            <div />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Day starts" htmlFor="settings-start">
              <Input
                id="settings-start"
                type="time"
                step={300}
                value={planDraft.workStart}
                onChange={(event) => updateDraft('workStart', event.target.value)}
              />
            </Field>
            <Field
              label="Day ends"
              htmlFor="settings-end"
              hint="00:00 means midnight."
            >
              <Input
                id="settings-end"
                type="time"
                step={300}
                value={planDraft.workEnd}
                onChange={(event) => updateDraft('workEnd', event.target.value)}
              />
            </Field>
            <Field
              label="Break length"
              htmlFor="settings-break"
              hint="0 plans without breaks."
            >
              <div className="relative">
                <Input
                  id="settings-break"
                  type="number"
                  min={0}
                  max={120}
                  step={5}
                  value={planDraft.breakMinutes}
                  onChange={(event) => updateDraft('breakMinutes', event.target.value)}
                  className="pr-12"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-ink-muted">
                  min
                </span>
              </div>
            </Field>
            <Field
              label="Break after"
              htmlFor="settings-break-after"
              hint="Minutes of work before a break."
            >
              <div className="relative">
                <Input
                  id="settings-break-after"
                  type="number"
                  min={15}
                  max={480}
                  step={15}
                  value={planDraft.breakAfterMinutes}
                  onChange={(event) => updateDraft('breakAfterMinutes', event.target.value)}
                  className="pr-12"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-ink-muted">
                  min
                </span>
              </div>
            </Field>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line/70 pt-4">
            <p className="max-w-[430px] text-[10.5px] leading-relaxed text-ink-muted">
              Day-specific hours set in the Planner stay as overrides. Changing these defaults
              updates every day that has not been customized.
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-ink-muted"
                onClick={() => {
                  const defaultDraft = draftFromSettings({ ...settings, ...DEFAULT_SETTINGS });
                  setPlanDraft(defaultDraft);
                  setPlanSaved(false);
                  setPlanError(null);
                }}
              >
                Daymark defaults
              </Button>
              <Button type="submit" size="sm" disabled={planSaved}>
                {planSaved ? (
                  <>
                    <Check className="h-3.5 w-3.5" strokeWidth={2} />
                    Saved
                  </>
                ) : (
                  'Save preferences'
                )}
              </Button>
            </div>
          </div>
        </form>
      </SettingsCard>

      <SettingsCard
        icon={Palette}
        title="Categories"
        description="Quiet labels for the different parts of life. Deleting one moves its tasks and goals to Other."
        action={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setCategoryDialog({})}
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2} />
            Add category
          </Button>
        }
      >
        <ul className="divide-y divide-line/70">
          {data.categories.map((category) => {
            const colors = CATEGORY_COLORS[category.color] ?? CATEGORY_COLORS.slate;
            const taskCount = data.tasks.filter(
              (task) => task.categoryId === category.id,
            ).length;
            const goalCount = data.goals.filter(
              (goal) => goal.categoryId === category.id,
            ).length;
            return (
              <li key={category.id} className="flex items-center gap-3 py-2.5">
                <span className={cn('h-2 w-2 shrink-0 rounded-full', colors.dot)} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-[13px] font-medium text-ink">
                    {category.name}
                    {category.id === CATEGORY_OTHER_ID ? (
                      <span className="rounded-full bg-raised px-1.5 py-0.5 text-[8.5px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                        Built in
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-[10.5px] text-ink-muted">
                    {taskCount} task{taskCount === 1 ? '' : 's'} · {goalCount} goal
                    {goalCount === 1 ? '' : 's'}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2.5 text-[11px] text-ink-muted"
                  onClick={() => setCategoryDialog({ categoryId: category.id })}
                >
                  Edit
                </Button>
              </li>
            );
          })}
        </ul>
      </SettingsCard>

      <SettingsCard
        icon={HardDrive}
        title="Your data"
        description="Everything lives in this browser's local storage. You are the only copy unless you make one."
      >
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={handleExport}>
                <Download className="h-3.5 w-3.5" strokeWidth={1.9} />
                Export backup
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
              >
                <Upload className="h-3.5 w-3.5" strokeWidth={1.9} />
                {importing ? 'Reading…' : 'Import backup'}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(event) => void handleFileChosen(event)}
              />
              <Button
                variant="ghost"
                size="sm"
                className="text-danger hover:bg-danger-soft hover:text-danger"
                onClick={() => void handleReset()}
              >
                Reset Daymark
              </Button>
            </div>
            <p className="text-[11px] leading-relaxed text-ink-muted">
              Export writes a portable JSON file. Import validates the file completely before
              replacing anything, and cancels untouched if validation fails. Resetting cannot be
              undone.
            </p>
            <div className="rounded-xl border border-line/70 bg-canvas/40 px-3.5 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] font-medium text-ink-soft">Stored locally</span>
                <span className="font-tabular text-[11px] text-ink-muted">
                  {formatBytes(storageBytes)}
                </span>
              </div>
              <ProgressBar
                value={Math.min(100, (storageBytes / (5 * 1024 * 1024)) * 100)}
                label="Approximate local storage use"
                tone="sage"
                size="xs"
                className="mt-2"
              />
              <p className="mt-1.5 text-[9.5px] text-ink-muted/80">
                Compared with a typical 5 MB local storage allowance. Your browser manages the
                actual limit.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-line/70 bg-canvas/35 p-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-sage" strokeWidth={1.8} />
              <h3 className="text-[12px] font-medium text-ink">Local by design</h3>
            </div>
            <ul className="mt-3 space-y-2 text-[10.5px] leading-relaxed text-ink-muted">
              <li>No account, no server, no analytics.</li>
              <li>Works after the page has loaded, even offline.</li>
              <li>Tasks and goals are saved after every change.</li>
              <li>Corrupt saved data is set aside, not silently overwritten.</li>
            </ul>
            <p className="mt-3 border-t border-line/70 pt-2 text-[9.5px] text-ink-muted/80">
              Browser data can be cleared by your browser or device. Keep periodic exports for
              anything irreplaceable.
            </p>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard
        icon={Keyboard}
        title="Keyboard shortcuts"
        description="For the days when the mouse feels too slow. Shortcuts pause while you are typing."
      >
        <ul className="grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
          {SHORTCUTS.map((shortcut) => (
            <li
              key={shortcut.label}
              className="flex items-center justify-between gap-3 border-b border-line/50 pb-2 text-[11.5px] text-ink-soft"
            >
              <span>{shortcut.label}</span>
              <span className="flex shrink-0 items-center gap-1 text-ink-muted">
                {shortcut.keys.map((key, index) => (
                  <span key={key} className="flex items-center gap-1">
                    {index > 0 ? <span className="text-[9px]">then</span> : null}
                    <Kbd>{key}</Kbd>
                  </span>
                ))}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[10.5px] text-ink-muted">
          Press <Kbd>?</Kbd> anywhere outside a text field to open the shortcut reference.
        </p>
      </SettingsCard>

      <section className="rounded-2xl border border-line bg-canvas/30 px-5 py-6 text-center sm:py-8">
        <p className="font-display text-[24px] font-normal tracking-[-0.02em] text-ink">
          Make your day clearer.
          <br className="sm:hidden" /> Make your life simpler.
        </p>
        <p className="mx-auto mt-2 max-w-md text-[11px] leading-relaxed text-ink-muted">
          Daymark v1.0 · Built to be quiet, local, and yours. Today is{' '}
          {formatDateLong(today, true)}.
        </p>
        <div className="mt-4 flex items-center justify-center gap-2 text-[10px] text-ink-muted/70">
          <span className="h-1 w-1 rounded-full bg-accent/70" />
          <span>Offline-first personal organizer</span>
          <span className="h-1 w-1 rounded-full bg-accent/70" />
          <span>Data stays in this browser</span>
        </div>
      </section>

      {categoryDialog ? (
        <CategoryEditorDialog
          categoryId={categoryDialog.categoryId}
          onClose={() => setCategoryDialog(null)}
        />
      ) : null}

      {pendingImport ? (
        <ImportPreviewDialog
          parsed={pendingImport}
          onCancel={() => setPendingImport(null)}
          onConfirm={confirmImport}
        />
      ) : null}
    </div>
  );
}

function SettingsCard({
  icon: Icon,
  title,
  description,
  action,
  children,
}: {
  icon: typeof User;
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line/70 px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-raised text-ink-soft">
            <Icon className="h-4 w-4" strokeWidth={1.7} />
          </div>
          <div>
            <h2 className="font-display text-[20px] font-normal leading-tight tracking-[-0.015em] text-ink">
              {title}
            </h2>
            <p className="mt-0.5 max-w-[620px] text-[11.5px] leading-relaxed text-ink-muted">
              {description}
            </p>
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

function ImportPreviewDialog({
  parsed,
  onCancel,
  onConfirm,
}: {
  parsed: ParsedImport;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const summary = parsed.summary;
  const exported = summary.exportedAt
    ? formatDate(summary.exportedAt.slice(0, 10), {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  return (
    <Dialog
      onClose={onCancel}
      eyebrow="Import backup"
      title="Ready to restore"
      description="This file passed validation. Nothing has been changed yet."
      size="sm"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="danger" size="sm" onClick={onConfirm}>
            Replace workspace
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-line bg-canvas/50 p-3.5">
          <p className="text-[11px] font-medium text-ink-soft">The file contains</p>
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11.5px]">
            <div className="flex justify-between">
              <dt className="text-ink-muted">Tasks</dt>
              <dd className="font-tabular text-ink">{summary.tasks}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-muted">Open tasks</dt>
              <dd className="font-tabular text-ink">{summary.openTasks}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-muted">Goals</dt>
              <dd className="font-tabular text-ink">{summary.goals}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-muted">Categories</dt>
              <dd className="font-tabular text-ink">{summary.categories}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-muted">Time blocks</dt>
              <dd className="font-tabular text-ink">{summary.blocks}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-muted">Exported</dt>
              <dd className="text-right text-ink">{exported ?? 'Unknown'}</dd>
            </div>
          </dl>
        </div>
        <div className="rounded-xl border border-danger/20 bg-danger-soft px-3.5 py-2.5 text-[11.5px] leading-relaxed text-danger">
          Importing replaces every task, goal, category, block, and setting currently in this
          browser. Export your current workspace first if you are not certain.
        </div>
      </div>
    </Dialog>
  );
}
