import { LogOut, Settings, Users } from 'lucide-react';
import { useState } from 'react';
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { useRouteTransition } from '../../application/animation/hooks';
import { useSession } from '../../application/session';
import { DemoBanner, FirstRunNotice, FooterDisclaimer, OfflineBanner } from '../features/notices';
import { LoadingBlock } from '../ui/Card';
import { cn } from '../ui/cn';
import { ToastRegion } from '../ui/Toast';
import { Logo } from './Logo';

const NAV = [
  { to: '/app', label: 'Profiles', icon: Users, end: false },
  { to: '/app/settings', label: 'Settings', icon: Settings, end: true },
] as const;

function navClass(isActive: boolean, vertical: boolean): string {
  return cn(
    'flex min-h-touch items-center gap-2 rounded-md px-3 font-semibold',
    vertical ? 'justify-start' : 'flex-1 flex-col justify-center gap-0.5 py-1.5 text-sm',
    isActive ? 'bg-primary-soft text-primary' : 'text-text-muted hover:bg-surface-sunken',
  );
}

/**
 * Shell for signed-in pages: a left rail from 768 px, a bottom bar below that. Sends
 * anonymous visitors to sign in and shows the first-run notice until it is accepted.
 */
export default function AppLayout() {
  const { status, signOut } = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const main = useRouteTransition<HTMLElement>(location.pathname);
  const [leaving, setLeaving] = useState(false);

  if (status === 'anonymous' && leaving) {
    return <Navigate to="/" replace />;
  }
  if (status === 'anonymous') {
    return (
      <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />
    );
  }

  const isProfilesActive = (path: string) => path === '/app' || path.startsWith('/app/profiles');
  const handleSignOut = () => {
    // A deliberate sign-out ends on the start page, not on the sign-in form.
    setLeaving(true);
    void signOut().finally(() => navigate('/', { replace: true }));
  };

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
      <div className="flex flex-1">
        <aside className="no-print hidden w-56 shrink-0 flex-col gap-4 border-r border-border bg-surface-raised p-4 md:flex">
          <Logo to="/app" />
          <nav aria-label="Main" data-testid="side-nav" className="flex flex-col gap-1">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  navClass(
                    item.to === '/app' ? isProfilesActive(location.pathname) : isActive,
                    true,
                  )
                }
              >
                <item.icon aria-hidden="true" className="size-5" />
                {item.label}
              </NavLink>
            ))}
          </nav>
          <button
            type="button"
            onClick={handleSignOut}
            className={cn(navClass(false, true), 'mt-auto')}
          >
            <LogOut aria-hidden="true" className="size-5" />
            Sign out
          </button>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="no-print flex items-center justify-between border-b border-border bg-surface-raised px-5 py-1 md:hidden">
            <Logo to="/app" />
          </header>
          <main
            id="main"
            ref={main}
            className="mx-auto min-h-dvh w-full max-w-page flex-1 px-5 py-6 pb-28 md:px-8 md:pb-10"
          >
            {/* The shell renders while the session is restored, and a full-height main keeps
                the footer below the fold, so nothing jumps once data arrives. */}
            {status === 'loading' ? (
              <LoadingBlock label="Loading your account" rows={4} />
            ) : (
              <Outlet />
            )}
          </main>
          <FooterDisclaimer />
        </div>
      </div>
      <nav
        aria-label="Main"
        data-testid="bottom-nav"
        className="no-print fixed inset-x-0 bottom-0 z-30 flex gap-1 border-t border-border bg-surface-raised p-1.5 md:hidden"
      >
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              navClass(item.to === '/app' ? isProfilesActive(location.pathname) : isActive, false)
            }
          >
            <item.icon aria-hidden="true" className="size-5" />
            {item.label}
          </NavLink>
        ))}
        <button type="button" onClick={handleSignOut} className={navClass(false, false)}>
          <LogOut aria-hidden="true" className="size-5" />
          Sign out
        </button>
      </nav>
      {status === 'authenticated' && <FirstRunNotice />}
      <ToastRegion />
    </div>
  );
}
