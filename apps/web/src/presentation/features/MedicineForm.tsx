import { zodResolver } from '@hookform/resolvers/zod';
import { useId, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { MEDICATION_KINDS, SAFETY_TEMPLATES } from '@medmap/shared';
import type { DrugCandidate, MedicationSource } from '@medmap/shared';
import { useCreateMedication, useNameMatches } from '../../application/queries/medications';
import { newIdempotencyKey } from '../../application/queries/profiles';
import { ApiError, errorMessage } from '../../domain/errors';
import { KIND_LABELS } from '../../domain/format';
import { UncheckedBadge } from './severity';
import { Button } from '../ui/Button';
import { Card, Skeleton } from '../ui/Card';
import { Input, Select } from '../ui/Field';
import { Notice } from '../ui/Notice';

const formSchema = z.object({
  displayName: z.string().trim().min(1, 'Enter the medicine name').max(120),
  strengthText: z.string().trim().max(60),
  kind: z.enum(MEDICATION_KINDS),
});
type FormValues = z.infer<typeof formSchema>;

const NO_MATCH = '__none__';

export interface MedicineFormProps {
  profileId: string;
  source: MedicationSource;
  initial?: { displayName: string; strengthText: string };
  /** Shown above the form, for example the text read from a label photo. */
  context?: React.ReactNode;
  submitLabel?: string;
  onSaved: (displayName: string) => void;
  onSkip?: () => void;
}

function describeCandidate(candidate: DrugCandidate): string {
  const ingredients = candidate.ingredients.map((ingredient) => ingredient.name).join(', ');
  return ingredients === '' || ingredients.toLowerCase() === candidate.name.toLowerCase()
    ? candidate.name
    : `${candidate.name} (contains ${ingredients})`;
}

/**
 * Add one medicine in two steps: edit, then review. Nothing is saved until the user
 * confirms the review, whether the name was typed or read from a photo.
 */
export function MedicineForm({
  profileId,
  source,
  initial,
  context,
  submitLabel = 'Save medicine',
  onSaved,
  onSkip,
}: MedicineFormProps) {
  const groupId = useId();
  const create = useCreateMedication(profileId);
  const key = useRef(newIdempotencyKey());
  const [step, setStep] = useState<'edit' | 'review'>('edit');
  const [choice, setChoice] = useState<string>('');
  const [saveError, setSaveError] = useState<{ message: string; lookupDown: boolean } | null>(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      displayName: initial?.displayName ?? '',
      strengthText: initial?.strengthText ?? '',
      kind: 'unknown',
    },
  });
  const name = useWatch({ control: form.control, name: 'displayName' });
  const matches = useNameMatches(name);
  const candidates = matches.data?.candidates ?? [];
  const selected = candidates.find((candidate) => candidate.rxcui === choice) ?? null;
  const lookupFailed = matches.isError;

  const toReview = form.handleSubmit(() => {
    if (candidates.length > 0 && choice === '') {
      form.setError('root', { message: 'Pick the matching medicine, or choose "None of these".' });
      return;
    }
    setSaveError(null);
    setStep('review');
  });

  const save = (withMatch: boolean) => {
    const values = form.getValues();
    setSaveError(null);
    create.mutate(
      {
        values: {
          displayName: values.displayName.trim(),
          strengthText: values.strengthText.trim() === '' ? null : values.strengthText.trim(),
          kind: values.kind,
          source,
          rxcui: withMatch && selected !== null ? selected.rxcui : null,
        },
        key: key.current,
      },
      {
        onSuccess: (medication) => {
          key.current = newIdempotencyKey();
          onSaved(medication.displayName);
        },
        onError: (error) => {
          // A changed request needs a new key; the old one is bound to the old body.
          key.current = newIdempotencyKey();
          setSaveError({
            message: errorMessage(error),
            lookupDown: error instanceof ApiError && error.status === 503,
          });
        },
      },
    );
  };

  if (step === 'review') {
    const values = form.getValues();
    return (
      <Card variant="raised" padding="lg" className="flex flex-col gap-4">
        <h2 className="text-xl font-bold">Check before saving</h2>
        <dl className="grid gap-x-6 gap-y-3 md:grid-cols-[auto_1fr]">
          <dt className="font-semibold text-text-muted">Name</dt>
          <dd data-testid="review-name">{values.displayName}</dd>
          <dt className="font-semibold text-text-muted">Strength</dt>
          <dd>{values.strengthText === '' ? 'Not given' : values.strengthText}</dd>
          <dt className="font-semibold text-text-muted">Type</dt>
          <dd>{KIND_LABELS[values.kind]}</dd>
          <dt className="font-semibold text-text-muted">Matched to</dt>
          <dd>
            {selected === null ? (
              <span className="flex flex-col items-start gap-1">
                <UncheckedBadge />
                <span>No match. It will be listed, but MedMap cannot check it.</span>
              </span>
            ) : (
              describeCandidate(selected)
            )}
          </dd>
        </dl>
        {values.kind === 'supplement' && (
          <Notice tone="neutral">
            <p className="text-sm">{SAFETY_TEMPLATES.supplementCoverage}</p>
          </Notice>
        )}
        {saveError !== null && (
          <div
            role="alert"
            className="flex flex-col items-start gap-2 rounded-md border-2 border-danger bg-danger-soft p-3"
          >
            <p className="font-semibold">{saveError.message}</p>
            {saveError.lookupDown && selected !== null && (
              <Button
                variant="secondary"
                onClick={() => {
                  save(false);
                }}
              >
                Save without a match
              </Button>
            )}
          </div>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              setStep('edit');
            }}
          >
            Change something
          </Button>
          <Button
            loading={create.isPending}
            onClick={() => {
              save(true);
            }}
          >
            {submitLabel}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <form onSubmit={toReview} noValidate className="flex flex-col gap-4">
      {context}
      <Input
        label="Name on the label"
        hint="The brand name or the ingredient, as it is printed."
        autoComplete="off"
        autoCapitalize="words"
        error={form.formState.errors.displayName?.message}
        {...form.register('displayName', {
          onChange: () => {
            setChoice('');
            form.clearErrors('root');
          },
        })}
      />

      <fieldset className="flex flex-col gap-2" aria-describedby={`${groupId}-status`}>
        <legend className="text-sm font-semibold">Which medicine is it?</legend>
        <div
          id={`${groupId}-status`}
          role="status"
          aria-live="polite"
          className="text-sm text-text-muted"
        >
          {name.trim().length < 2 && 'Type at least two letters to look the name up.'}
          {matches.isFetching && 'Looking up the name…'}
          {matches.isSuccess &&
            !matches.isFetching &&
            candidates.length === 0 &&
            name.trim().length >= 2 &&
            'No match found. You can still save it; it will show as "could not check".'}
          {matches.isSuccess &&
            candidates.length > 0 &&
            `${String(candidates.length)} possible ${candidates.length === 1 ? 'match' : 'matches'} from ${matches.data.source}.`}
          {lookupFailed &&
            'The name lookup is not available right now. You can still save it; it will show as "could not check".'}
        </div>
        {matches.isFetching && <Skeleton className="h-12 w-full" />}
        {candidates.map((candidate) => (
          <label
            key={candidate.rxcui}
            className="flex min-h-touch cursor-pointer items-center gap-3 rounded-md border border-border-strong bg-surface-raised px-3 py-2 has-[:checked]:border-2 has-[:checked]:border-primary has-[:checked]:bg-primary-soft"
          >
            <input
              type="radio"
              name={`${groupId}-match`}
              value={candidate.rxcui}
              checked={choice === candidate.rxcui}
              onChange={() => {
                setChoice(candidate.rxcui);
                form.clearErrors('root');
              }}
              className="size-5 accent-primary"
            />
            <span>{describeCandidate(candidate)}</span>
          </label>
        ))}
        {candidates.length > 0 && (
          <label className="flex min-h-touch cursor-pointer items-center gap-3 rounded-md border border-border-strong bg-surface-raised px-3 py-2 has-[:checked]:border-2 has-[:checked]:border-primary has-[:checked]:bg-primary-soft">
            <input
              type="radio"
              name={`${groupId}-match`}
              value={NO_MATCH}
              checked={choice === NO_MATCH}
              onChange={() => {
                setChoice(NO_MATCH);
                form.clearErrors('root');
              }}
              className="size-5 accent-primary"
            />
            <span>None of these, or I am not sure</span>
          </label>
        )}
        {form.formState.errors.root?.message !== undefined && (
          <p role="alert" className="text-sm font-semibold text-danger">
            {form.formState.errors.root.message}
          </p>
        )}
      </fieldset>

      <Input
        label="Strength"
        optional
        hint="For example 10 mg or 500 mg / 5 ml."
        autoComplete="off"
        error={form.formState.errors.strengthText?.message}
        {...form.register('strengthText')}
      />
      <Select
        label="Type"
        options={MEDICATION_KINDS.map((kind) => ({ value: kind, label: KIND_LABELS[kind] }))}
        error={form.formState.errors.kind?.message}
        {...form.register('kind')}
      />
      <div className="flex flex-wrap justify-end gap-2">
        {onSkip !== undefined && (
          <Button variant="secondary" onClick={onSkip}>
            Skip this one
          </Button>
        )}
        <Button type="submit">Review</Button>
      </div>
    </form>
  );
}
