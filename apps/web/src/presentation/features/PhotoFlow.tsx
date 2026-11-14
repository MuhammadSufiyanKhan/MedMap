import { Camera } from 'lucide-react';
import { useId, useState } from 'react';
import { MAX_LABEL_IMAGES, SAFETY_TEMPLATES } from '@medmap/shared';
import type { LabelCandidate, LabelExtractionResponse } from '@medmap/shared';
import { useExtractLabels } from '../../application/queries/extraction';
import { usePreferences } from '../../application/stores/preferences';
import { errorMessage } from '../../domain/errors';
import { formatConfidence, plural } from '../../domain/format';
import { FAILURE_TEXT, validatePhotos } from '../../domain/photos';
import { Button } from '../ui/Button';
import { Badge, Card } from '../ui/Card';
import { Notice } from '../ui/Notice';
import { Stepper } from '../ui/Stepper';
import { MedicineForm } from './MedicineForm';

const STEPS = ['Add photos', 'Check each reading', 'Done'];

function Consent({ provider, onAccept }: { provider: string; onAccept: () => void }) {
  const [checked, setChecked] = useState(false);
  const id = useId();
  return (
    <Card variant="raised" padding="lg" className="flex flex-col gap-4">
      <h2 className="text-xl font-bold">Before you add a photo</h2>
      <p>{SAFETY_TEMPLATES.extractionConsent}</p>
      <p className="text-sm text-text-muted">
        Provider in use: {provider}. Cover or leave out anything you do not want to share, such as a
        name or address on the label. The photo is only used to read the medicine name.
      </p>
      <label htmlFor={id} className="flex min-h-touch cursor-pointer items-center gap-3">
        <input
          id={id}
          type="checkbox"
          className="size-5 accent-primary"
          checked={checked}
          onChange={(event) => {
            setChecked(event.target.checked);
          }}
        />
        <span>I agree that my label photos are sent to this provider to be read.</span>
      </label>
      <div>
        <Button disabled={!checked} onClick={onAccept}>
          Continue
        </Button>
      </div>
    </Card>
  );
}

function CandidateContext({
  candidate,
  position,
  total,
}: {
  candidate: LabelCandidate;
  position: number;
  total: number;
}) {
  return (
    <Notice
      tone={candidate.needsReview ? 'warning' : 'primary'}
      title={`Reading ${String(position)} of ${String(total)}, from photo ${String(candidate.imageIndex + 1)}`}
    >
      <p className="text-sm">
        <span className="font-semibold">Text read from the label: </span>
        <span data-testid="raw-text">{candidate.rawText === '' ? 'none' : candidate.rawText}</span>
      </p>
      <p className="mt-1 flex flex-wrap items-center gap-2 text-sm">
        Confidence: {formatConfidence(candidate.confidence)}
        {candidate.needsReview && <Badge tone="moderate">Check this one carefully</Badge>}
      </p>
      <p className="mt-1 text-sm">
        Compare it with the label and fix anything that is wrong. Nothing is saved yet.
      </p>
    </Notice>
  );
}

/**
 * Photo path for adding medicines: consent, upload, then a confirm-and-edit step for each
 * reading. Every reading goes through the same review as a typed medicine, and photos
 * that could not be read are listed so the user can type them.
 */
export function PhotoFlow({
  profileId,
  provider,
  onSaved,
}: {
  profileId: string;
  provider: string;
  onSaved: (displayName: string) => void;
}) {
  const consent = usePreferences((state) => state.extractionConsent);
  const update = usePreferences((state) => state.update);
  const extract = useExtractLabels(profileId);
  const inputId = useId();
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [result, setResult] = useState<LabelExtractionResponse | null>(null);
  const [index, setIndex] = useState(0);

  if (!consent) {
    return (
      <Consent
        provider={provider}
        onAccept={() => {
          update({ extractionConsent: true });
        }}
      />
    );
  }

  const reset = () => {
    setResult(null);
    setIndex(0);
    extract.reset();
  };

  if (result === null) {
    return (
      <div className="flex flex-col gap-4">
        <Stepper steps={STEPS} current={0} />
        <Card className="flex flex-col gap-4">
          <label htmlFor={inputId} className="text-lg font-bold">
            Photos of the labels
          </label>
          <p className="text-text-muted">
            Up to {MAX_LABEL_IMAGES} photos, one label in each. Hold the bottle so the name is sharp
            and well lit.
          </p>
          <input
            id={inputId}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            disabled={extract.isPending}
            data-testid="photo-input"
            className="block w-full min-h-touch rounded-md border border-border-strong bg-surface-raised p-2 file:mr-3 file:min-h-touch file:rounded-md file:border-0 file:bg-primary file:px-4 file:font-semibold file:text-on-primary"
            onChange={(event) => {
              const files = [...(event.target.files ?? [])];
              event.target.value = '';
              const problem = validatePhotos(files);
              setSelectionError(problem);
              if (problem !== null) {
                return;
              }
              extract.mutate(files, {
                onSuccess: (data) => {
                  setResult(data);
                  setIndex(0);
                },
              });
            }}
          />
          <div role="status" aria-live="polite">
            {extract.isPending && (
              <p className="flex items-center gap-2 font-semibold">
                <Camera aria-hidden="true" className="size-5" />
                Reading the labels. This can take up to 20 seconds.
              </p>
            )}
          </div>
          {selectionError !== null && (
            <p role="alert" className="font-semibold text-danger">
              {selectionError}
            </p>
          )}
          {extract.isError && (
            <div role="alert" className="rounded-md border-2 border-danger bg-danger-soft p-3">
              <p className="font-semibold">{errorMessage(extract.error)}</p>
              <p className="mt-1">You can type the medicine names in the other tab.</p>
            </div>
          )}
          <p className="text-sm text-text-muted">{SAFETY_TEMPLATES.extractionConsent}</p>
        </Card>
      </div>
    );
  }

  const candidate = result.candidates[index];
  const failures = (
    <>
      {result.failures.length > 0 && (
        <Notice
          tone="warning"
          title={`${plural(result.failures.length, 'photo')} could not be read`}
        >
          <ul className="list-disc pl-5" data-testid="photo-failures">
            {result.failures.map((failure) => (
              <li key={failure.imageIndex}>
                Photo {failure.imageIndex + 1}: {FAILURE_TEXT[failure.reason]} Type that medicine in
                the &ldquo;Type the name&rdquo; tab.
              </li>
            ))}
          </ul>
        </Notice>
      )}
    </>
  );

  if (candidate === undefined) {
    return (
      <div className="flex flex-col gap-4">
        <Stepper steps={STEPS} current={2} />
        {failures}
        <Card className="flex flex-col gap-3">
          <h2 className="text-xl font-bold">
            {result.candidates.length === 0 ? 'Nothing could be read' : 'All readings checked'}
          </h2>
          <p className="text-text-muted">
            {plural(result.remainingToday, 'photo')} left for today.
          </p>
          <div>
            <Button variant="secondary" onClick={reset}>
              Add more photos
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Stepper steps={STEPS} current={1} />
      {failures}
      <MedicineForm
        key={`${String(index)}-${candidate.name}`}
        profileId={profileId}
        source="label"
        initial={{ displayName: candidate.name, strengthText: candidate.strengthText ?? '' }}
        context={
          <CandidateContext
            candidate={candidate}
            position={index + 1}
            total={result.candidates.length}
          />
        }
        onSaved={(displayName) => {
          onSaved(displayName);
          setIndex((current) => current + 1);
        }}
        onSkip={() => {
          setIndex((current) => current + 1);
        }}
      />
    </div>
  );
}
