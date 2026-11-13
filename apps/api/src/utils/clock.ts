/** Source of the current time. Injected so tests can control it. */
export type Clock = () => Date;

export const systemClock: Clock = () => new Date();

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

export function addDays(date: Date, days: number): Date {
  return addMinutes(date, days * 24 * 60);
}
