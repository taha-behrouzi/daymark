import {
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { Plus, Sparkles, Trash2, X } from 'lucide-react';
import { addDays, formatFriendlyDate, todayKey } from '../../lib/date';
import { uid } from '../../lib/id';
import { cn } from '../../lib/cn';
import {
  addGoal,
  computeMilestoneProgress,
  deleteGoal,
  updateGoal,
} from '../../domain/goals';
import { useAppData, useAppStore } from '../../store/AppStoreProvider';
import { Button, IconButton } from '../../components/ui/Button';
import { CheckButton } from '../../components/ui/CheckButton';
import { Dialog } from '../../components/ui/Dialog';
import { Field, Input, Select, Textarea } from '../../components/ui/Field';
import { ProgressBar } from '../../components/ui/Progress';
import { useToast } from '../../components/ui/toast';
import { useConfirm } from '../../components/ui/confirm';

interface GoalEditorDialogProps {
  goalId?: string;
  onClose: () => void;
}

interface EditableMilestone {
  id: string;
  title: string;
  done: boolean;
}

interface FormErrors {
  title?: string;
  targetDate?: string;
}

export function GoalEditorDialog({ goalId, onClose }: GoalEditorDialogProps) {
  const data = useAppData();
  const store = useAppStore();
  const toast = useToast();
  const confirm = useConfirm();
  const today = todayKey();
  const existing = goalId ? data.goals.find((goal) => goal.id === goalId) : undefined;
  const titleRef = useRef<HTMLInputElement>(null);

  const defaultCategoryId =
    data.categories.find((category) => category.id === 'cat-personal')?.id ??
    data.categories[0]?.id ??
    '';

  const [title, setTitle] = useState(existing?.title ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [categoryId, setCategoryId] = useState(existing?.categoryId ?? defaultCategoryId);
  const [targetDate, setTargetDate] = useState(
    existing?.targetDate ?? addDays(today, 30),
  );
  const [progress, setProgress] = useState(existing?.progress ?? 0);
  const [milestones, setMilestones] = useState<EditableMilestone[]>(
    existing?.milestones.map((milestone) => ({ ...milestone })) ?? [],
  );
  const [newMilestone, setNewMilestone] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const milestoneProgress = computeMilestoneProgress(
    milestones.map((milestone) => ({
      id: milestone.id,
      title: milestone.title,
      done: milestone.done,
    })),
  );

  const syncProgress = (nextMilestones: EditableMilestone[]) => {
    const synced = computeMilestoneProgress(
      nextMilestones.map((milestone) => ({
        id: milestone.id,
        title: milestone.title,
        done: milestone.done,
      })),
    );
    if (synced !== null) setProgress(synced);
  };

  const addMilestone = () => {
    const clean = newMilestone.trim();
    if (!clean) return;
    const next = [...milestones, { id: uid('ms'), title: clean, done: false }];
    setMilestones(next);
    setNewMilestone('');
  };

  const handleMilestoneKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      addMilestone();
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const nextErrors: FormErrors = {};
    if (!title.trim()) nextErrors.title = 'Give this goal a title.';
    if (!targetDate) nextErrors.targetDate = 'Choose a target date.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    let finalMilestones = milestones.map((milestone) => ({
      id: milestone.id,
      title: milestone.title,
      done: milestone.done,
    }));
    if (newMilestone.trim()) {
      finalMilestones = [
        ...finalMilestones,
        { id: uid('ms'), title: newMilestone.trim(), done: false },
      ];
    }

    try {
      store.update((state) => {
        if (existing) {
          return updateGoal(state, existing.id, {
            title,
            description,
            categoryId,
            targetDate,
            progress,
            milestones: finalMilestones,
          });
        }
        return addGoal(state, {
          title,
          description,
          categoryId,
          targetDate,
          progress,
          milestones: finalMilestones,
        });
      });
      toast({ title: existing ? 'Goal updated' : 'Goal created', tone: 'success' });
      onClose();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'The goal could not be saved.');
    }
  };

  const handleDelete = async () => {
    if (!existing) return;
    const shouldDelete = await confirm({
      title: 'Delete this goal?',
      description: `“${existing.title}” and its milestones will be permanently removed.`,
      confirmLabel: 'Delete goal',
      tone: 'danger',
    });
    if (!shouldDelete) return;
    try {
      store.update((state) => deleteGoal(state, existing.id));
      toast({ title: 'Goal deleted', tone: 'success' });
      onClose();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'The goal could not be deleted.');
    }
  };

  return (
    <Dialog
      onClose={onClose}
      eyebrow={existing ? `Goal · ${existing.status}` : 'New goal'}
      title={existing ? existing.title : 'Set a goal'}
      description={
        existing
          ? 'Milestones make progress visible. Adjust them as the path changes.'
          : 'Name something worth moving toward. Break it into a few honest steps.'
      }
      drawer
      initialFocusRef={titleRef}
      footer={
        <>
          {existing ? (
            <Button
              variant="ghost"
              size="sm"
              className="mr-auto text-danger hover:bg-danger-soft hover:text-danger"
              onClick={() => void handleDelete()}
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} />
              Delete
            </Button>
          ) : null}
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="goal-editor-form" size="sm">
            {existing ? 'Save changes' : 'Create goal'}
          </Button>
        </>
      }
    >
      <form id="goal-editor-form" onSubmit={handleSubmit} className="space-y-5 pb-1">
        {formError ? (
          <div
            role="alert"
            className="rounded-xl border border-danger/20 bg-danger-soft px-3.5 py-2.5 text-[12px] leading-relaxed text-danger"
          >
            {formError}
          </div>
        ) : null}

        <Field label="Goal" htmlFor="goal-title" error={errors.title}>
          <Input
            ref={titleRef}
            id="goal-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="What are you working toward?"
            maxLength={160}
            invalid={Boolean(errors.title)}
            autoComplete="off"
            className="h-11 text-[15px] font-medium"
          />
        </Field>

        <Field label="Why it matters" htmlFor="goal-description" optionalLabel>
          <Textarea
            id="goal-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="A sentence to return to when motivation dips…"
            maxLength={4000}
            rows={3}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Category" htmlFor="goal-category">
            <Select
              id="goal-category"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
            >
              {data.categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Target date"
            htmlFor="goal-target"
            error={errors.targetDate}
          >
            <Input
              id="goal-target"
              type="date"
              value={targetDate}
              onChange={(event) => setTargetDate(event.target.value)}
              invalid={Boolean(errors.targetDate)}
            />
          </Field>
        </div>

        <div className="rounded-xl border border-line bg-canvas/40 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-[12px] font-medium text-ink-soft">Progress</h3>
              <p className="mt-0.5 text-[11px] leading-relaxed text-ink-muted">
                {milestones.length > 0
                  ? 'Milestones sync progress. You can still fine-tune it.'
                  : 'Set a progress level, or add milestones to move it automatically.'}
              </p>
            </div>
            <span className="font-display text-[26px] leading-none text-ink">{progress}%</span>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={progress}
              aria-label="Goal progress"
              onChange={(event) => setProgress(Number(event.target.value))}
              className="h-1.5 w-full cursor-pointer accent-accent"
            />
          </div>
          <ProgressBar value={progress} label="Goal progress" className="mt-3" />
          {milestoneProgress !== null && milestoneProgress !== progress ? (
            <button
              type="button"
              onClick={() => setProgress(milestoneProgress)}
              className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-medium text-accent hover:text-accent-hover"
            >
              <Sparkles className="h-3 w-3" strokeWidth={1.8} />
              Match milestones ({milestoneProgress}%)
            </button>
          ) : null}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <label className="text-[12px] font-medium text-ink-soft">Milestones</label>
            <span className="text-[11px] text-ink-muted">
              {milestones.filter((milestone) => milestone.done).length}/{milestones.length} done
            </span>
          </div>
          {milestones.length > 0 ? (
            <div className="space-y-1.5">
              {milestones.map((milestone, index) => (
                <div
                  key={milestone.id}
                  className="group flex items-center gap-2 rounded-lg border border-transparent px-1 py-1 transition-colors hover:border-line hover:bg-canvas/30"
                >
                  <CheckButton
                    checked={milestone.done}
                    size="sm"
                    label={`Mark milestone ${index + 1} ${milestone.done ? 'incomplete' : 'complete'}`}
                    onCheckedChange={(checked) => {
                      const next = milestones.map((candidate) =>
                        candidate.id === milestone.id
                          ? { ...candidate, done: checked }
                          : candidate,
                      );
                      setMilestones(next);
                      syncProgress(next);
                    }}
                  />
                  <Input
                    value={milestone.title}
                    aria-label={`Milestone ${index + 1} title`}
                    onChange={(event) =>
                      setMilestones((current) =>
                        current.map((candidate) =>
                          candidate.id === milestone.id
                            ? { ...candidate, title: event.target.value }
                            : candidate,
                        ),
                      )
                    }
                    maxLength={160}
                    className={cn(
                      'h-8 border-transparent bg-transparent px-1 text-[13px] hover:border-transparent focus:bg-canvas',
                      milestone.done && 'text-ink-muted line-through',
                    )}
                  />
                  <IconButton
                    label="Remove milestone"
                    size="sm"
                    className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                    onClick={() => {
                      const next = milestones.filter(
                        (candidate) => candidate.id !== milestone.id,
                      );
                      setMilestones(next);
                      syncProgress(next);
                    }}
                  >
                    <X className="h-3 w-3" strokeWidth={2} />
                  </IconButton>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-line px-3 py-4 text-center text-[12px] text-ink-muted">
              No milestones yet. A goal can simply be a direction.
            </p>
          )}
          <div className="mt-2 flex items-center gap-2">
            <Input
              value={newMilestone}
              onChange={(event) => setNewMilestone(event.target.value)}
              onKeyDown={handleMilestoneKey}
              placeholder="Add a milestone…"
              maxLength={160}
              className="h-9 flex-1 bg-transparent"
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={addMilestone}
              disabled={!newMilestone.trim()}
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2} />
              Add
            </Button>
          </div>
          {targetDate ? (
            <p className="mt-3 text-[11px] text-ink-muted">
              Target: {formatFriendlyDate(targetDate, today)}
            </p>
          ) : null}
        </div>
      </form>
    </Dialog>
  );
}
