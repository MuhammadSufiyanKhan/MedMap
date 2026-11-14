import { useMutation } from '@tanstack/react-query';
import * as extractionApi from '../../services/extraction.api';

/** Reads label photos. The result is a list of candidates; nothing is saved. */
export function useExtractLabels(profileId: string) {
  return useMutation({
    mutationFn: (files: File[]) => extractionApi.extractLabels(profileId, files),
  });
}
