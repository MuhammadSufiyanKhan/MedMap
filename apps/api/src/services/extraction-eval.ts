import type { ExtractedLabel } from '@medmap/shared';

export interface FieldScores {
  name: boolean;
  strength: boolean;
  form: boolean;
}

function normalise(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Compares what an extractor returned for one image with the expected reading.
 * A field is correct when it matches the first expected label after ignoring case,
 * punctuation and spacing. The form matches if either contains the other ("tablets" and
 * "tablet").
 */
export function scoreExtraction(expected: ExtractedLabel[], actual: ExtractedLabel[]): FieldScores {
  const want = expected[0];
  const got = actual[0];
  if (want === undefined) {
    return { name: actual.length === 0, strength: actual.length === 0, form: actual.length === 0 };
  }
  if (got === undefined) {
    return { name: false, strength: false, form: false };
  }
  const wantForm = normalise(want.form);
  const gotForm = normalise(got.form);
  return {
    name: normalise(want.name) === normalise(got.name),
    strength: normalise(want.strengthText) === normalise(got.strengthText),
    form:
      wantForm === gotForm ||
      (wantForm !== '' &&
        gotForm !== '' &&
        (gotForm.includes(wantForm) || wantForm.includes(gotForm))),
  };
}

/** Field-level accuracy in whole percent. */
export function summariseScores(scores: FieldScores[]): {
  count: number;
  name: number;
  strength: number;
  form: number;
} {
  const percent = (field: keyof FieldScores): number =>
    scores.length === 0
      ? 0
      : Math.round((scores.filter((score) => score[field]).length / scores.length) * 100);
  return {
    count: scores.length,
    name: percent('name'),
    strength: percent('strength'),
    form: percent('form'),
  };
}
