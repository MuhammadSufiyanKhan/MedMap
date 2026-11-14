import { useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { LoginRequest, RegisterRequest } from '@medmap/shared';
import * as authApi from '../services/auth.api';
import { api } from '../services/http';
import { useSessionStore } from './stores/session';

/**
 * Restores the session once when the app starts and keeps the store in step with the
 * API client. Mount exactly once, near the root.
 */
export function useSessionBootstrap(): void {
  const setUser = useSessionStore((state) => state.setUser);
  useEffect(() => {
    let cancelled = false;
    api.setSessionLostHandler(() => {
      setUser(null);
    });
    void authApi.restoreSession().then((session) => {
      if (!cancelled) {
        setUser(session?.user ?? null);
      }
    });
    return () => {
      cancelled = true;
      api.setSessionLostHandler(null);
    };
  }, [setUser]);
}

/** Session state and the actions that change it. */
export function useSession() {
  const status = useSessionStore((state) => state.status);
  const user = useSessionStore((state) => state.user);
  const setUser = useSessionStore((state) => state.setUser);
  const queryClient = useQueryClient();

  const signIn = useCallback(
    async (input: LoginRequest) => {
      const session = await authApi.login(input);
      queryClient.clear();
      setUser(session.user);
    },
    [queryClient, setUser],
  );

  const signUp = useCallback(
    async (input: RegisterRequest) => {
      const session = await authApi.register(input);
      queryClient.clear();
      setUser(session.user);
    },
    [queryClient, setUser],
  );

  const signOut = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      // Health data must not linger in memory after sign-out.
      queryClient.clear();
      setUser(null);
    }
  }, [queryClient, setUser]);

  const refreshUser = useCallback(async () => {
    setUser(await authApi.fetchMe());
  }, [setUser]);

  return { status, user, signIn, signUp, signOut, refreshUser };
}

export const confirmEmail = authApi.confirmEmail;
export const resendVerification = authApi.resendVerification;
export const requestPasswordReset = authApi.requestPasswordReset;
export const confirmPasswordReset = authApi.confirmPasswordReset;
