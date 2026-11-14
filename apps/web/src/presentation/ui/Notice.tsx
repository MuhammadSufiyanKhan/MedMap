import type { ReactNode } from 'react';
import { cn } from './cn';

/**
 * A static information box. Used for safety notices, so it has no entrance animation and
 * no dismiss control: it is simply there.
 */
export function Notice({
  title,
  children,
  tone = 'neutral',
  icon,
  className,
}: {
  title?: string;
  children: ReactNode;
  tone?: 'neutral' | 'primary' | 'demo' | 'warning';
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex gap-3 rounded-md border p-4',
        tone === 'neutral' && 'border-border-strong bg-surface-raised',
        tone === 'primary' && 'border-primary bg-primary-soft',
        tone === 'demo' && 'border-demo bg-demo text-on-demo',
        tone === 'warning' && 'border-severity-moderate bg-severity-moderate-soft',
        className,
      )}
    >
      {icon !== undefined && <div className="mt-0.5 shrink-0">{icon}</div>}
      <div className="flex flex-col gap-1">
        {title !== undefined && <p className="font-bold">{title}</p>}
        <div className="max-w-prose">{children}</div>
      </div>
    </div>
  );
}
