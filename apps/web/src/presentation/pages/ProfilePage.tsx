import { Network, Pill, Plus, Printer, Trash2, Users } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import type { Medication, Profile } from '@medmap/shared';
import { useStaggerIn } from '../../application/animation/hooks';
import {
  useDeleteMedication,
  useMedications,
  useUpdateMedication,
} from '../../application/queries/medications';
import { useDeleteProfile, useProfile } from '../../application/queries/profiles';
import { useToasts } from '../../application/stores/toasts';
import { errorMessage } from '../../domain/errors';
import { KIND_LABELS, plural, ROLE_LABELS } from '../../domain/format';
import { UncheckedBadge } from '../features/severity';
import { Button } from '../ui/Button';
import { Badge, Card, EmptyState, ErrorState, LoadingBlock } from '../ui/Card';
import { Dialog } from '../ui/Dialog';
import { ButtonLink, PageHeader } from '../ui/Page';

function MedicationRow({
  medication,
  profileId,
  canEdit,
}: {
  medication: Medication;
  profileId: string;
  canEdit: boolean;
}) {
  const update = useUpdateMedication(profileId);
  const remove = useDeleteMedication(profileId);
  const show = useToasts((state) => state.show);
  const [confirming, setConfirming] = useState(false);
  const stopped = medication.status === 'stopped';

  const toggle = () => {
    update.mutate(
      { medication, changes: { status: stopped ? 'active' : 'stopped' } },
      {
        onSuccess: () => {
          show(stopped ? 'Moved back to the current list' : 'Moved to no longer taken');
        },
        onError: (error) => {
          show(errorMessage(error), 'error');
        },
      },
    );
  };

  return (
    <li data-stagger>
      <Card className="flex flex-col gap-3 border-l-8 border-l-accent md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-bold">{medication.displayName}</h3>
            {medication.ingredientRxcuis.length === 0 && <UncheckedBadge />}
          </div>
          <p className="text-sm text-text-muted">
            {[medication.strengthText, KIND_LABELS[medication.kind]].filter(Boolean).join(', ')}
          </p>
          {medication.ingredientNames.length > 0 && (
            <p className="text-sm text-text-muted">
              Matched to: {medication.ingredientNames.join(', ')}
            </p>
          )}
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={toggle} loading={update.isPending}>
              {stopped ? 'Taking again' : 'No longer taken'}
            </Button>
            <Button
              variant="danger"
              icon={<Trash2 aria-hidden="true" className="size-4" />}
              onClick={() => {
                setConfirming(true);
              }}
              aria-label={`Remove ${medication.displayName}`}
            >
              Remove
            </Button>
          </div>
        )}
      </Card>
      <Dialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Remove ${medication.displayName}?`}
        description="This removes it from the list in MedMap only. It says nothing about whether to keep taking it."
      >
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              setConfirming(false);
            }}
          >
            Keep it
          </Button>
          <Button
            variant="danger"
            loading={remove.isPending}
            onClick={() => {
              remove.mutate(medication.id, {
                onSuccess: () => {
                  show('Medicine removed from the list');
                  setConfirming(false);
                },
                onError: (error) => {
                  show(errorMessage(error), 'error');
                },
              });
            }}
          >
            Remove from list
          </Button>
        </div>
      </Dialog>
    </li>
  );
}

function DeleteProfile({ profile }: { profile: Profile }) {
  const [open, setOpen] = useState(false);
  const remove = useDeleteProfile();
  const navigate = useNavigate();
  const show = useToasts((state) => state.show);
  return (
    <>
      <Button
        variant="danger"
        onClick={() => {
          setOpen(true);
        }}
      >
        Delete profile
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={`Delete ${profile.displayName}'s profile?`}
        description="The profile, its medicine list, its checks and its sharing are deleted for everyone. This cannot be undone."
      >
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              setOpen(false);
            }}
          >
            Keep profile
          </Button>
          <Button
            variant="danger"
            loading={remove.isPending}
            onClick={() => {
              remove.mutate(profile.id, {
                onSuccess: () => {
                  show('Profile deleted');
                  void navigate('/app');
                },
                onError: (error) => {
                  show(errorMessage(error), 'error');
                },
              });
            }}
          >
            Delete profile
          </Button>
        </div>
      </Dialog>
    </>
  );
}

export default function ProfilePage() {
  const { profileId = '' } = useParams();
  const profile = useProfile(profileId);
  const medications = useMedications(profileId);
  const active = medications.data?.filter((medication) => medication.status === 'active') ?? [];
  const stopped = medications.data?.filter((medication) => medication.status === 'stopped') ?? [];
  const list = useStaggerIn<HTMLUListElement>(medications.data?.length);

  if (profile.isPending) {
    return <LoadingBlock label="Loading profile" />;
  }
  if (profile.isError) {
    return (
      <ErrorState message={errorMessage(profile.error)} onRetry={() => void profile.refetch()} />
    );
  }
  const canEdit = profile.data.role !== 'viewer';
  const base = `/app/profiles/${profileId}`;

  return (
    <>
      <PageHeader
        back={{ to: '/app', label: 'All profiles' }}
        title={profile.data.displayName}
        lead={
          <span className="flex flex-wrap items-center gap-2">
            {plural(active.length, 'medicine')} on the current list
            {profile.data.role !== 'owner' && (
              <Badge tone="primary">{ROLE_LABELS[profile.data.role]}</Badge>
            )}
          </span>
        }
        actions={
          <>
            {canEdit && (
              <ButtonLink
                to={`${base}/medications/new`}
                icon={<Plus aria-hidden="true" className="size-5" />}
              >
                Add medicine
              </ButtonLink>
            )}
            <ButtonLink
              to={`${base}/results`}
              variant={canEdit ? 'secondary' : 'primary'}
              icon={<Network aria-hidden="true" className="size-5" />}
            >
              See results
            </ButtonLink>
          </>
        }
      />

      <section aria-labelledby="current-heading" className="flex flex-col gap-3">
        <h2 id="current-heading" className="text-xl font-bold">
          Current medicines
        </h2>
        {medications.isPending && <LoadingBlock label="Loading medicines" />}
        {medications.isError && (
          <ErrorState
            message={errorMessage(medications.error)}
            onRetry={() => void medications.refetch()}
          />
        )}
        {medications.isSuccess && active.length === 0 && (
          <EmptyState
            title="No medicines on the list yet"
            icon={<Pill aria-hidden="true" className="size-8" />}
            action={
              canEdit ? (
                <ButtonLink to={`${base}/medications/new`}>Add the first medicine</ButtonLink>
              ) : undefined
            }
          >
            <p>
              Add everything that is taken regularly: prescriptions, pharmacy medicines, vitamins,
              supplements and herbs.
            </p>
          </EmptyState>
        )}
        {active.length > 0 && (
          <ul ref={list} className="flex flex-col gap-3" data-testid="medication-list">
            {active.map((medication) => (
              <MedicationRow
                key={medication.id}
                medication={medication}
                profileId={profileId}
                canEdit={canEdit}
              />
            ))}
          </ul>
        )}
      </section>

      {stopped.length > 0 && (
        <section aria-labelledby="stopped-heading" className="mt-8 flex flex-col gap-3">
          <h2 id="stopped-heading" className="text-xl font-bold">
            No longer taken
          </h2>
          <p className="text-text-muted">These are kept for reference and are not checked.</p>
          <ul className="flex flex-col gap-3">
            {stopped.map((medication) => (
              <MedicationRow
                key={medication.id}
                medication={medication}
                profileId={profileId}
                canEdit={canEdit}
              />
            ))}
          </ul>
        </section>
      )}

      <section
        aria-labelledby="more-heading"
        className="no-print mt-10 flex flex-col gap-3 border-t border-border pt-6"
      >
        <h2 id="more-heading" className="text-xl font-bold">
          More
        </h2>
        <div className="flex flex-wrap gap-2">
          <ButtonLink
            to={`${base}/print`}
            variant="secondary"
            icon={<Printer aria-hidden="true" className="size-5" />}
          >
            Page for your pharmacist
          </ButtonLink>
          <ButtonLink
            to={`${base}/sharing`}
            variant="secondary"
            icon={<Users aria-hidden="true" className="size-5" />}
          >
            Sharing
          </ButtonLink>
          {profile.data.role === 'owner' && <DeleteProfile profile={profile.data} />}
        </div>
      </section>
    </>
  );
}
