import { Dialog as RadixDialog } from 'radix-ui';
import type { ReactNode } from 'react';
import { cn } from './cn';

export interface DialogProps {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  /** When false the dialog cannot be dismissed with Escape or by clicking outside. */
  dismissible?: boolean;
  size?: 'md' | 'lg';
}

/** Modal dialog with focus trapping and labelling from Radix. */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  dismissible = true,
  size = 'md',
}: DialogProps) {
  const block = (event: Event) => {
    if (!dismissible) {
      event.preventDefault();
    }
  };
  return (
    <RadixDialog.Root open={open} {...(onOpenChange === undefined ? {} : { onOpenChange })}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-40 bg-text/50" />
        <RadixDialog.Content
          onEscapeKeyDown={block}
          onPointerDownOutside={block}
          onInteractOutside={block}
          {...(description === undefined ? { 'aria-describedby': undefined } : {})}
          className={cn(
            'fixed left-1/2 top-1/2 z-50 max-h-[90dvh] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2',
            'overflow-y-auto rounded-lg border border-border bg-surface-raised p-5 shadow-overlay md:p-7',
            size === 'md' ? 'max-w-lg' : 'max-w-2xl',
          )}
        >
          <RadixDialog.Title className="text-xl font-bold md:text-2xl">{title}</RadixDialog.Title>
          {description !== undefined && (
            <RadixDialog.Description className="mt-2 text-text-muted">
              {description}
            </RadixDialog.Description>
          )}
          <div className="mt-4">{children}</div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
