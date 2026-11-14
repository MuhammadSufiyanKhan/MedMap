import { Card } from '../ui/Card';

/** Export and delete controls. Wired up with the account endpoints in milestone M6. */
export function AccountData() {
  return (
    <Card className="flex flex-col gap-2">
      <h2 className="text-xl font-bold">Your data</h2>
      <p className="text-text-muted">
        MedMap keeps your account, your profiles and their medicine lists. Label photos are never
        stored.
      </p>
    </Card>
  );
}
