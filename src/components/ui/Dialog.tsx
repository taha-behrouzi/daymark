import {
  useEffect,
  useId,
  useRef,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/cn';
import { IconButton } from './Button';

type DialogSize = 'sm' | 'md' | 'lg';

interface DialogProps {
  onClose: () => void;
  title: ReactNode;
  eyebrow?: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: DialogSize;
  drawer?: boolean;
  initialFocusRef?: RefObject<HTMLElement | null>;
  className?: string;
  bodyClassName?: string;
  footerClassName?: string;
}

const SIZES: Record<DialogSize, string> = {
  sm: 'w-[min(420px,calc(100vw-2rem))]',
  md: 'w-[min(540px,calc(100vw-2rem))]',
  lg: 'w-[min(680px,calc(100vw-2rem))]',
};

export function Dialog({
  onClose,
  title,
  eyebrow,
  description,
  children,
  footer,
  size = 'md',
  drawer = false,
  initialFocusRef,
  className,
  bodyClassName,
  footerClassName,
}: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const node = dialogRef.current;
    if (!node) return;
    if (!node.open) node.showModal();
    const frame = window.requestAnimationFrame(() => {
      if (initialFocusRef?.current) {
        initialFocusRef.current.focus();
      }
    });
    return () => {
      window.cancelAnimationFrame(frame);
      if (node.open) node.close();
    };
    // The dialog is mounted only while it should be open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBackdropClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === dialogRef.current) onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={handleBackdropClick}
      className={cn(
        'animate-dialog-in flex flex-col overflow-hidden border border-line bg-surface text-ink shadow-lift',
        drawer
          ? 'dialog-drawer'
          : cn('m-auto max-h-[calc(100dvh-2rem)] rounded-2xl', SIZES[size]),
        className,
      )}
    >
      <div className="flex shrink-0 items-start justify-between gap-4 px-6 pb-4 pt-[max(1.5rem,calc(env(safe-area-inset-top)+1rem))] md:pt-6">
        <div className="min-w-0">
          {eyebrow ? (
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
              {eyebrow}
            </div>
          ) : null}
          <h2
            id={titleId}
            className="font-display text-[25px] font-normal leading-[1.1] tracking-[-0.02em] text-ink"
          >
            {title}
          </h2>
          {description ? (
            <p
              id={descriptionId}
              className="mt-1.5 max-w-[440px] text-[12.5px] leading-relaxed text-ink-muted"
            >
              {description}
            </p>
          ) : null}
        </div>
        <IconButton label="Close dialog" onClick={onClose} className="-mr-1.5 -mt-1">
          <X className="h-4 w-4" strokeWidth={1.8} />
        </IconButton>
      </div>

      <div
        className={cn(
          'min-h-0 flex-1 overflow-y-auto px-6 pb-6 [scrollbar-gutter:stable]',
          bodyClassName,
        )}
      >
        {children}
      </div>

      {footer ? (
        <footer
          className={cn(
            'flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-line bg-surface px-6 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 md:pb-4',
            footerClassName,
          )}
        >
          {footer}
        </footer>
      ) : null}
    </dialog>
  );
}
