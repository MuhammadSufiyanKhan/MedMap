import { FlaskConical, Info, WifiOff } from 'lucide-react';
import { datasetAttribution, SAFETY_TEMPLATES } from '@medmap/shared';
import type { DatasetInfo } from '@medmap/shared';
import { useAppConfig } from '../../application/queries/medications';
import { usePreferences } from '../../application/stores/preferences';
import { useOnline } from '../../application/useOnline';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { Notice } from '../ui/Notice';

/**
 * Persistent banner while the active dataset is the demo set (safety rule 6). It has no
 * close button and is not animated.
 */
export function DemoBanner() {
  const { data } = useAppConfig();
  if (data?.demoMode !== true) {
    return null;
  }
  return (
    <div role="note" aria-label="Demo data" className="bg-demo px-4 py-2 text-on-demo">
      <p className="mx-auto flex max-w-page items-center gap-2 text-sm font-bold">
        <FlaskConical aria-hidden="true" className="size-4 shrink-0" />
        <span>{SAFETY_TEMPLATES.demoBanner}</span>
        <span className="hidden font-normal md:inline">{SAFETY_TEMPLATES.demoDetail}</span>
      </p>
    </div>
  );
}

export function OfflineBanner() {
  const online = useOnline();
  if (online) {
    return null;
  }
  return (
    <div
      role="status"
      className="no-print border-b border-border-strong bg-surface-sunken px-4 py-2"
    >
      <p className="mx-auto flex max-w-page items-center gap-2 text-sm font-semibold">
        <WifiOff aria-hidden="true" className="size-4 shrink-0" />
        You are offline. What you see may be out of date, and changes will not save.
      </p>
    </div>
  );
}

/** "Not medical advice" notice for the footer of every page (safety rule 7). */
export function FooterDisclaimer() {
  return (
    <footer className="border-t border-border bg-surface-raised px-5 py-6 text-sm text-text-muted">
      <div className="mx-auto flex max-w-page flex-col gap-2">
        <p className="font-semibold text-text">{SAFETY_TEMPLATES.notAdvice}</p>
        <p>{SAFETY_TEMPLATES.keepTaking}</p>
        <p>{SAFETY_TEMPLATES.urgent}</p>
      </div>
    </footer>
  );
}

/** The dataset behind a result: name, version and date (safety rule 5). */
export function DatasetAttribution({ info }: { info: DatasetInfo }) {
  return (
    <p className="text-sm text-text-muted" data-testid="dataset-attribution">
      {datasetAttribution(info)}
      {info.kind === 'demo' ? '. Demo data, not medical information.' : ''}
    </p>
  );
}

/**
 * First-run notice. It blocks the signed-in app until the user confirms they have read
 * that MedMap is an information tool (safety rule 7).
 */
export function FirstRunNotice() {
  const accepted = usePreferences((state) => state.noticeAccepted);
  const update = usePreferences((state) => state.update);
  return (
    <Dialog
      open={!accepted}
      dismissible={false}
      title="Before you start"
      description="Please read this first. It is short."
    >
      <div className="flex flex-col gap-4">
        <ul className="flex list-disc flex-col gap-2 pl-5">
          <li>{SAFETY_TEMPLATES.notAdvice}</li>
          <li>
            MedMap shows interactions that a named source lists. It never tells you that a
            combination has no risks.
          </li>
          <li>{SAFETY_TEMPLATES.supplementCoverage}</li>
          <li>{SAFETY_TEMPLATES.keepTaking}</li>
          <li>{SAFETY_TEMPLATES.urgent}</li>
        </ul>
        <Button
          size="lg"
          onClick={() => {
            update({ noticeAccepted: true });
          }}
        >
          I understand
        </Button>
      </div>
    </Dialog>
  );
}

/** Fixed closing lines for every flagged result (safety rule 3). */
export function AskPharmacist() {
  return (
    <p className="flex items-start gap-2 font-semibold">
      <Info aria-hidden="true" className="mt-1 size-4 shrink-0" />
      {SAFETY_TEMPLATES.askPharmacist}
    </p>
  );
}

/** Coverage note shown wherever results appear (safety rule 4). */
export function CoverageNotice() {
  return (
    <Notice tone="neutral" icon={<Info aria-hidden="true" className="size-5" />}>
      <p>{SAFETY_TEMPLATES.supplementCoverage}</p>
    </Notice>
  );
}
