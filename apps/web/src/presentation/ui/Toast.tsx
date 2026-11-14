import { Toast as RadixToast } from 'radix-ui';
import { X } from 'lucide-react';
import { useToasts } from '../../application/stores/toasts';
import { cn } from './cn';

/** Renders queued confirmations. Mounted once in the app shell. */
export function ToastRegion() {
  const toasts = useToasts((state) => state.toasts);
  const dismiss = useToasts((state) => state.dismiss);
  return (
    <RadixToast.Provider swipeDirection="right" duration={4000} label="Notifications">
      {toasts.map((toast) => (
        <RadixToast.Root
          key={toast.id}
          onOpenChange={(open) => {
            if (!open) {
              dismiss(toast.id);
            }
          }}
          className={cn(
            'flex items-center justify-between gap-3 rounded-md border bg-surface-raised p-3 pl-4 shadow-overlay',
            toast.tone === 'error' ? 'border-2 border-danger' : 'border-border-strong',
          )}
        >
          <RadixToast.Description className="text-base">{toast.text}</RadixToast.Description>
          <RadixToast.Close
            aria-label="Dismiss"
            className="flex size-11 shrink-0 items-center justify-center rounded-md hover:bg-surface-sunken"
          >
            <X aria-hidden="true" className="size-5" />
          </RadixToast.Close>
        </RadixToast.Root>
      ))}
      <RadixToast.Viewport className="no-print fixed bottom-20 left-4 right-4 z-50 flex flex-col gap-2 md:bottom-6 md:left-auto md:w-96" />
    </RadixToast.Provider>
  );
}
