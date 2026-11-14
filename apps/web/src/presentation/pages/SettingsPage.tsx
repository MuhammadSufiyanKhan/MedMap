import { useState } from 'react';
import { resendVerification, useSession } from '../../application/session';
import { usePreferences } from '../../application/stores/preferences';
import { useToasts } from '../../application/stores/toasts';
import { errorMessage } from '../../domain/errors';
import { TEXT_SIZES, THEME_LABELS, THEMES } from '../../domain/preferences';
import type { TextSize, Theme } from '../../domain/preferences';
import { AccountData } from '../features/AccountData';
import { Button } from '../ui/Button';
import { Badge, Card } from '../ui/Card';
import { Select } from '../ui/Field';
import { PageHeader } from '../ui/Page';

export default function SettingsPage() {
  const { user } = useSession();
  const theme = usePreferences((state) => state.theme);
  const textSize = usePreferences((state) => state.textSize);
  const update = usePreferences((state) => state.update);
  const show = useToasts((state) => state.show);
  const [sending, setSending] = useState(false);

  return (
    <>
      <PageHeader title="Settings" />
      <div className="flex max-w-2xl flex-col gap-5">
        <Card className="flex flex-col gap-4">
          <h2 className="text-xl font-bold">Display</h2>
          <Select
            label="Theme"
            value={theme}
            onChange={(event) => {
              update({ theme: event.target.value as Theme });
            }}
            options={THEMES.map((value) => ({ value, label: THEME_LABELS[value] }))}
          />
          <Select
            label="Text size"
            value={textSize}
            onChange={(event) => {
              update({ textSize: event.target.value as TextSize });
            }}
            options={TEXT_SIZES.map((value) => ({
              value,
              label: value === 'large' ? 'Large' : 'Standard',
            }))}
          />
        </Card>

        <Card className="flex flex-col gap-3">
          <h2 className="text-xl font-bold">Account</h2>
          <p className="flex flex-wrap items-center gap-2">
            <span>{user?.email}</span>
            {user?.emailVerified === true ? (
              <Badge tone="primary">Email confirmed</Badge>
            ) : (
              <Badge tone="neutral">Email not confirmed yet</Badge>
            )}
          </p>
          {user?.emailVerified === false && (
            <div>
              <Button
                variant="secondary"
                loading={sending}
                onClick={() => {
                  setSending(true);
                  resendVerification()
                    .then((message) => {
                      show(message);
                    })
                    .catch((error: unknown) => {
                      show(errorMessage(error), 'error');
                    })
                    .finally(() => {
                      setSending(false);
                    });
                }}
              >
                Send the confirmation email again
              </Button>
            </div>
          )}
        </Card>

        <AccountData />
      </div>
    </>
  );
}
