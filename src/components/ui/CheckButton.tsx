import { Check } from 'lucide-react';
import { cn } from '../../lib/cn';

interface CheckButtonProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  className?: string;
}

const SIZES = {
  sm: 'h-[17px] w-[17px]',
  md: 'h-[19px] w-[19px]',
  lg: 'h-[22px] w-[22px]',
};

const ICON_SIZES = {
  sm: 'h-2.5 w-2.5',
  md: 'h-3 w-3',
  lg: 'h-3.5 w-3.5',
};

export function CheckButton({
  checked,
  onCheckedChange,
  label,
  size = 'md',
  disabled = false,
  className,
}: CheckButtonProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onCheckedChange(!checked);
      }}
      className={cn(
        'pressable flex shrink-0 items-center justify-center rounded-full border-[1.5px]',
        SIZES[size],
        checked
          ? 'border-accent bg-accent text-canvas'
          : 'border-line-strong bg-transparent text-transparent hover:border-accent/70 hover:bg-accent/5',
        disabled && 'cursor-not-allowed opacity-40',
        className,
      )}
    >
      <Check
        strokeWidth={3.2}
        className={cn(
          ICON_SIZES[size],
          'transition-all duration-200',
          checked ? 'scale-100 opacity-100' : 'scale-50 opacity-0',
        )}
      />
    </button>
  );
}
