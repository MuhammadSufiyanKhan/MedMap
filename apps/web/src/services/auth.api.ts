import { acceptedResponseSchema, authResponseSchema, userSchema } from '@medmap/shared';
import type {
  AuthResponse,
  LoginRequest,
  PasswordResetConfirm,
  RegisterRequest,
  User,
} from '@medmap/shared';
import { api } from './http';

export async function register(input: RegisterRequest): Promise<AuthResponse> {
  const { data } = await api.request('/auth/register', {
    method: 'POST',
    body: input,
    schema: authResponseSchema,
    auth: false,
  });
  api.setAccessToken(data.accessToken);
  return data;
}

export async function login(input: LoginRequest): Promise<AuthResponse> {
  const { data } = await api.request('/auth/login', {
    method: 'POST',
    body: input,
    schema: authResponseSchema,
    auth: false,
  });
  api.setAccessToken(data.accessToken);
  return data;
}

/** Restores a session from the refresh cookie, if there is one. */
export function restoreSession(): Promise<AuthResponse | null> {
  return api.refresh();
}

export async function logout(): Promise<void> {
  try {
    await api.request('/auth/logout', { method: 'POST', csrf: true, auth: false });
  } finally {
    api.setAccessToken(null);
  }
}

export async function fetchMe(): Promise<User> {
  return (await api.request('/me', { schema: userSchema })).data;
}

export async function resendVerification(): Promise<string> {
  const { data } = await api.request('/auth/email-verifications', {
    method: 'POST',
    schema: acceptedResponseSchema,
  });
  return data.message;
}

export async function confirmEmail(token: string): Promise<void> {
  await api.request('/auth/email-verifications/confirm', {
    method: 'POST',
    body: { token },
    auth: false,
  });
}

export async function requestPasswordReset(email: string): Promise<string> {
  const { data } = await api.request('/auth/password-resets', {
    method: 'POST',
    body: { email },
    schema: acceptedResponseSchema,
    auth: false,
  });
  return data.message;
}

export async function confirmPasswordReset(input: PasswordResetConfirm): Promise<void> {
  await api.request('/auth/password-resets/confirm', { method: 'POST', body: input, auth: false });
}
