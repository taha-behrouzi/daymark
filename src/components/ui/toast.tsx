import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { cn } from '../../lib/cn';
import { IconButton } from './Button';

export type ToastTone = 'default' | 'success' | 'error' | 'info';

export interface ToastOptions {
  title: string;
  description?: string;
  tone?: ToastTone;
  action?: { label: string; onClick: () => void };
  duration?: number;
}

interface ToastRecord extends ToastOptions {
  id: number;
}

type ToastFunction = (options: ToastOptions) => void;

const ToastContext = createContext<ToastFunction | null>(null);

export function useToast(): ToastFunction {
  const toast = useContext(ToastContext);
  if (!toast) throw new Error('useToast must be used inside ToastProvider.');
  return toast;
}

const TONE_ICONS = {
  default: Info,
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};

const TONE_CLASSES = {
  default: 'text-accent',
  success: 'text-sage',
  error: 'text-danger',
  info: 'text-ink-muted',
};

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: ToastRecord;
  onDismiss: (id: number) => void;
}) {
  const Icon = TONE_ICONS[toast.tone ?? 'default'];
  const duration = toast.duration ?? (toast.action ? 8000 : 4800);

  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(toast.id), duration);
    return () => window.clearTimeout(timer);
  }, [duration, onDismiss, toast.id]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-auto flex w-full animate-toast-in items-start gap-3 rounded-xl border border-line bg-surface/95 p-4 shadow-lift backdrop-blur-sm"
    >
      <Icon
        aria-hidden="true"
        className={cn('mt-0.5 h-4 w-4 shrink-0', TONE_CLASSES[toast.tone ?? 'default'])}
        strokeWidth={1.9}
      />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium leading-snug text-ink">{toast.title}</p>
        {toast.description ? (
          <p className="mt-1 text-[12px] leading-relaxed text-ink-muted">{toast.description}</p>
        ) : null}
        {toast.action ? (
          <button
            type="button"
            onClick={() => {
              toast.action?.onClick();
              onDismiss(toast.id);
            }}
            className="mt-2 text-[12px] font-semibold text-accent hover:text-accent-hover"
          >
            {toast.action.label}
          </button>
        ) : null}
      </div>
      <IconButton
        label="Dismiss notification"
        size="sm"
        className="-mr-1 -mt-1 h-6 w-6"
        onClick={() => onDismiss(toast.id)}
      >
        <X className="h-3 w-3" strokeWidth={2} />
      </IconButton>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((options: ToastOptions) => {
    counter.current += 1;
    const id = counter.current;
    setToasts((current) => [...current.slice(-2), { ...options, id }]);
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div className="pointer-events-none fixed inset-x-4 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-[90] flex flex-col items-end gap-2 md:inset-x-auto md:bottom-6 md:right-6 md:w-[380px]">
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
