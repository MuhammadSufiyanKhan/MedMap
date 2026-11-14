import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateInviteRequest, InvitableRole, Member } from '@medmap/shared';
import * as profilesApi from '../../services/profiles.api';
import { keys } from './keys';

export function useMembers(profileId: string) {
  return useQuery({
    queryKey: keys.members(profileId),
    queryFn: () => profilesApi.listMembers(profileId),
  });
}

/** Pending and accepted invites. Only the owner may read them. */
export function useInvites(profileId: string, enabled: boolean) {
  return useQuery({
    queryKey: keys.invites(profileId),
    queryFn: () => profilesApi.listInvites(profileId),
    enabled,
  });
}

export function useCreateInvite(profileId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { values: CreateInviteRequest; key: string }) =>
      profilesApi.createInvite(profileId, input.values, input.key),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: keys.invites(profileId) });
    },
  });
}

export function useRevokeInvite(profileId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string) => profilesApi.revokeInvite(profileId, inviteId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: keys.invites(profileId) });
    },
  });
}

export function useChangeMemberRole(profileId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { member: Member; role: InvitableRole }) =>
      profilesApi.replaceMemberRole(
        profileId,
        input.member.userId,
        input.member.version,
        input.role,
      ),
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: keys.members(profileId) });
    },
  });
}

export function useRemoveMember(profileId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => profilesApi.removeMember(profileId, userId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: keys.members(profileId) }),
        queryClient.invalidateQueries({ queryKey: keys.profiles, exact: true }),
      ]);
    },
  });
}

export function useAcceptInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => profilesApi.acceptInvite(token),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: keys.profiles });
    },
  });
}
