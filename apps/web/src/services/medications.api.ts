import {
  appConfigSchema,
  interactionCheckSchema,
  medicationPageSchema,
  medicationSchema,
  normalizeResponseSchema,
} from '@medmap/shared';
import type {
  AppConfig,
  CreateMedicationInput,
  InteractionCheck,
  Medication,
  NormalizeResponse,
  Page,
  UpdateMedicationRequest,
} from '@medmap/shared';
import { ApiError } from '../domain/errors';
import { api } from './http';
import type { ApiResult } from './http';

export async function listMedications(profileId: string): Promise<Medication[]> {
  const items: Medication[] = [];
  let cursor: string | null = null;
  do {
    const page: ApiResult<Page<Medication>> = await api.request(
      `/profiles/${profileId}/medications`,
      { query: { limit: 100, cursor, sort: 'displayName' }, schema: medicationPageSchema },
    );
    items.push(...page.data.items);
    cursor = page.data.nextCursor;
  } while (cursor !== null);
  return items;
}

export async function createMedication(
  profileId: string,
  input: CreateMedicationInput,
  idempotencyKey: string,
): Promise<Medication> {
  return (
    await api.request(`/profiles/${profileId}/medications`, {
      method: 'POST',
      body: input,
      schema: medicationSchema,
      idempotencyKey,
    })
  ).data;
}

export async function updateMedication(
  profileId: string,
  medicationId: string,
  version: number,
  changes: UpdateMedicationRequest,
): Promise<Medication> {
  return (
    await api.request(`/profiles/${profileId}/medications/${medicationId}`, {
      method: 'PATCH',
      body: changes,
      schema: medicationSchema,
      ifMatch: version,
    })
  ).data;
}

export async function deleteMedication(profileId: string, medicationId: string): Promise<void> {
  await api.request(`/profiles/${profileId}/medications/${medicationId}`, { method: 'DELETE' });
}

export async function normalizeDrugName(
  term: string,
  signal?: AbortSignal,
): Promise<NormalizeResponse> {
  const options = { query: { term }, schema: normalizeResponseSchema };
  return (
    await api.request('/drugs/normalize', signal === undefined ? options : { ...options, signal })
  ).data;
}

export async function runInteractionCheck(profileId: string): Promise<InteractionCheck> {
  return (
    await api.request(`/profiles/${profileId}/interaction-checks`, {
      method: 'POST',
      schema: interactionCheckSchema,
    })
  ).data;
}

/** The latest stored check, or null when the profile has never been checked. */
export async function latestInteractionCheck(profileId: string): Promise<InteractionCheck | null> {
  try {
    return (
      await api.request(`/profiles/${profileId}/interaction-checks/latest`, {
        schema: interactionCheckSchema,
      })
    ).data;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404 && error.message.includes('No check')) {
      return null;
    }
    throw error;
  }
}

export async function fetchAppConfig(): Promise<AppConfig> {
  return (await api.request('/app-config', { schema: appConfigSchema, auth: false })).data;
}
