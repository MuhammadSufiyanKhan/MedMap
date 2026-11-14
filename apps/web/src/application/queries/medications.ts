import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateMedicationInput, Medication, UpdateMedicationRequest } from '@medmap/shared';
import * as medicationsApi from '../../services/medications.api';
import { keys } from './keys';

export function useAppConfig() {
  return useQuery({
    queryKey: keys.appConfig,
    queryFn: medicationsApi.fetchAppConfig,
    staleTime: 5 * 60 * 1000,
  });
}

export function useMedications(profileId: string) {
  return useQuery({
    queryKey: keys.medications(profileId),
    queryFn: () => medicationsApi.listMedications(profileId),
  });
}

function useInvalidateProfileData(profileId: string) {
  const queryClient = useQueryClient();
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: keys.medications(profileId) }),
      queryClient.invalidateQueries({ queryKey: keys.check(profileId) }),
      queryClient.invalidateQueries({ queryKey: keys.profiles }),
    ]);
  };
}

export function useCreateMedication(profileId: string) {
  const invalidate = useInvalidateProfileData(profileId);
  return useMutation({
    mutationFn: (input: { values: CreateMedicationInput; key: string }) =>
      medicationsApi.createMedication(profileId, input.values, input.key),
    onSuccess: invalidate,
  });
}

export function useUpdateMedication(profileId: string) {
  const invalidate = useInvalidateProfileData(profileId);
  return useMutation({
    mutationFn: (input: { medication: Medication; changes: UpdateMedicationRequest }) =>
      medicationsApi.updateMedication(
        profileId,
        input.medication.id,
        input.medication.version,
        input.changes,
      ),
    onSettled: invalidate,
  });
}

export function useDeleteMedication(profileId: string) {
  const invalidate = useInvalidateProfileData(profileId);
  return useMutation({
    mutationFn: (medicationId: string) => medicationsApi.deleteMedication(profileId, medicationId),
    onSuccess: invalidate,
  });
}

/** Debounces a value so name lookups do not fire on every keystroke. */
export function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebounced(value);
    }, delayMs);
    return () => {
      window.clearTimeout(timer);
    };
  }, [value, delayMs]);
  return debounced;
}

/** Looks a typed name up once the user pauses. Disabled for fewer than two characters. */
export function useNameMatches(term: string) {
  const debounced = useDebounced(term.trim(), 350);
  return useQuery({
    queryKey: keys.normalize(debounced),
    queryFn: ({ signal }) => medicationsApi.normalizeDrugName(debounced, signal),
    enabled: debounced.length >= 2,
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
}

/**
 * The profile's check result. Loads the latest stored check and runs a new one when there
 * is none or the medicine list changed since.
 */
export function useInteractionCheck(profileId: string) {
  return useQuery({
    queryKey: keys.check(profileId),
    queryFn: async () => {
      const latest = await medicationsApi.latestInteractionCheck(profileId);
      if (latest !== null && !latest.stale) {
        return latest;
      }
      return medicationsApi.runInteractionCheck(profileId);
    },
  });
}

export function useRunInteractionCheck(profileId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => medicationsApi.runInteractionCheck(profileId),
    onSuccess: (check) => {
      queryClient.setQueryData(keys.check(profileId), check);
    },
  });
}
