import { create } from 'zustand';

export interface ToastMessage {
  id: number;
  tone: 'info' | 'error';
  text: string;
}

interface ToastState {
  toasts: ToastMessage[];
  show: (text: string, tone?: ToastMessage['tone']) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

/** Short confirmations ("Medicine added"). Never used for safety content. */
export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  show: (text, tone = 'info') => {
    const id = nextId;
    nextId += 1;
    // Only the latest message is kept, so confirmations never pile up over the page.
    set({ toasts: [{ id, tone, text }] });
  },
  dismiss: (id) => {
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }));
  },
}));
