import { ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

/** Page title block with an optional back link and actions. */
export function PageHeader({
  title,
  lead,
  back,
  actions,
}: {
  title: string;
  lead?: ReactNode;
  back?: { to: string; label: string };
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-3">
      {back !== undefined && (
        <Link
          to={back.to}
          className="no-print -ml-2 inline-flex min-h-touch items-center gap-1 self-start rounded-md px-2 font-semibold text-primary hover:bg-primary-soft"
        >
          <ChevronLeft aria-hidden="true" className="size-5" />
          {back.label}
        </Link>
      )}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold md:text-3xl">{title}</h1>
          {lead !== undefined && <div className="max-w-prose text-lg text-text-muted">{lead}</div>}
        </div>
        {actions !== undefined && <div className="no-print flex flex-wrap gap-2">{actions}</div>}
      </div>
    </header>
  );
}

/** A link styled as a button, for navigation that looks like an action. */
export function ButtonLink({
  to,
  children,
  variant = 'primary',
  icon,
  size = 'md',
}: {
  to: string;
  children: ReactNode;
  variant?: 'primary' | 'secondary';
  icon?: ReactNode;
  size?: 'md' | 'lg';
}) {
  const tone =
    variant === 'primary'
      ? 'bg-primary text-on-primary hover:bg-primary-hover border-transparent'
      : 'bg-surface-raised text-text border-border-strong hover:bg-surface-sunken';
  const sizing = size === 'lg' ? 'min-h-[3.25rem] px-6 text-lg' : 'min-h-touch px-4';
  return (
    <Link
      to={to}
      className={`inline-flex items-center justify-center gap-2 rounded-md border font-semibold ${tone} ${sizing}`}
    >
      {icon}
      {children}
    </Link>
  );
}
