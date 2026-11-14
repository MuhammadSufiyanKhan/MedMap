import { labelExtractionResponseSchema } from '@medmap/shared';
import type { LabelExtractionResponse } from '@medmap/shared';
import { api } from './http';

/** Sends label photos to be read. Nothing is saved by this call. */
export async function extractLabels(
  profileId: string,
  files: File[],
): Promise<LabelExtractionResponse> {
  const formData = new FormData();
  for (const file of files) {
    formData.append('images', file, file.name);
  }
  return (
    await api.request(`/profiles/${profileId}/label-extractions`, {
      method: 'POST',
      formData,
      schema: labelExtractionResponseSchema,
    })
  ).data;
}
