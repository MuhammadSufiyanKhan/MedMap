import { useId } from 'react';
import type {
  InputHTMLAttributes,
  ReactNode,
  Ref,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { cn } from './cn';

interface FieldShellProps {
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
  optional?: boolean | undefined;
  children: (ids: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode;
}

const CONTROL =
  'w-full min-h-touch rounded-md border bg-surface-raised px-3 py-2 text-base text-text ' +
  'placeholder:text-text-muted disabled:cursor-not-allowed disabled:opacity-60';

function controlClass(invalid: boolean, className?: string): string {
  return cn(CONTROL, invalid ? 'border-danger border-2' : 'border-border-strong', className);
}

/** Label, hint and error wiring shared by every form control. */
function FieldShell({ label, hint, error, optional, children }: FieldShellProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy =
    [hint === undefined ? null : hintId, error === undefined ? null : errorId]
      .filter((value) => value !== null)
      .join(' ') || undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-text">
        {label}
        {optional === true && <span className="font-normal text-text-muted"> (optional)</span>}
      </label>
      {hint !== undefined && (
        <p id={hintId} className="text-sm text-text-muted">
          {hint}
        </p>
      )}
      {children({ id, describedBy, invalid: error !== undefined })}
      {error !== undefined && (
        <p id={errorId} className="text-sm font-semibold text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

type Shared = Pick<FieldShellProps, 'label' | 'hint' | 'error' | 'optional'>;

export interface InputProps extends Shared, InputHTMLAttributes<HTMLInputElement> {
  ref?: Ref<HTMLInputElement>;
}

export function Input({ label, hint, error, optional, className, ref, ...rest }: InputProps) {
  return (
    <FieldShell label={label} hint={hint} error={error} optional={optional}>
      {({ id, describedBy, invalid }) => (
        <input
          id={id}
          ref={ref}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className={controlClass(invalid, className)}
          {...rest}
        />
      )}
    </FieldShell>
  );
}

export interface TextareaProps extends Shared, TextareaHTMLAttributes<HTMLTextAreaElement> {
  ref?: Ref<HTMLTextAreaElement>;
}

export function Textarea({ label, hint, error, optional, className, ref, ...rest }: TextareaProps) {
  return (
    <FieldShell label={label} hint={hint} error={error} optional={optional}>
      {({ id, describedBy, invalid }) => (
        <textarea
          id={id}
          ref={ref}
          rows={3}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className={controlClass(invalid, className)}
          {...rest}
        />
      )}
    </FieldShell>
  );
}

export interface SelectProps extends Shared, SelectHTMLAttributes<HTMLSelectElement> {
  ref?: Ref<HTMLSelectElement>;
  options: readonly { value: string; label: string }[];
}

/** A native select: the most reliable picker on phones and with screen readers. */
export function Select({
  label,
  hint,
  error,
  optional,
  className,
  options,
  ref,
  ...rest
}: SelectProps) {
  return (
    <FieldShell label={label} hint={hint} error={error} optional={optional}>
      {({ id, describedBy, invalid }) => (
        <select
          id={id}
          ref={ref}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className={controlClass(invalid, className)}
          {...rest}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </FieldShell>
  );
}
