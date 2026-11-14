import { Printer } from 'lucide-react';
import { useParams } from 'react-router';
import {
  noKnownInteractionText,
  SAFETY_TEMPLATES,
  SEVERITY_DESCRIPTIONS,
  SEVERITY_LABELS,
  UNCHECKED_REASON_TEXT,
} from '@medmap/shared';
import { useInteractionCheck, useMedications } from '../../application/queries/medications';
import { useProfile } from '../../application/queries/profiles';
import { errorMessage } from '../../domain/errors';
import { formatDateTime, KIND_LABELS, summaryLine } from '../../domain/format';
import { DatasetAttribution } from '../features/notices';
import { Button } from '../ui/Button';
import { ErrorState, LoadingBlock } from '../ui/Card';
import { PageHeader } from '../ui/Page';

/** A plain page to print and bring to the pharmacist. List view only, no graph. */
export default function PrintPage() {
  const { profileId = '' } = useParams();
  const profile = useProfile(profileId);
  const medications = useMedications(profileId);
  const check = useInteractionCheck(profileId);

  if (profile.isPending || medications.isPending || check.isPending) {
    return <LoadingBlock label="Preparing the page" rows={4} />;
  }
  const failure = profile.error ?? medications.error ?? check.error;
  if (failure !== null || !profile.data || !medications.data || !check.data) {
    return <ErrorState message={errorMessage(failure)} onRetry={() => void check.refetch()} />;
  }
  const active = medications.data.filter((medication) => medication.status === 'active');
  const result = check.data;

  return (
    <article className="flex flex-col gap-6">
      <PageHeader
        back={{ to: `/app/profiles/${profileId}`, label: profile.data.displayName }}
        title={`Medicine list for ${profile.data.displayName}`}
        lead={`For a conversation with a pharmacist or prescriber. Checked ${formatDateTime(result.createdAt)}.`}
        actions={
          <Button
            icon={<Printer aria-hidden="true" className="size-5" />}
            onClick={() => {
              window.print();
            }}
          >
            Print this page
          </Button>
        }
      />
      {result.datasetInfo.kind === 'demo' && (
        <p className="border-2 border-text p-3 font-bold">{SAFETY_TEMPLATES.demoBanner}</p>
      )}
      <p className="font-semibold">{SAFETY_TEMPLATES.notAdvice}</p>

      <section aria-labelledby="print-meds">
        <h2 id="print-meds" className="mb-2 text-xl font-bold">
          Current medicines ({active.length})
        </h2>
        <ol className="flex list-decimal flex-col gap-1 pl-6">
          {active.map((medication) => (
            <li key={medication.id}>
              <span className="font-semibold">{medication.displayName}</span>
              {medication.strengthText !== null ? `, ${medication.strengthText}` : ''} (
              {KIND_LABELS[medication.kind]})
              {medication.ingredientRxcuis.length === 0
                ? ` [${SAFETY_TEMPLATES.couldNotCheck}]`
                : ''}
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="print-flags">
        <h2 id="print-flags" className="mb-2 text-xl font-bold">
          Flagged combinations: {summaryLine(result.summary)}
        </h2>
        {result.flaggedPairs.length === 0 ? (
          <p>{noKnownInteractionText(result.datasetInfo)}</p>
        ) : (
          <ol className="flex list-decimal flex-col gap-3 pl-6">
            {result.flaggedPairs.map((pair) => (
              <li key={pair.id}>
                <p className="font-semibold">
                  {SEVERITY_LABELS[pair.severity]}: {pair.medicationA.displayName} with{' '}
                  {pair.medicationB.displayName}
                </p>
                <p>{pair.mechanism ?? SEVERITY_DESCRIPTIONS[pair.severity]}</p>
                <p className="text-sm">Reference: {pair.sourceRef}</p>
              </li>
            ))}
          </ol>
        )}
      </section>

      {result.uncheckedMedications.length > 0 && (
        <section aria-labelledby="print-unchecked">
          <h2 id="print-unchecked" className="mb-2 text-xl font-bold">
            Could not check ({result.uncheckedMedications.length})
          </h2>
          <ul className="flex list-disc flex-col gap-1 pl-6">
            {result.uncheckedMedications.map((medication) => (
              <li key={medication.id}>
                <span className="font-semibold">{medication.displayName}</span>:{' '}
                {UNCHECKED_REASON_TEXT[medication.reason]}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-2 border-t border-border-strong pt-4">
        <p className="font-semibold">{SAFETY_TEMPLATES.askPharmacist}</p>
        <p>{SAFETY_TEMPLATES.supplementCoverage}</p>
        <p>{SAFETY_TEMPLATES.keepTaking}</p>
        <p>{SAFETY_TEMPLATES.urgent}</p>
        <DatasetAttribution info={result.datasetInfo} />
      </section>

      <section aria-labelledby="print-notes" className="hidden print:block">
        <h2 id="print-notes" className="mb-2 text-xl font-bold">
          Notes from the pharmacist
        </h2>
        <div className="h-40 border border-text" />
      </section>
    </article>
  );
}
