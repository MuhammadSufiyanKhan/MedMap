import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Shows a spinner and blocks clicks while keeping the button focusable. */
  loading?: boolean;
  icon?: ReactNode;
  fullWidth?: boolean;
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-primary text-on-primary hover:bg-primary-hover border-transparent',
  secondary: 'bg-surface-raised text-text border-border-strong hover:bg-surface-sunken',
  ghost: 'bg-transparent text-primary border-transparent hover:bg-primary-soft',
  danger: 'bg-surface-raised text-danger border-danger hover:bg-danger-soft',
};

const SIZES: Record<Size, string> = {
  md: 'min-h-touch px-4 text-base',
  lg: 'min-h-[3.25rem] px-6 text-lg',
};

/** The one button component. Every variant keeps a 44px target and a visible focus ring. */
export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  fullWidth = false,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md border font-semibold',
        'transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60',
        VARIANTS[variant],
        SIZES[size],
        fullWidth && 'w-full',
        className,
      )}
      disabled={disabled === true || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? (
        <span
          className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent"
          aria-hidden="true"
        />
      ) : (
        icon
      )}
      <span>{children}</span>
    </button>
  );
}
