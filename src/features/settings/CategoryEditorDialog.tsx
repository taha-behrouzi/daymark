import { useRef, useState, type FormEvent } from 'react';
import { Trash2 } from 'lucide-react';
import {
  CATEGORY_COLORS,
  CATEGORY_COLOR_KEYS,
  CATEGORY_OTHER_ID,
} from '../../constants';
import { addCategory, deleteCategory, updateCategory } from '../../domain/categories';
import { cn } from '../../lib/cn';
import { useAppData, useAppStore } from '../../store/AppStoreProvider';
import type { CategoryColor } from '../../types';
import { Dialog } from '../../components/ui/Dialog';
import { Button } from '../../components/ui/Button';
import { Field, Input } from '../../components/ui/Field';
import { useToast } from '../../components/ui/toast';
import { useConfirm } from '../../components/ui/confirm';

interface CategoryEditorDialogProps {
  categoryId?: string;
  onClose: () => void;
}

export function CategoryEditorDialog({ categoryId, onClose }: CategoryEditorDialogProps) {
  const data = useAppData();
  const store = useAppStore();
  const toast = useToast();
  const confirm = useConfirm();
  const nameRef = useRef<HTMLInputElement>(null);
  const existing = categoryId
    ? data.categories.find((category) => category.id === categoryId)
    : undefined;
  const isOther = existing?.id === CATEGORY_OTHER_ID;

  const [name, setName] = useState(existing?.name ?? '');
  const [color, setColor] = useState<CategoryColor>(
    existing?.color ??
      CATEGORY_COLOR_KEYS[data.categories.length % CATEGORY_COLOR_KEYS.length] ??
      'slate',
  );
  const [error, setError] = useState<string | null>(null);

  const usageTasks = existing
    ? data.tasks.filter((task) => task.categoryId === existing.id).length
    : 0;
  const usageGoals = existing
    ? data.goals.filter((goal) => goal.categoryId === existing.id).length
    : 0;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    try {
      store.update((state) => {
        if (existing) {
          return updateCategory(state, existing.id, { name, color });
        }
        return addCategory(state, { name, color });
      });
      toast({
        title: existing ? 'Category updated' : 'Category added',
        tone: 'success',
      });
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The category could not be saved.');
    }
  };

  const handleDelete = async () => {
    if (!existing) return;
    const shouldDelete = await confirm({
      title: 'Delete this category?',
      description: (
        <>
          “{existing.name}” will be removed. Any task or goal using it will move to{' '}
          <strong>Other</strong> — nothing is deleted.
        </>
      ),
      confirmLabel: 'Delete category',
      tone: 'danger',
    });
    if (!shouldDelete) return;
    try {
      store.update((state) => deleteCategory(state, existing.id));
      toast({ title: 'Category deleted', tone: 'success' });
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The category could not be deleted.');
    }
  };

  return (
    <Dialog
      onClose={onClose}
      eyebrow={existing ? 'Edit category' : 'New category'}
      title={existing ? existing.name : 'Add a category'}
      description={
        existing
          ? 'Categories are for gentle grouping, not for making your life look tidy.'
          : 'A short label and a quiet color. You can change both later.'
      }
      size="sm"
      initialFocusRef={nameRef}
      footer={
        <>
          {existing && !isOther ? (
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
          <Button type="submit" form="category-editor-form" size="sm">
            {existing ? 'Save category' : 'Add category'}
          </Button>
        </>
      }
    >
      <form id="category-editor-form" onSubmit={handleSubmit} className="space-y-5">
        {error ? (
          <div
            role="alert"
            className="rounded-xl border border-danger/20 bg-danger-soft px-3.5 py-2.5 text-[12px] leading-relaxed text-danger"
          >
            {error}
          </div>
        ) : null}

        {isOther ? (
          <p className="rounded-xl bg-raised/70 px-3.5 py-2.5 text-[11.5px] leading-relaxed text-ink-muted">
            Other is the built-in fallback category. It can be renamed and recolored, but it
            cannot be deleted — your tasks always need somewhere to land.
          </p>
        ) : null}

        <Field label="Name" htmlFor="category-name">
          <Input
            ref={nameRef}
            id="category-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Reading, Studio, Errands…"
            maxLength={24}
            autoComplete="off"
          />
        </Field>

        <fieldset>
          <legend className="text-[12px] font-medium text-ink-soft">Color</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {CATEGORY_COLOR_KEYS.map((key) => {
              const style = CATEGORY_COLORS[key];
              const active = color === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setColor(key)}
                  className={cn(
                    'pressable inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium',
                    active
                      ? 'border-ink/25 bg-raised text-ink'
                      : 'border-line text-ink-muted hover:border-line-strong hover:text-ink',
                  )}
                >
                  <span className={cn('h-2.5 w-2.5 rounded-full', style.dot)} />
                  {style.label}
                  {active ? <span className="sr-only"> selected</span> : null}
                </button>
              );
            })}
          </div>
        </fieldset>

        {existing ? (
          <p className="border-t border-line pt-3 text-[11px] text-ink-muted">
            Used by {usageTasks} task{usageTasks === 1 ? '' : 's'} and {usageGoals} goal
            {usageGoals === 1 ? '' : 's'} across Daymark.
          </p>
        ) : null}
      </form>
    </Dialog>
  );
}
