import { Link, Outlet, useLocation } from 'react-router';
import { useRouteTransition } from '../../application/animation/hooks';
import { useSession } from '../../application/session';
import { DemoBanner, FooterDisclaimer, OfflineBanner } from '../features/notices';
import { ToastRegion } from '../ui/Toast';
import { Logo } from './Logo';

const LINK =
  'inline-flex min-h-touch items-center rounded-md px-3 font-semibold text-primary hover:bg-primary-soft';

/** Shell for the landing page and the sign-in pages. */
export default function PublicLayout() {
  const { status } = useSession();
  const location = useLocation();
  const main = useRouteTransition<HTMLElement>(location.pathname);
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-surface-raised focus:p-3"
      >
        Skip to content
      </a>
      <DemoBanner />
      <OfflineBanner />
      <header className="border-b border-border bg-surface-raised px-5">
        <div className="mx-auto flex max-w-page items-center justify-between gap-3 py-2">
          <Logo />
          <nav aria-label="Account" className="flex items-center gap-1">
            {status === 'authenticated' ? (
              <Link to="/app" className={LINK}>
                Open my profiles
              </Link>
            ) : (
              <>
                <Link to="/login" className={LINK}>
                  Sign in
                </Link>
                <Link
                  to="/register"
                  className="inline-flex min-h-touch items-center rounded-md bg-primary px-4 font-semibold text-on-primary hover:bg-primary-hover"
                >
                  Create account
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main id="main" ref={main} className="flex-1">
        <Outlet />
      </main>
      <FooterDisclaimer />
      <ToastRegion />
    </div>
  );
}
