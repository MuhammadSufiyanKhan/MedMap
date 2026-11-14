import { zodResolver } from '@hookform/resolvers/zod';
import { Copy } from 'lucide-react';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useNavigate, useParams } from 'react-router';
import { createInviteRequestSchema, INVITABLE_ROLES } from '@medmap/shared';
import type { CreateInviteRequest, InvitableRole, Member } from '@medmap/shared';
import { applyApiErrors } from '../../application/forms/errors';
import { newIdempotencyKey, useProfile } from '../../application/queries/profiles';
import {
  useAcceptInvite,
  useChangeMemberRole,
  useCreateInvite,
  useInvites,
  useMembers,
  useRemoveMember,
  useRevokeInvite,
} from '../../application/queries/sharing';
import { useSession } from '../../application/session';
import { useToasts } from '../../application/stores/toasts';
import { errorMessage } from '../../domain/errors';
import { formatDate, ROLE_DESCRIPTIONS, ROLE_LABELS } from '../../domain/format';
import { Button } from '../ui/Button';
import { Badge, Card, ErrorState, LoadingBlock } from '../ui/Card';
import { Input, Select } from '../ui/Field';
import { Notice } from '../ui/Notice';
import { ButtonLink, PageHeader } from '../ui/Page';

const ROLE_OPTIONS = INVITABLE_ROLES.map((role) => ({
  value: role,
  label: `${ROLE_LABELS[role]}: ${ROLE_DESCRIPTIONS[role]}`,
}));

function MemberRow({
  member,
  profileId,
  isOwner,
  isSelf,
}: {
  member: Member;
  profileId: string;
  isOwner: boolean;
  isSelf: boolean;
}) {
  const changeRole = useChangeMemberRole(profileId);
  const remove = useRemoveMember(profileId);
  const show = useToasts((state) => state.show);
  const navigate = useNavigate();
  const editable = isOwner && member.role !== 'owner';
  return (
    <li>
      <Card className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-1">
          <p className="break-all font-semibold">
            {member.email} {isSelf && <span className="font-normal text-text-muted">(you)</span>}
          </p>
          <p className="text-sm text-text-muted">
            <Badge tone={member.role === 'owner' ? 'primary' : 'neutral'}>
              {ROLE_LABELS[member.role]}
            </Badge>{' '}
            since {formatDate(member.joinedAt)}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          {editable && (
            <Select
              label={`Role for ${member.email}`}
              value={member.role}
              disabled={changeRole.isPending}
              onChange={(event) => {
                changeRole.mutate(
                  { member, role: event.target.value as InvitableRole },
                  {
                    onSuccess: () => {
                      show('Role changed');
                    },
                    onError: (error) => {
                      show(errorMessage(error), 'error');
                    },
                  },
                );
              }}
              options={INVITABLE_ROLES.map((role) => ({ value: role, label: ROLE_LABELS[role] }))}
            />
          )}
          {member.role !== 'owner' && (isOwner || isSelf) && (
            <Button
              variant="danger"
              loading={remove.isPending}
              onClick={() => {
                remove.mutate(member.userId, {
                  onSuccess: () => {
                    show(isSelf ? 'You left the profile' : 'Access removed');
                    if (isSelf) {
                      void navigate('/app');
                    }
                  },
                  onError: (error) => {
                    show(errorMessage(error), 'error');
                  },
                });
              }}
            >
              {isSelf ? 'Leave profile' : 'Remove access'}
            </Button>
          )}
        </div>
      </Card>
    </li>
  );
}

function InviteForm({ profileId }: { profileId: string }) {
  const create = useCreateInvite(profileId);
  const show = useToasts((state) => state.show);
  const key = useRef(newIdempotencyKey());
  const [formError, setFormError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const form = useForm<CreateInviteRequest>({
    resolver: zodResolver(createInviteRequestSchema),
    defaultValues: { email: '', role: 'caregiver' },
  });
  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      const invite = await create.mutateAsync({ values, key: key.current });
      key.current = newIdempotencyKey();
      setLink(`${window.location.origin}/invites/accept?token=${invite.token}`);
      show('Invite created');
      form.reset();
    } catch (error) {
      key.current = newIdempotencyKey();
      setFormError(applyApiErrors(error, form.setError, ['email', 'role']));
    }
  });
  return (
    <Card className="flex flex-col gap-4">
      <h2 className="text-xl font-bold">Invite someone</h2>
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
          label="Their email"
          type="email"
          autoComplete="off"
          hint="They need a MedMap account with this address to accept."
          error={form.formState.errors.email?.message}
          {...form.register('email')}
        />
        <Select label="What they can do" options={ROLE_OPTIONS} {...form.register('role')} />
        <div>
          <Button type="submit" loading={form.formState.isSubmitting}>
            Create invite
          </Button>
        </div>
      </form>
      {link !== null && (
        <Notice tone="primary" title="Invite link">
          <p className="text-sm">
            An email is on its way if email is set up. You can also send this link yourself. It is
            shown only now and works once, for 7 days.
          </p>
          <p
            className="mt-2 break-all rounded-sm bg-surface-raised p-2 text-sm"
            data-testid="invite-link"
          >
            {link}
          </p>
          <div className="mt-2">
            <Button
              variant="secondary"
              icon={<Copy aria-hidden="true" className="size-4" />}
              onClick={() => {
                navigator.clipboard
                  .writeText(link)
                  .then(() => {
                    show('Link copied');
                  })
                  .catch(() => {
                    show('Copying did not work. Select the link and copy it by hand.', 'error');
                  });
              }}
            >
              Copy link
            </Button>
          </div>
        </Notice>
      )}
    </Card>
  );
}

export default function SharingPage() {
  const { profileId = '' } = useParams();
  const { user } = useSession();
  const profile = useProfile(profileId);
  const members = useMembers(profileId);
  const isOwner = profile.data?.role === 'owner';
  const invites = useInvites(profileId, isOwner);
  const revoke = useRevokeInvite(profileId);
  const show = useToasts((state) => state.show);

  if (profile.isPending) {
    return <LoadingBlock label="Loading sharing" />;
  }
  if (profile.isError) {
    return (
      <ErrorState message={errorMessage(profile.error)} onRetry={() => void profile.refetch()} />
    );
  }
  const pending = (invites.data ?? []).filter((invite) => invite.acceptedAt === null);

  return (
    <>
      <PageHeader
        back={{ to: `/app/profiles/${profileId}`, label: profile.data.displayName }}
        title="Sharing"
        lead="People who can see this medicine list."
      />
      <div className="flex max-w-3xl flex-col gap-6">
        <section aria-labelledby="members-heading" className="flex flex-col gap-3">
          <h2 id="members-heading" className="text-xl font-bold">
            People with access
          </h2>
          {members.isPending && <LoadingBlock label="Loading people" rows={2} />}
          {members.isError && (
            <ErrorState
              message={errorMessage(members.error)}
              onRetry={() => void members.refetch()}
            />
          )}
          {members.data !== undefined && (
            <ul className="flex flex-col gap-3" data-testid="member-list">
              {members.data.map((member) => (
                <MemberRow
                  key={member.userId}
                  member={member}
                  profileId={profileId}
                  isOwner={isOwner}
                  isSelf={member.userId === user?.id}
                />
              ))}
            </ul>
          )}
        </section>

        {isOwner ? (
          <>
            <InviteForm profileId={profileId} />
            <section aria-labelledby="invites-heading" className="flex flex-col gap-3">
              <h2 id="invites-heading" className="text-xl font-bold">
                Invites waiting
              </h2>
              {invites.isPending && <LoadingBlock label="Loading invites" rows={1} />}
              {invites.isSuccess && pending.length === 0 && (
                <p className="text-text-muted">No invites are waiting.</p>
              )}
              {pending.length > 0 && (
                <ul className="flex flex-col gap-3">
                  {pending.map((invite) => (
                    <li key={invite.id}>
                      <Card className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <p>
                          <span className="break-all font-semibold">{invite.email}</span> as{' '}
                          {ROLE_LABELS[invite.role]}. Expires {formatDate(invite.expiresAt)}.
                        </p>
                        <Button
                          variant="secondary"
                          onClick={() => {
                            revoke.mutate(invite.id, {
                              onSuccess: () => {
                                show('Invite revoked');
                              },
                              onError: (error) => {
                                show(errorMessage(error), 'error');
                              },
                            });
                          }}
                        >
                          Revoke invite
                        </Button>
                      </Card>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        ) : (
          <Notice tone="neutral">
            <p>Only the owner can invite people or change roles.</p>
          </Notice>
        )}
      </div>
    </>
  );
}

/** Landing page for an invite link. Signed-out visitors are sent to sign in first. */
export function AcceptInvitePage() {
  const { status, user } = useSession();
  const accept = useAcceptInvite();
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token') ?? '';

  if (status === 'loading') {
    return (
      <div className="mx-auto max-w-md p-5">
        <LoadingBlock label="Loading" rows={1} />
      </div>
    );
  }
  if (status === 'anonymous') {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `/invites/accept?token=${encodeURIComponent(token)}` }}
      />
    );
  }
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-5 py-10">
      <h1 className="text-3xl font-bold">You have been invited</h1>
      <Card variant="raised" padding="lg" className="flex flex-col gap-4">
        {accept.isSuccess ? (
          <>
            <p role="status">You now have access as {ROLE_LABELS[accept.data.role]}.</p>
            <ButtonLink to="/app">Open my profiles</ButtonLink>
          </>
        ) : (
          <>
            <p>
              Someone wants to share a medicine list with you. You are signed in as{' '}
              <span className="break-all font-semibold">{user?.email}</span>.
            </p>
            {accept.isError && (
              <p
                role="alert"
                className="rounded-md border-2 border-danger bg-danger-soft p-3 font-semibold"
              >
                {errorMessage(accept.error)}
              </p>
            )}
            <Button
              size="lg"
              loading={accept.isPending}
              disabled={token === ''}
              onClick={() => {
                accept.mutate(token);
              }}
            >
              Accept invite
            </Button>
            {token === '' && (
              <p role="alert">This link is not complete. Open it from the email again.</p>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
