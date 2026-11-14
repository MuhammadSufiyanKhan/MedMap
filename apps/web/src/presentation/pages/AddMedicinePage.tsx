import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useProfile } from '../../application/queries/profiles';
import { useToasts } from '../../application/stores/toasts';
import { errorMessage } from '../../domain/errors';
import { MedicineForm } from '../features/MedicineForm';
import { Button } from '../ui/Button';
import { Card, ErrorState, LoadingBlock } from '../ui/Card';
import { ButtonLink, PageHeader } from '../ui/Page';

export default function AddMedicinePage() {
  const { profileId = '' } = useParams();
  const profile = useProfile(profileId);
  const navigate = useNavigate();
  const show = useToasts((state) => state.show);
  const [saved, setSaved] = useState<string[]>([]);
  const [formKey, setFormKey] = useState(0);
  const base = `/app/profiles/${profileId}`;

  if (profile.isPending) {
    return <LoadingBlock label="Loading profile" />;
  }
  if (profile.isError) {
    return (
      <ErrorState message={errorMessage(profile.error)} onRetry={() => void profile.refetch()} />
    );
  }
  if (profile.data.role === 'viewer') {
    return (
      <ErrorState
        title="You can view this profile but not change it"
        message="Ask the owner to make you a caregiver if you need to add medicines."
      />
    );
  }

  return (
    <>
      <PageHeader
        back={{ to: base, label: profile.data.displayName }}
        title="Add a medicine"
        lead="Type the name as it is printed on the label."
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <MedicineForm
          key={formKey}
          profileId={profileId}
          source="manual"
          onSaved={(displayName) => {
            show('Medicine added');
            setSaved((current) => [...current, displayName]);
            setFormKey((current) => current + 1);
          }}
        />
        <aside aria-label="Added in this visit">
          <Card className="flex flex-col gap-3">
            <h2 className="text-lg font-bold">Added just now</h2>
            {saved.length === 0 ? (
              <p className="text-text-muted">Nothing yet. Medicines you save appear here.</p>
            ) : (
              <ul className="flex list-disc flex-col gap-1 pl-5" data-testid="added-list">
                {saved.map((name, index) => (
                  <li key={`${name}-${String(index)}`}>{name}</li>
                ))}
              </ul>
            )}
            <div className="flex flex-col gap-2">
              <ButtonLink
                to={`${base}/results`}
                variant={saved.length >= 2 ? 'primary' : 'secondary'}
              >
                See results
              </ButtonLink>
              <Button
                variant="ghost"
                onClick={() => {
                  void navigate(base);
                }}
              >
                Back to the list
              </Button>
            </div>
          </Card>
        </aside>
      </div>
    </>
  );
}
