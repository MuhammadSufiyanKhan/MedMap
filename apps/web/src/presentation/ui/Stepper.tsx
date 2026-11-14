import { cn } from './cn';

/** Shows where the user is in a short, ordered flow. */
export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex flex-wrap gap-x-4 gap-y-2" aria-label="Progress">
      {steps.map((step, index) => {
        const state = index < current ? 'done' : index === current ? 'current' : 'todo';
        return (
          <li
            key={step}
            aria-current={state === 'current' ? 'step' : undefined}
            className={cn(
              'flex items-center gap-2 text-sm',
              state === 'current' ? 'font-bold text-text' : 'text-text-muted',
            )}
          >
            <span
              className={cn(
                'flex size-7 items-center justify-center rounded-full border text-sm font-bold',
                state === 'done' && 'border-primary bg-primary text-on-primary',
                state === 'current' && 'border-primary bg-primary-soft text-primary',
                state === 'todo' && 'border-border-strong bg-surface-raised',
              )}
              aria-hidden="true"
            >
              {index + 1}
            </span>
            <span>
              <span className="sr-only">
                Step {index + 1} of {steps.length}
                {state === 'done' ? ', done' : ''}:{' '}
              </span>
              {step}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
