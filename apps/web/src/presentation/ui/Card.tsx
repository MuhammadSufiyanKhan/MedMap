import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** `raised` sits above the page with a shadow; `flat` is outlined only. */
  variant?: 'raised' | 'flat';
  padding?: 'md' | 'lg' | 'none';
}

export function Card({ variant = 'flat', padding = 'md', className, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-surface-raised',
        variant === 'raised' && 'shadow-raised',
        padding === 'md' && 'p-4 md:p-5',
        padding === 'lg' && 'p-5 md:p-8',
        className,
      )}
      {...rest}
    />
  );
}

export type BadgeTone =
  'neutral' | 'serious' | 'moderate' | 'minor' | 'unchecked' | 'primary' | 'demo';

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-sunken text-text border-border',
  serious: 'bg-severity-serious-soft text-severity-serious border-severity-serious',
  moderate: 'bg-severity-moderate-soft text-severity-moderate border-severity-moderate',
  minor: 'bg-severity-minor-soft text-severity-minor border-severity-minor',
  unchecked: 'hatched bg-unchecked-soft text-text border-unchecked border-dashed',
  primary: 'bg-primary-soft text-primary border-primary',
  demo: 'bg-demo text-on-demo border-demo',
};

/** A small static label. Badges never animate. */
export function Badge({
  tone = 'neutral',
  icon,
  children,
  className,
}: {
  tone?: BadgeTone;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-sm font-semibold',
        BADGE_TONES[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-surface-sunken motion-reduce:animate-none',
        className,
      )}
      aria-hidden="true"
    />
  );
}

/** Announced loading placeholder made of skeleton rows. */
export function LoadingBlock({ label, rows = 3 }: { label: string; rows?: number }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-3">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-16 w-full" />
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  children,
  action,
  icon,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-border-strong bg-surface-raised p-6 md:p-8">
      {icon !== undefined && <div className="text-primary">{icon}</div>}
      <h2 className="text-xl font-bold">{title}</h2>
      {children !== undefined && <div className="max-w-prose text-text-muted">{children}</div>}
      {action}
    </div>
  );
}

/** Inline error with an optional retry. Says what happened and what to do. */
export function ErrorState({
  title = 'This did not load',
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: (() => void) | undefined;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 rounded-lg border-2 border-danger bg-danger-soft p-5"
    >
      <h2 className="text-lg font-bold text-text">{title}</h2>
      <p className="max-w-prose text-text">{message}</p>
      {onRetry !== undefined && (
        <button
          type="button"
          onClick={onRetry}
          className="min-h-touch rounded-md border border-border-strong bg-surface-raised px-4 font-semibold"
        >
          Try again
        </button>
      )}
    </div>
  );
}
