import { Printer, RefreshCw } from 'lucide-react';
import { lazy, Suspense, useState } from 'react';
import { useParams } from 'react-router';
import type { InteractionCheck } from '@medmap/shared';
import { useInteractionCheck, useRunInteractionCheck } from '../../application/queries/medications';
import { useProfile } from '../../application/queries/profiles';
import { useToasts } from '../../application/stores/toasts';
import { errorMessage } from '../../domain/errors';
import { formatDateTime } from '../../domain/format';
import { CoverageNotice } from '../features/notices';
import { FlaggedList, GraphLegend, ResultsSummary, ResultsTable } from '../features/results';
import { Button } from '../ui/Button';
import { EmptyState, ErrorState, LoadingBlock, Skeleton } from '../ui/Card';
import { Select } from '../ui/Field';
import { ButtonLink, PageHeader } from '../ui/Page';
import { Tabs } from '../ui/Tabs';

// React Flow is heavy, so it loads only when the graph tab is opened.
const InteractionGraph = lazy(() => import('../features/InteractionGraph'));

function GraphTab({ check }: { check: InteractionCheck }) {
  const [focusId, setFocusId] = useState<string>('');
  return (
    <div className="flex flex-col gap-4">
      <div className="max-w-sm">
        <Select
          label="Focus on one medicine"
          hint="Shows only that medicine and the ones it is flagged with."
          value={focusId}
          onChange={(event) => {
            setFocusId(event.target.value);
          }}
          options={[
            { value: '', label: 'Show all medicines' },
            ...check.medications.map((medication) => ({
              value: medication.id,
              label: medication.displayName,
            })),
          ]}
        />
      </div>
      <GraphLegend />
      <Suspense fallback={<Skeleton className="h-[26rem] w-full md:h-[34rem]" />}>
        <InteractionGraph check={check} focusId={focusId === '' ? null : focusId} />
      </Suspense>
      <p className="text-sm text-text-muted">
        Pinch or scroll to zoom. Drag to move around. The Table tab has the same information as
        text.
      </p>
      <CoverageNotice />
    </div>
  );
}

export default function ResultsPage() {
  const { profileId = '' } = useParams();
  const profile = useProfile(profileId);
  const check = useInteractionCheck(profileId);
  const rerun = useRunInteractionCheck(profileId);
  const show = useToasts((state) => state.show);
  const [tab, setTab] = useState('list');
  const base = `/app/profiles/${profileId}`;
  const name = profile.data?.displayName ?? 'Profile';

  return (
    <>
      <PageHeader
        back={{ to: base, label: name }}
        title={`Results for ${name}`}
        lead={check.data ? `Checked ${formatDateTime(check.data.createdAt)}` : undefined}
        actions={
          <>
            <Button
              variant="secondary"
              icon={<RefreshCw aria-hidden="true" className="size-5" />}
              loading={rerun.isPending}
              onClick={() => {
                rerun.mutate(undefined, {
                  onSuccess: () => {
                    show('Checked again');
                  },
                  onError: (error) => {
                    show(errorMessage(error), 'error');
                  },
                });
              }}
            >
              Check again
            </Button>
            <ButtonLink
              to={`${base}/print`}
              variant="secondary"
              icon={<Printer aria-hidden="true" className="size-5" />}
            >
              Page for your pharmacist
            </ButtonLink>
          </>
        }
      />
      {check.isPending && <LoadingBlock label="Checking the medicine list" rows={4} />}
      {check.isError && (
        <ErrorState
          title="The check did not run"
          message={errorMessage(check.error)}
          onRetry={() => void check.refetch()}
        />
      )}
      {check.data?.medications.length === 0 && (
        <EmptyState
          title="There is nothing to check yet"
          action={<ButtonLink to={`${base}/medications/new`}>Add a medicine</ButtonLink>}
        >
          <p>Add at least two medicines to see which combinations are flagged.</p>
        </EmptyState>
      )}
      {check.data !== undefined && check.data.medications.length > 0 && (
        <div className="flex flex-col gap-6">
          <ResultsSummary check={check.data} />
          <Tabs
            label="Ways to view the results"
            value={tab}
            onValueChange={setTab}
            items={[
              { value: 'list', label: 'List', content: <FlaggedList check={check.data} /> },
              { value: 'graph', label: 'Graph', content: <GraphTab check={check.data} /> },
              { value: 'table', label: 'Table', content: <ResultsTable check={check.data} /> },
            ]}
          />
        </div>
      )}
    </>
  );
}
