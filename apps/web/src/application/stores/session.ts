import { create } from 'zustand';
import type { User } from '@medmap/shared';

export type SessionStatus = 'loading' | 'anonymous' | 'authenticated';

interface SessionState {
  status: SessionStatus;
  user: User | null;
  setUser: (user: User | null) => void;
}

/** Who is signed in. The access token itself lives only inside the API client. */
export const useSessionStore = create<SessionState>((set) => ({
  status: 'loading',
  user: null,
  setUser: (user) => {
    set({ user, status: user === null ? 'anonymous' : 'authenticated' });
  },
}));
