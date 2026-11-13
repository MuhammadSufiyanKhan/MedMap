import argon2 from 'argon2';

// OWASP-recommended argon2id parameters (19 MiB memory, 2 iterations, 1 lane).
const OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, OPTIONS);
}

/** Never throws: a malformed stored hash simply does not verify. */
export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

/**
 * A valid hash of a random value. Verifying against it when the email is unknown keeps
 * sign-in timing the same for existing and non-existing accounts.
 */
export const DUMMY_PASSWORD_HASH: Promise<string> = hashPassword(
  `dummy-${String(Math.random())}-${String(Date.now())}`,
);
