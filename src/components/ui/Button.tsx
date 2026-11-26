import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'subtle'
  | 'accent'
  | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const BASE =
  'pressable inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium disabled:pointer-events-none disabled:opacity-40';

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-ink text-canvas shadow-[0_1px_1px_rgb(0_0_0/0.06)] hover:bg-ink/90',
  secondary:
    'border border-line bg-surface text-ink hover:border-line-strong hover:bg-raised/60',
  ghost: 'text-ink-soft hover:bg-raised/80 hover:text-ink',
  subtle: 'bg-raised text-ink hover:bg-line/70',
  accent:
    'bg-accent text-white shadow-[0_1px_2px_rgb(0_0_0/0.08)] hover:bg-accent-hover dark:text-[#211510]',
  danger: 'bg-danger text-white hover:bg-danger/90 dark:text-[#1f1210]',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[12.5px]',
  md: 'h-9 px-4 text-[13px]',
  lg: 'h-11 px-5 text-sm',
};

export function buttonClasses(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  className?: string,
): string {
  return cn(BASE, VARIANTS[variant], SIZES[size], className);
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', className, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={buttonClasses(variant, size, className)}
      {...props}
    />
  );
});

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required for icon-only controls. */
  label: string;
  variant?: 'ghost' | 'secondary' | 'subtle';
  size?: 'sm' | 'md' | 'lg';
}

const ICON_SIZES = {
  sm: 'h-7 w-7',
  md: 'h-8 w-8',
  lg: 'h-10 w-10',
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    { label, variant = 'ghost', size = 'md', className, type = 'button', ...props },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        aria-label={label}
        title={label}
        className={cn(
          'pressable inline-flex shrink-0 items-center justify-center rounded-full text-ink-muted disabled:pointer-events-none disabled:opacity-40',
          variant === 'ghost' && 'hover:bg-raised hover:text-ink',
          variant === 'secondary' &&
            'border border-line bg-surface text-ink hover:border-line-strong hover:bg-raised/60',
          variant === 'subtle' && 'bg-raised text-ink-soft hover:bg-line/70 hover:text-ink',
          ICON_SIZES[size],
          className,
        )}
        {...props}
      />
    );
  },
);
