import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button, type ButtonVariant } from './Button';
import { Dialog } from './Dialog';
import { Input } from './Field';

interface ConfirmOptions {
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
  /** Requires the user to type this exact phrase before confirming. */
  requireText?: string;
  requireTextLabel?: string;
}

type ConfirmFunction = (options: ConfirmOptions) => Promise<boolean>;

interface PendingConfirm {
  options: ConfirmOptions;
  resolve: (value: boolean) => void;
}

const ConfirmContext = createContext<ConfirmFunction | null>(null);

export function useConfirm(): ConfirmFunction {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error('useConfirm must be used inside ConfirmProvider.');
  return confirm;
}

function ConfirmDialog({
  options,
  onResolve,
}: {
  options: ConfirmOptions;
  onResolve: (value: boolean) => void;
}) {
  const [text, setText] = useState('');
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const phraseRequired = Boolean(options.requireText);
  const phraseMatches = !phraseRequired || text === options.requireText;

  const initialFocusRef = phraseRequired
    ? inputRef
    : options.tone === 'danger'
      ? cancelRef
      : confirmRef;

  const confirmVariant: ButtonVariant = options.tone === 'danger' ? 'danger' : 'primary';

  const handleConfirm = () => {
    if (!phraseMatches) return;
    onResolve(true);
  };

  return (
    <Dialog
      onClose={() => onResolve(false)}
      title={options.title}
      size="sm"
      initialFocusRef={initialFocusRef}
      footer={
        <>
          <Button ref={cancelRef} variant="secondary" size="sm" onClick={() => onResolve(false)}>
            {options.cancelLabel ?? 'Cancel'}
          </Button>
          <Button
            ref={confirmRef}
            variant={confirmVariant}
            size="sm"
            disabled={!phraseMatches}
            onClick={handleConfirm}
          >
            {options.confirmLabel ?? 'Confirm'}
          </Button>
        </>
      }
    >
      <div className="flex gap-3 pt-1">
        {options.tone === 'danger' ? (
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger">
            <AlertTriangle className="h-4 w-4" strokeWidth={1.8} />
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="text-[13px] leading-relaxed text-ink-soft">{options.description}</div>
          {options.requireText ? (
            <div className="mt-4">
              <label
                htmlFor="confirm-phrase"
                className="text-[12px] font-medium text-ink-soft"
              >
                {options.requireTextLabel ?? `Type “${options.requireText}” to confirm`}
              </label>
              <Input
                ref={inputRef}
                id="confirm-phrase"
                value={text}
                onChange={(event) => setText(event.target.value)}
                autoComplete="off"
                spellCheck={false}
                className="mt-1.5"
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    handleConfirm();
                  }
                }}
              />
            </div>
          ) : null}
        </div>
      </div>
    </Dialog>
  );
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const pendingRef = useRef<PendingConfirm | null>(null);

  const finish = useCallback((value: boolean) => {
    const current = pendingRef.current;
    pendingRef.current = null;
    setPending(null);
    current?.resolve(value);
  }, []);

  const confirm = useCallback<ConfirmFunction>((options) => {
    return new Promise<boolean>((resolve) => {
      pendingRef.current?.resolve(false);
      const next = { options, resolve };
      pendingRef.current = next;
      setPending(next);
    });
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending ? (
        <ConfirmDialog
          key={`${pending.options.title}-${pending.options.confirmLabel ?? ''}`}
          options={pending.options}
          onResolve={finish}
        />
      ) : null}
    </ConfirmContext.Provider>
  );
}
