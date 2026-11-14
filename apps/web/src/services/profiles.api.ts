import {
  createdInviteSchema,
  invitePageSchema,
  memberPageSchema,
  memberSchema,
  profilePageSchema,
  profileSchema,
} from '@medmap/shared';
import type {
  Page,
  CreatedInvite,
  CreateInviteRequest,
  CreateProfileRequest,
  InvitableRole,
  Invite,
  Member,
  Profile,
  UpdateProfileRequest,
} from '@medmap/shared';
import { api } from './http';
import type { ApiResult } from './http';

const PAGE_LIMIT = 100;

export async function listProfiles(): Promise<Profile[]> {
  const items: Profile[] = [];
  let cursor: string | null = null;
  do {
    const page: ApiResult<Page<Profile>> = await api.request('/profiles', {
      query: { limit: PAGE_LIMIT, cursor },
      schema: profilePageSchema,
    });
    items.push(...page.data.items);
    cursor = page.data.nextCursor;
  } while (cursor !== null);
  return items;
}

export async function getProfile(profileId: string): Promise<Profile> {
  return (await api.request(`/profiles/${profileId}`, { schema: profileSchema })).data;
}

export async function createProfile(
  input: CreateProfileRequest,
  idempotencyKey: string,
): Promise<Profile> {
  return (
    await api.request('/profiles', {
      method: 'POST',
      body: input,
      schema: profileSchema,
      idempotencyKey,
    })
  ).data;
}

export async function updateProfile(
  profileId: string,
  version: number,
  changes: UpdateProfileRequest,
): Promise<Profile> {
  return (
    await api.request(`/profiles/${profileId}`, {
      method: 'PATCH',
      body: changes,
      schema: profileSchema,
      ifMatch: version,
    })
  ).data;
}

export async function deleteProfile(profileId: string): Promise<void> {
  await api.request(`/profiles/${profileId}`, { method: 'DELETE' });
}

export async function listMembers(profileId: string): Promise<Member[]> {
  const { data } = await api.request(`/profiles/${profileId}/members`, {
    query: { limit: PAGE_LIMIT },
    schema: memberPageSchema,
  });
  return data.items;
}

export async function replaceMemberRole(
  profileId: string,
  userId: string,
  version: number,
  role: InvitableRole,
): Promise<Member> {
  return (
    await api.request(`/profiles/${profileId}/members/${userId}`, {
      method: 'PUT',
      body: { role },
      schema: memberSchema,
      ifMatch: version,
    })
  ).data;
}

export async function removeMember(profileId: string, userId: string): Promise<void> {
  await api.request(`/profiles/${profileId}/members/${userId}`, { method: 'DELETE' });
}

export async function listInvites(profileId: string): Promise<Invite[]> {
  const { data } = await api.request(`/profiles/${profileId}/invites`, {
    query: { limit: PAGE_LIMIT },
    schema: invitePageSchema,
  });
  return data.items;
}

export async function createInvite(
  profileId: string,
  input: CreateInviteRequest,
  idempotencyKey: string,
): Promise<CreatedInvite> {
  return (
    await api.request(`/profiles/${profileId}/invites`, {
      method: 'POST',
      body: input,
      schema: createdInviteSchema,
      idempotencyKey,
    })
  ).data;
}

export async function revokeInvite(profileId: string, inviteId: string): Promise<void> {
  await api.request(`/profiles/${profileId}/invites/${inviteId}`, { method: 'DELETE' });
}

export async function acceptInvite(token: string): Promise<Member> {
  return (
    await api.request('/invite-acceptances', {
      method: 'POST',
      body: { token },
      schema: memberSchema,
    })
  ).data;
}
