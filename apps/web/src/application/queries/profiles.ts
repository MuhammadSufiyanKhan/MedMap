import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateProfileRequest, Profile, UpdateProfileRequest } from '@medmap/shared';
import { newIdempotencyKey } from '../../services/http';
import * as profilesApi from '../../services/profiles.api';
import { keys } from './keys';

export function useProfiles() {
  return useQuery({ queryKey: keys.profiles, queryFn: profilesApi.listProfiles });
}

export function useProfile(profileId: string) {
  return useQuery({
    queryKey: keys.profile(profileId),
    queryFn: () => profilesApi.getProfile(profileId),
  });
}

export function useCreateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    // One key per mutation call; TanStack retries reuse the same variables and key.
    mutationFn: (input: { values: CreateProfileRequest; key: string }) =>
      profilesApi.createProfile(input.values, input.key),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: keys.profiles });
    },
  });
}

export function useUpdateProfile(profile: Profile) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (changes: UpdateProfileRequest) =>
      profilesApi.updateProfile(profile.id, profile.version, changes),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: keys.profiles });
    },
    onError: async () => {
      // A 412 means our copy is stale: fetch the current one so a retry can succeed.
      await queryClient.invalidateQueries({ queryKey: keys.profile(profile.id) });
    },
  });
}

export function useDeleteProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (profileId: string) => profilesApi.deleteProfile(profileId),
    onSuccess: async (_data, profileId) => {
      queryClient.removeQueries({ queryKey: keys.profile(profileId) });
      await queryClient.invalidateQueries({ queryKey: keys.profiles, exact: true });
    },
  });
}

export { newIdempotencyKey };
