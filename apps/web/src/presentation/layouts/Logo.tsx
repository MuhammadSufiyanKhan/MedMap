import { Link } from 'react-router';

/** Wordmark with the three-node mark. The amber dot is the only brand accent. */
export function Logo({ to = '/' }: { to?: string }) {
  return (
    <Link
      to={to}
      className="inline-flex min-h-touch items-center gap-2 text-xl font-bold text-text"
    >
      <svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true">
        <rect width="32" height="32" rx="7" fill="var(--mm-primary)" />
        <path
          d="M9 22 16 9l7 13"
          fill="none"
          stroke="var(--mm-on-primary)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="9" cy="22" r="3.2" fill="var(--mm-accent)" />
        <circle cx="16" cy="9" r="3.2" fill="var(--mm-on-primary)" />
        <circle cx="23" cy="22" r="3.2" fill="var(--mm-on-primary)" />
      </svg>
      MedMap
    </Link>
  );
}
