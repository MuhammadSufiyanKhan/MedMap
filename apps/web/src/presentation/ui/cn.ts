import { clsx } from 'clsx';
import type { ClassValue } from 'clsx';

/** Joins class names, skipping falsy values. */
export function cn(...values: ClassValue[]): string {
  return clsx(values);
}
