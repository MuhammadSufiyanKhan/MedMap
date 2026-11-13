import { SAFETY_TEMPLATES } from '@medmap/shared';
import { Button } from '../presentation/ui/Button';

/** Placeholder shell for M0. Routing and real pages arrive with the UI milestone. */
export function App() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-page flex-col justify-center gap-6 px-5 py-12">
      <h1 className="max-w-prose text-3xl font-bold md:text-4xl">
        MedMap is being built. A map of your medicines is on its way.
      </h1>
      <p className="max-w-prose text-lg text-text-muted">{SAFETY_TEMPLATES.notAdvice}</p>
      <div>
        <Button disabled>Coming soon</Button>
      </div>
    </main>
  );
}
