import { useRef, useState, type FormEvent } from 'react';
import { RotateCcw, SunMedium } from 'lucide-react';
import { getPlannerDay, resetPlannerDay, updatePlannerDay } from '../../domain/planner';
import { formatDateLong, minutesToTimeValue, timeValueToMinutes } from '../../lib/date';
import { cn } from '../../lib/cn';
import { useAppData, useAppStore } from '../../store/AppStoreProvider';
import { Dialog } from '../../components/ui/Dialog';
import { Button } from '../../components/ui/Button';
import { Field, Input } from '../../components/ui/Field';
import { useToast } from '../../components/ui/toast';

interface DayHoursDialogProps {
  date: string;
  onClose: () => void;
}

const PRESETS = [
  { label: 'Early', start: 7 * 60, end: 15 * 60 },
  { label: 'Classic', start: 8 * 60, end: 18 * 60 },
  { label: 'Late', start: 10 * 60, end: 20 * 60 },
];

export function DayHoursDialog({ date, onClose }: DayHoursDialogProps) {
  const data = useAppData();
  const store = useAppStore();
  const toast = useToast();
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const plannerDay = getPlannerDay(data, date);
  const hasOverride = Boolean(data.plannerDays[date]);
  const [start, setStart] = useState(minutesToTimeValue(plannerDay.startMin));
  const [end, setEnd] = useState(
    plannerDay.endMin >= 1440 ? '00:00' : minutesToTimeValue(plannerDay.endMin),
  );
  const [breakMinutes, setBreakMinutes] = useState(String(plannerDay.breakMinutes));
  const [breakAfter, setBreakAfter] = useState(String(plannerDay.breakAfterMinutes));
  const [error, setError] = useState<string | null>(null);

  const applyPreset = (presetStart: number, presetEnd: number) => {
    setStart(minutesToTimeValue(presetStart));
    setEnd(minutesToTimeValue(presetEnd));
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const startMin = timeValueToMinutes(start);
    const endMin = timeValueToMinutes(end);
    const breakValue = Number(breakMinutes);
    const afterValue = Number(breakAfter);
    if (startMin === null || endMin === null) {
      setError('Choose a valid start and end time.');
      return;
    }
    if (!Number.isInteger(breakValue) || breakValue < 0 || breakValue > 120) {
      setError('Break length must be a whole number between 0 and 120 minutes.');
      return;
    }
    if (!Number.isInteger(afterValue) || afterValue < 15 || afterValue > 480) {
      setError('Break interval must be between 15 and 480 minutes.');
      return;
    }
    try {
      store.update((state) =>
        updatePlannerDay(state, date, {
          startMin,
          endMin: end === '00:00' ? 1440 : endMin,
          breakMinutes: breakValue,
          breakAfterMinutes: afterValue,
        }),
      );
      toast({ title: 'Day hours updated', tone: 'success' });
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'These hours could not be saved.');
    }
  };

  const handleReset = () => {
    try {
      store.update((state) => resetPlannerDay(state, date));
      toast({ title: 'Weekly hours restored', tone: 'success' });
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'These hours could not be reset.');
    }
  };

  return (
    <Dialog
      onClose={onClose}
      eyebrow="Available time"
      title="Set this day’s hours"
      description={`${formatDateLong(date)}. Weekly hours apply to every day until you change a specific one.`}
      initialFocusRef={firstFieldRef}
      size="md"
      footer={
        <>
          {hasOverride ? (
            <Button
              variant="ghost"
              size="sm"
              className="mr-auto text-ink-muted"
              onClick={handleReset}
            >
              <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.8} />
              Use weekly hours
            </Button>
          ) : null}
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="day-hours-form" size="sm">
            Save hours
          </Button>
        </>
      }
    >
      <form id="day-hours-form" onSubmit={handleSubmit} className="space-y-5">
        <div className="flex items-center gap-2 rounded-xl bg-raised/60 px-3 py-2.5 text-[11.5px] leading-relaxed text-ink-muted">
          <SunMedium className="h-3.5 w-3.5 shrink-0 text-gold" strokeWidth={1.8} />
          These hours tell the planner when it may place work. It will never schedule outside
          them automatically.
        </div>

        {error ? (
          <div
            role="alert"
            className="rounded-xl border border-danger/20 bg-danger-soft px-3.5 py-2.5 text-[12px] leading-relaxed text-danger"
          >
            {error}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((preset) => {
            const active =
              start === minutesToTimeValue(preset.start) && end === minutesToTimeValue(preset.end);
            return (
              <button
                key={preset.label}
                type="button"
                onClick={() => applyPreset(preset.start, preset.end)}
                className={cn(
                  'pressable rounded-full border px-2.5 py-1 text-[11.5px] font-medium',
                  active
                    ? 'border-accent/25 bg-accent-soft text-accent'
                    : 'border-line text-ink-muted hover:border-line-strong hover:text-ink',
                )}
              >
                {preset.label} · {minutesToTimeValue(preset.start)}–
                {minutesToTimeValue(preset.end)}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Starts" htmlFor="day-start">
            <Input
              ref={firstFieldRef}
              id="day-start"
              type="time"
              step={300}
              value={start}
              onChange={(event) => setStart(event.target.value)}
            />
          </Field>
          <Field label="Ends" htmlFor="day-end" hint="Use 00:00 for midnight.">
            <Input
              id="day-end"
              type="time"
              step={300}
              value={end}
              onChange={(event) => setEnd(event.target.value)}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Break length"
            htmlFor="day-break"
            hint="Minutes. Set 0 to plan without breaks."
          >
            <div className="relative">
              <Input
                id="day-break"
                type="number"
                min={0}
                max={120}
                step={5}
                value={breakMinutes}
                onChange={(event) => setBreakMinutes(event.target.value)}
                className="pr-12"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-ink-muted">
                min
              </span>
            </div>
          </Field>
          <Field
            label="Break after"
            htmlFor="day-break-after"
            hint="Minutes of focus before a break."
          >
            <div className="relative">
              <Input
                id="day-break-after"
                type="number"
                min={15}
                max={480}
                step={15}
                value={breakAfter}
                onChange={(event) => setBreakAfter(event.target.value)}
                className="pr-12"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-ink-muted">
                min
              </span>
            </div>
          </Field>
        </div>
      </form>
    </Dialog>
  );
}
