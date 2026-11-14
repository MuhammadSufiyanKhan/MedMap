import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router';
import {
  loginRequestSchema,
  PASSWORD_MIN_LENGTH,
  passwordResetRequestSchema,
  passwordSchema,
  registerRequestSchema,
  SAFETY_TEMPLATES,
} from '@medmap/shared';
import type { LoginRequest, PasswordResetRequest, RegisterRequest } from '@medmap/shared';
import { z } from 'zod';
import { applyApiErrors } from '../../application/forms/errors';
import {
  confirmEmail,
  confirmPasswordReset,
  requestPasswordReset,
  useSession,
} from '../../application/session';
import { errorMessage } from '../../domain/errors';
import { Button } from '../ui/Button';
import { Card, LoadingBlock } from '../ui/Card';
import { Input } from '../ui/Field';
import { Notice } from '../ui/Notice';
import { ButtonLink } from '../ui/Page';

function AuthShell({
  title,
  lead,
  children,
}: {
  title: string;
  lead?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-5 py-10">
      <h1 className="text-3xl font-bold">{title}</h1>
      {lead !== undefined && <p className="text-lg text-text-muted">{lead}</p>}
      <Card variant="raised" padding="lg">
        {children}
      </Card>
    </div>
  );
}

function FormError({ message }: { message: string | null }) {
  if (message === null) {
    return null;
  }
  return (
    <p role="alert" className="rounded-md border-2 border-danger bg-danger-soft p-3 font-semibold">
      {message}
    </p>
  );
}

function useRedirectTarget(): string {
  const location = useLocation();
  const state: unknown = location.state;
  if (
    typeof state === 'object' &&
    state !== null &&
    'from' in state &&
    typeof state.from === 'string'
  ) {
    // Only same-site paths are accepted as a return target.
    return state.from.startsWith('/') && !state.from.startsWith('//') ? state.from : '/app';
  }
  return '/app';
}

export function LoginPage() {
  const { status, signIn } = useSession();
  const navigate = useNavigate();
  const target = useRedirectTarget();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<LoginRequest>({ resolver: zodResolver(loginRequestSchema) });

  if (status === 'authenticated') {
    return <Navigate to={target} replace />;
  }
  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      await signIn(values);
      await navigate(target, { replace: true });
    } catch (error) {
      setFormError(applyApiErrors(error, form.setError, ['email', 'password']));
    }
  });
  return (
    <AuthShell title="Sign in">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <FormError message={formError} />
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          error={form.formState.errors.email?.message}
          {...form.register('email')}
        />
        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          error={form.formState.errors.password?.message}
          {...form.register('password')}
        />
        <Button type="submit" size="lg" loading={form.formState.isSubmitting} fullWidth>
          Sign in
        </Button>
        <p className="flex flex-wrap justify-between gap-2 text-sm">
          <Link to="/forgot-password" className="font-semibold text-primary underline">
            Forgot your password?
          </Link>
          <Link to="/register" className="font-semibold text-primary underline">
            Create an account
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}

export function RegisterPage() {
  const { status, signUp } = useSession();
  const navigate = useNavigate();
  const target = useRedirectTarget();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<RegisterRequest>({ resolver: zodResolver(registerRequestSchema) });

  if (status === 'authenticated') {
    return <Navigate to={target} replace />;
  }
  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      await signUp(values);
      await navigate(target, { replace: true });
    } catch (error) {
      setFormError(applyApiErrors(error, form.setError, ['email', 'password']));
    }
  });
  return (
    <AuthShell
      title="Create your account"
      lead="One account can hold a list for each person you look after."
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <FormError message={formError} />
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          error={form.formState.errors.email?.message}
          {...form.register('email')}
        />
        <Input
          label="Password"
          type="password"
          autoComplete="new-password"
          hint={`At least ${String(PASSWORD_MIN_LENGTH)} characters. A few words in a row work well.`}
          error={form.formState.errors.password?.message}
          {...form.register('password')}
        />
        <Notice tone="neutral">
          <p className="text-sm">{SAFETY_TEMPLATES.notAdvice}</p>
        </Notice>
        <Button type="submit" size="lg" loading={form.formState.isSubmitting} fullWidth>
          Create account
        </Button>
        <p className="text-sm">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-primary underline">
            Sign in
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}

export function ForgotPasswordPage() {
  const [sent, setSent] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<PasswordResetRequest>({ resolver: zodResolver(passwordResetRequestSchema) });
  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      setSent(await requestPasswordReset(values.email));
    } catch (error) {
      setFormError(applyApiErrors(error, form.setError, ['email']));
    }
  });
  return (
    <AuthShell title="Reset your password" lead="Enter your email and we will send a link.">
      {sent === null ? (
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <FormError message={formError} />
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            error={form.formState.errors.email?.message}
            {...form.register('email')}
          />
          <Button type="submit" size="lg" loading={form.formState.isSubmitting} fullWidth>
            Send reset link
          </Button>
        </form>
      ) : (
        <div className="flex flex-col gap-4" role="status">
          <p>{sent}</p>
          <ButtonLink to="/login" variant="secondary">
            Back to sign in
          </ButtonLink>
        </div>
      )}
    </AuthShell>
  );
}

const newPasswordSchema = z.object({ newPassword: passwordSchema });

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<{ newPassword: string }>({ resolver: zodResolver(newPasswordSchema) });
  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      await confirmPasswordReset({ token, newPassword: values.newPassword });
      setDone(true);
    } catch (error) {
      setFormError(applyApiErrors(error, form.setError, ['newPassword']));
    }
  });
  if (token === '') {
    return (
      <AuthShell title="This link is not complete">
        <p>Open the link from your email again, or ask for a new one.</p>
        <div className="mt-4">
          <ButtonLink to="/forgot-password">Ask for a new link</ButtonLink>
        </div>
      </AuthShell>
    );
  }
  return (
    <AuthShell title="Choose a new password">
      {done ? (
        <div className="flex flex-col gap-4" role="status">
          <p>Your password is changed. You were signed out everywhere.</p>
          <ButtonLink to="/login">Sign in</ButtonLink>
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <FormError message={formError} />
          <Input
            label="New password"
            type="password"
            autoComplete="new-password"
            hint={`At least ${String(PASSWORD_MIN_LENGTH)} characters.`}
            error={form.formState.errors.newPassword?.message}
            {...form.register('newPassword')}
          />
          <Button type="submit" size="lg" loading={form.formState.isSubmitting} fullWidth>
            Change password
          </Button>
        </form>
      )}
    </AuthShell>
  );
}

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const { status, refreshUser } = useSession();
  const [state, setState] = useState<'working' | 'done' | 'failed'>(
    token === '' ? 'failed' : 'working',
  );
  const [failure, setFailure] = useState('This link is not complete.');

  useEffect(() => {
    if (token === '') {
      return;
    }
    let cancelled = false;
    confirmEmail(token)
      .then(() => {
        if (!cancelled) {
          setState('done');
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setFailure(errorMessage(error));
          setState('failed');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (state === 'done' && status === 'authenticated') {
      void refreshUser().catch(() => undefined);
    }
  }, [state, status, refreshUser]);

  return (
    <AuthShell title="Confirm your email">
      {state === 'working' && <LoadingBlock label="Confirming your email" rows={1} />}
      {state === 'done' && (
        <div className="flex flex-col gap-4" role="status">
          <p>Your email is confirmed.</p>
          <ButtonLink to="/app">Open my profiles</ButtonLink>
        </div>
      )}
      {state === 'failed' && (
        <div className="flex flex-col gap-4">
          <p role="alert">{failure}</p>
          <ButtonLink to="/app/settings" variant="secondary">
            Send a new link from settings
          </ButtonLink>
        </div>
      )}
    </AuthShell>
  );
}

export function NotFoundPage() {
  return (
    <AuthShell title="This page does not exist">
      <p>The address may be mistyped, or the page may have moved.</p>
      <div className="mt-4">
        <ButtonLink to="/">Go to the start page</ButtonLink>
      </div>
    </AuthShell>
  );
}
