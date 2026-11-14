import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, UserRound } from 'lucide-react';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { z } from 'zod';
import { useStaggerIn } from '../../application/animation/hooks';
import { applyApiErrors } from '../../application/forms/errors';
import {
  newIdempotencyKey,
  useCreateProfile,
  useProfiles,
} from '../../application/queries/profiles';
import { useToasts } from '../../application/stores/toasts';
import { errorMessage } from '../../domain/errors';
import { plural, ROLE_LABELS } from '../../domain/format';
import { Button } from '../ui/Button';
import { Badge, Card, EmptyState, ErrorState, LoadingBlock } from '../ui/Card';
import { Dialog } from '../ui/Dialog';
import { Input } from '../ui/Field';
import { PageHeader } from '../ui/Page';

const currentYear = new Date().getFullYear();
const profileFormSchema = z.object({
  displayName: z.string().trim().min(1, 'Enter a name').max(80),
  birthYear: z
    .string()
    .trim()
    .refine(
      (value) =>
        value === '' ||
        (/^\d{4}$/.test(value) && Number(value) >= 1900 && Number(value) <= currentYear),
      {
        message: `Enter a year between 1900 and ${String(currentYear)}, or leave it empty`,
      },
    ),
});
type ProfileForm = z.infer<typeof profileFormSchema>;

function CreateProfileDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useCreateProfile();
  const show = useToasts((state) => state.show);
  const [formError, setFormError] = useState<string | null>(null);
  // One key for this open dialog: a double click or a retry cannot create two profiles.
  const key = useRef(newIdempotencyKey());
  const form = useForm<ProfileForm>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: { displayName: '', birthYear: '' },
  });
  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      await create.mutateAsync({
        values: {
          displayName: values.displayName,
          birthYear: values.birthYear === '' ? null : Number(values.birthYear),
        },
        key: key.current,
      });
      show('Profile created');
      key.current = newIdempotencyKey();
      form.reset();
      onClose();
    } catch (error) {
      setFormError(applyApiErrors(error, form.setError, ['displayName', 'birthYear']));
    }
  });
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          onClose();
        }
      }}
      title="New profile"
      description="A profile holds one person's medicine list."
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {formError !== null && (
          <p
            role="alert"
            className="rounded-md border-2 border-danger bg-danger-soft p-3 font-semibold"
          >
            {formError}
          </p>
        )}
        <Input
          label="Who is this list for?"
          hint="A first name or a nickname is enough, such as Mum."
          autoComplete="off"
          error={form.formState.errors.displayName?.message}
          {...form.register('displayName')}
        />
        <Input
          label="Year of birth"
          optional
          inputMode="numeric"
          autoComplete="off"
          error={form.formState.errors.birthYear?.message}
          {...form.register('birthYear')}
        />
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={form.formState.isSubmitting}>
            Create profile
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export default function DashboardPage() {
  const profiles = useProfiles();
  const [creating, setCreating] = useState(false);
  const list = useStaggerIn<HTMLUListElement>(profiles.data?.length);
  return (
    <>
      <PageHeader
        title="Profiles"
        lead="One list of medicines for each person."
        actions={
          <Button
            icon={<Plus aria-hidden="true" className="size-5" />}
            onClick={() => {
              setCreating(true);
            }}
          >
            New profile
          </Button>
        }
      />
      {profiles.isPending && <LoadingBlock label="Loading profiles" />}
      {profiles.isError && (
        <ErrorState
          message={errorMessage(profiles.error)}
          onRetry={() => void profiles.refetch()}
        />
      )}
      {profiles.data?.length === 0 && (
        <EmptyState
          title="No profiles yet"
          icon={<UserRound aria-hidden="true" className="size-8" />}
          action={
            <Button
              onClick={() => {
                setCreating(true);
              }}
            >
              Create the first profile
            </Button>
          }
        >
          <p>
            Start with the person whose medicines you want to map. You can add more people later.
          </p>
        </EmptyState>
      )}
      {profiles.data !== undefined && profiles.data.length > 0 && (
        <ul ref={list} className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {profiles.data.map((profile) => (
            <li key={profile.id} data-stagger>
              <Link
                to={`/app/profiles/${profile.id}`}
                className="block rounded-lg hover:shadow-raised"
                aria-label={`${profile.displayName}, ${plural(profile.activeMedicationCount, 'medicine')}`}
              >
                <Card className="flex h-full flex-col gap-2 border-l-8 border-l-accent">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-xl font-bold">{profile.displayName}</h2>
                    {profile.role !== 'owner' && (
                      <Badge tone="primary">{ROLE_LABELS[profile.role]}</Badge>
                    )}
                  </div>
                  <p className="text-text-muted">
                    {plural(profile.activeMedicationCount, 'medicine')}
                  </p>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <CreateProfileDialog
        open={creating}
        onClose={() => {
          setCreating(false);
        }}
      />
    </>
  );
}
