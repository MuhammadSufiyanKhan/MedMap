import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { ApiError, errorMessage, fieldName } from '../../domain/errors';

/**
 * Puts API field errors onto the matching form fields.
 * @returns a message for the form as a whole when no field could take the error.
 */
export function applyApiErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
): string | null {
  if (error instanceof ApiError && error.fieldErrors.length > 0) {
    let placed = false;
    for (const fieldError of error.fieldErrors) {
      const name = fieldName(fieldError.path);
      const match = fields.find((field) => field === name);
      if (match !== undefined) {
        setError(match, { type: 'server', message: fieldError.message });
        placed = true;
      }
    }
    if (placed) {
      return null;
    }
  }
  return errorMessage(error);
}
