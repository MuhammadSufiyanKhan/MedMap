import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { useSessionBootstrap } from '../application/session';
import { applyPreferences, usePreferences } from '../application/stores/preferences';
import { ApiError } from '../domain/errors';
import { LoadingBlock } from '../presentation/ui/Card';

// Route-level code splitting: each page, and with it GSAP and React Flow, loads on demand.
const PublicLayout = lazy(() => import('../presentation/layouts/PublicLayout'));
const AppLayout = lazy(() => import('../presentation/layouts/AppLayout'));
const LandingPage = lazy(() => import('../presentation/pages/LandingPage'));
const DashboardPage = lazy(() => import('../presentation/pages/DashboardPage'));
const ProfilePage = lazy(() => import('../presentation/pages/ProfilePage'));
const AddMedicinePage = lazy(() => import('../presentation/pages/AddMedicinePage'));
const ResultsPage = lazy(() => import('../presentation/pages/ResultsPage'));
const PrintPage = lazy(() => import('../presentation/pages/PrintPage'));
const SettingsPage = lazy(() => import('../presentation/pages/SettingsPage'));
const SharingPage = lazy(() => import('../presentation/pages/SharingPage'));
const AcceptInvitePage = lazy(() =>
  import('../presentation/pages/SharingPage').then((module) => ({
    default: module.AcceptInvitePage,
  })),
);
const auth = () => import('../presentation/pages/AuthPages');
const LoginPage = lazy(() => auth().then((module) => ({ default: module.LoginPage })));
const RegisterPage = lazy(() => auth().then((module) => ({ default: module.RegisterPage })));
const ForgotPasswordPage = lazy(() =>
  auth().then((module) => ({ default: module.ForgotPasswordPage })),
);
const ResetPasswordPage = lazy(() =>
  auth().then((module) => ({ default: module.ResetPasswordPage })),
);
const VerifyEmailPage = lazy(() => auth().then((module) => ({ default: module.VerifyEmailPage })));
const NotFoundPage = lazy(() => auth().then((module) => ({ default: module.NotFoundPage })));

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // Health data stays in memory only briefly and is never persisted.
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) =>
          !(error instanceof ApiError && error.status >= 400 && error.status < 500) &&
          failureCount < 2,
      },
      mutations: { retry: false },
    },
  });
}

function PageFallback() {
  return (
    <div className="mx-auto max-w-page p-5">
      <LoadingBlock label="Loading page" />
    </div>
  );
}

function AppRoutes() {
  useSessionBootstrap();
  const theme = usePreferences((state) => state.theme);
  const textSize = usePreferences((state) => state.textSize);
  useEffect(() => {
    applyPreferences({ theme, textSize, noticeAccepted: false, extractionConsent: false });
  }, [theme, textSize]);

  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<LandingPage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
          <Route path="forgot-password" element={<ForgotPasswordPage />} />
          <Route path="reset-password" element={<ResetPasswordPage />} />
          <Route path="verify-email" element={<VerifyEmailPage />} />
          <Route path="invites/accept" element={<AcceptInvitePage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
        <Route path="app" element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="profiles" element={<Navigate to="/app" replace />} />
          <Route path="profiles/:profileId" element={<ProfilePage />} />
          <Route path="profiles/:profileId/medications/new" element={<AddMedicinePage />} />
          <Route path="profiles/:profileId/results" element={<ResultsPage />} />
          <Route path="profiles/:profileId/print" element={<PrintPage />} />
          <Route path="profiles/:profileId/sharing" element={<SharingPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export function App() {
  const [queryClient] = useState(createQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
