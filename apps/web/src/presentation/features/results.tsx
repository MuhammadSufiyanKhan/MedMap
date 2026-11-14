import {
  noKnownInteractionText,
  SAFETY_TEMPLATES,
  SEVERITIES,
  SEVERITY_DESCRIPTIONS,
  SEVERITY_LABELS,
  UNCHECKED_REASON_TEXT,
} from '@medmap/shared';
import type { FlaggedPair, InteractionCheck, Severity } from '@medmap/shared';
import { useCountUp } from '../../application/animation/hooks';
import { plural } from '../../domain/format';
import { Card } from '../ui/Card';
import { Notice } from '../ui/Notice';
import { Table } from '../ui/Table';
import type { Column } from '../ui/Table';
import { AskPharmacist, CoverageNotice, DatasetAttribution } from './notices';
import { LineSample, SeverityBadge, SeverityIcon, UncheckedBadge } from './severity';

function CountTile({ severity, count }: { severity: Severity; count: number }) {
  const shown = useCountUp(count);
  return (
    <div
      className={`flex flex-1 flex-col gap-1 rounded-lg border-2 border-severity-${severity} bg-severity-${severity}-soft p-3 md:p-4`}
    >
      {/* The label and icon are static. Only the digits count up, and the real value is
          always available to assistive technology. */}
      <span className={`flex items-center gap-1.5 text-sm font-bold text-severity-${severity}`}>
        <SeverityIcon severity={severity} />
        {SEVERITY_LABELS[severity]}
      </span>
      <span className="text-3xl font-bold tabular-nums" aria-hidden="true">
        {shown}
      </span>
      <span className="sr-only">{count}</span>
    </div>
  );
}

/** "N serious, N moderate, N minor" plus the unchecked count and the dataset. */
export function ResultsSummary({ check }: { check: InteractionCheck }) {
  const unchecked = check.uncheckedMedications.length;
  return (
    <section aria-labelledby="summary-heading" className="flex flex-col gap-4">
      <h2 id="summary-heading" className="sr-only">
        Summary
      </h2>
      <p className="text-lg" data-testid="summary-line">
        <strong>
          {check.summary.serious} serious, {check.summary.moderate} moderate, {check.summary.minor}{' '}
          minor
        </strong>{' '}
        across {plural(check.medications.length, 'medicine')}.
      </p>
      <div className="flex gap-2 md:gap-3">
        {SEVERITIES.map((severity) => (
          <CountTile key={severity} severity={severity} count={check.summary[severity]} />
        ))}
      </div>
      {unchecked > 0 && (
        <Notice tone="warning" icon={<UncheckedBadge />} className="flex-col md:flex-row">
          <p data-testid="unchecked-summary">
            <strong>{plural(unchecked, 'medicine')} could not be checked.</strong> Nothing here
            covers {unchecked === 1 ? 'it' : 'them'}. Ask your pharmacist about{' '}
            {unchecked === 1 ? 'it' : 'them'} too.
          </p>
        </Notice>
      )}
      <DatasetAttribution info={check.datasetInfo} />
    </section>
  );
}

function FlaggedItem({ pair, check }: { pair: FlaggedPair; check: InteractionCheck }) {
  const ingredientA = pair.ingredientA.name;
  const ingredientB = pair.ingredientB.name;
  return (
    <li>
      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <SeverityBadge severity={pair.severity} />
          <h3 className="text-lg font-bold">
            {pair.medicationA.displayName} <span className="font-normal text-text-muted">with</span>{' '}
            {pair.medicationB.displayName}
          </h3>
        </div>
        <p>{SEVERITY_DESCRIPTIONS[pair.severity]}</p>
        {ingredientA !== null && ingredientB !== null && (
          <p className="text-sm text-text-muted">
            Ingredients involved: {ingredientA} and {ingredientB}.
          </p>
        )}
        {pair.mechanism !== null && (
          <p className="text-sm">
            <span className="font-semibold">From the source: </span>
            {pair.mechanism}
          </p>
        )}
        <AskPharmacist />
        <p className="text-sm text-text-muted">
          Source: {check.datasetInfo.name}, version {check.datasetInfo.version}. Reference:{' '}
          {pair.sourceRef}
        </p>
      </Card>
    </li>
  );
}

/**
 * The primary results view: a ranked, plain-language list.
 *
 * SAFETY: when nothing is flagged the list shows the fixed "no known interaction found in
 * this source" sentence. It never shows a tick, a green state or any word that suggests
 * the combination was cleared.
 */
export function FlaggedList({ check }: { check: InteractionCheck }) {
  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="flagged-heading" className="flex flex-col gap-3">
        <h2 id="flagged-heading" className="text-2xl font-bold">
          Flagged combinations
        </h2>
        {check.flaggedPairs.length === 0 ? (
          <Notice tone="neutral">
            <p data-testid="no-flags">{noKnownInteractionText(check.datasetInfo)}</p>
            <p className="mt-2">
              You can still ask your pharmacist or prescriber to look over the whole list.
            </p>
          </Notice>
        ) : (
          <ol className="flex flex-col gap-3" data-testid="flagged-list">
            {check.flaggedPairs.map((pair) => (
              <FlaggedItem key={pair.id} pair={pair} check={check} />
            ))}
          </ol>
        )}
      </section>

      {check.uncheckedMedications.length > 0 && (
        <section aria-labelledby="unchecked-heading" className="flex flex-col gap-3">
          <h2 id="unchecked-heading" className="text-2xl font-bold">
            Could not check
          </h2>
          <ul className="flex flex-col gap-3" data-testid="unchecked-list">
            {check.uncheckedMedications.map((medication) => (
              <li key={medication.id}>
                <Card className="hatched flex flex-col gap-2 border-2 border-dashed border-unchecked">
                  <div className="flex flex-wrap items-center gap-2">
                    <UncheckedBadge />
                    <h3 className="text-lg font-bold">{medication.displayName}</h3>
                  </div>
                  <p>{UNCHECKED_REASON_TEXT[medication.reason]}</p>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}

      <CoverageNotice />
      <Notice tone="neutral">
        <p>{SAFETY_TEMPLATES.keepTaking}</p>
        <p className="mt-1 font-semibold">{SAFETY_TEMPLATES.urgent}</p>
      </Notice>
    </div>
  );
}

/** Explains the three line styles and the hatched marker. */
export function GraphLegend() {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm" aria-label="Legend">
      {SEVERITIES.map((severity) => (
        <li key={severity} className="flex items-center gap-2">
          <LineSample severity={severity} />
          <SeverityIcon severity={severity} className={`size-4 text-severity-${severity}`} />
          <span>{SEVERITY_LABELS[severity]}</span>
        </li>
      ))}
      <li className="flex items-center gap-2">
        <span className="hatched inline-block h-4 w-8 rounded-sm border-2 border-dashed border-unchecked" />
        <span>{SAFETY_TEMPLATES.couldNotCheck}</span>
      </li>
      <li className="text-text-muted">Pairs with no flag in this source have no line.</li>
    </ul>
  );
}

interface TableRow {
  key: string;
  first: string;
  second: string;
  status: Severity | 'unchecked';
  detail: string;
  reference: string;
}

/** Table alternative to the graph: every flagged pair and every unchecked medicine. */
export function ResultsTable({ check }: { check: InteractionCheck }) {
  const rows: TableRow[] = [
    ...check.flaggedPairs.map((pair) => ({
      key: pair.id,
      first: pair.medicationA.displayName,
      second: pair.medicationB.displayName,
      status: pair.severity,
      detail: pair.mechanism ?? SEVERITY_DESCRIPTIONS[pair.severity],
      reference: pair.sourceRef,
    })),
    ...check.uncheckedMedications.map((medication) => ({
      key: `unchecked-${medication.id}`,
      first: medication.displayName,
      second: 'All other medicines',
      status: 'unchecked' as const,
      detail: UNCHECKED_REASON_TEXT[medication.reason],
      reference: '',
    })),
  ];
  const columns: Column<TableRow>[] = [
    {
      key: 'first',
      header: 'Medicine',
      cell: (row) => <span className="font-semibold">{row.first}</span>,
    },
    { key: 'second', header: 'With', cell: (row) => row.second },
    {
      key: 'status',
      header: 'Flag',
      cell: (row) =>
        row.status === 'unchecked' ? <UncheckedBadge /> : <SeverityBadge severity={row.status} />,
    },
    { key: 'detail', header: 'What the source says', cell: (row) => row.detail },
    { key: 'reference', header: 'Reference', cell: (row) => row.reference },
  ];
  if (rows.length === 0) {
    return (
      <Notice tone="neutral">
        <p>{noKnownInteractionText(check.datasetInfo)}</p>
      </Notice>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <Table
        caption="Flagged combinations and medicines that could not be checked"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.key}
      />
      <p className="text-sm text-text-muted">
        Pairs that are not listed had no flag in this source.
      </p>
      <AskPharmacist />
    </div>
  );
}
