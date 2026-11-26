import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/cn';

const FIELD_BASE =
  'w-full rounded-xl border border-line bg-canvas/70 text-[14px] text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-colors placeholder:text-ink-muted/70 hover:border-line-strong focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/15 disabled:cursor-not-allowed disabled:opacity-50';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid = false, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        FIELD_BASE,
        'h-10 px-3',
        invalid && 'border-danger/60 focus:border-danger focus:ring-danger/15',
        className,
      )}
      {...props}
    />
  );
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ className, invalid = false, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          FIELD_BASE,
          'min-h-[92px] resize-y px-3 py-2.5 leading-relaxed',
          invalid && 'border-danger/60 focus:border-danger focus:ring-danger/15',
          className,
        )}
        {...props}
      />
    );
  },
);

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  wrapperClassName?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, wrapperClassName, children, ...props },
  ref,
) {
  return (
    <span className={cn('relative block', wrapperClassName)}>
      <select
        ref={ref}
        className={cn(
          FIELD_BASE,
          'h-10 cursor-pointer appearance-none py-0 pl-3 pr-9',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted"
        strokeWidth={1.8}
      />
    </span>
  );
});

interface FieldProps {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
  optionalLabel?: boolean;
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
  optionalLabel = false,
}: FieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label
          htmlFor={htmlFor}
          className="text-[12px] font-medium tracking-[0.01em] text-ink-soft"
        >
          {label}
          {optionalLabel ? (
            <span className="ml-1 font-normal text-ink-muted/70">optional</span>
          ) : null}
        </label>
      </div>
      {children}
      {error ? (
        <p className="text-[11.5px] font-medium text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-[11.5px] leading-relaxed text-ink-muted">{hint}</p>
      ) : null}
    </div>
  );
}
