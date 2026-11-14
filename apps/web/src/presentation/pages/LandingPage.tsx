import { Camera, ListChecks, Share2 } from 'lucide-react';
import { SAFETY_TEMPLATES, SEVERITIES, SEVERITY_LABELS } from '@medmap/shared';
import {
  useHeroEntrance,
  usePinnedSteps,
  useRevealOnScroll,
} from '../../application/animation/hooks';
import { HeroMap } from '../features/HeroMap';
import { LineSample, SeverityIcon } from '../features/severity';
import { cn } from '../ui/cn';
import { ButtonLink } from '../ui/Page';

const STEPS = [
  {
    icon: Camera,
    title: 'Add the medicines',
    body: 'Type each name, or take a photo of the label. Include vitamins, supplements and herbs.',
  },
  {
    icon: ListChecks,
    title: 'Check what was read',
    body: 'MedMap shows you what it read from each label. You fix anything that is wrong before it is saved.',
  },
  {
    icon: Share2,
    title: 'See the map',
    body: 'A ranked list comes first, then a map. Lines join the pairs a named source has flagged. Bring the list to your pharmacist.',
  },
] as const;

function HowItWorks() {
  const { ref, activeStep, pinned } = usePinnedSteps<HTMLElement>(STEPS.length);
  return (
    <section
      ref={ref}
      aria-labelledby="how-heading"
      className="border-y border-border bg-surface-raised px-5 py-14 lg:flex lg:min-h-dvh lg:items-center"
    >
      <div className="mx-auto w-full max-w-page">
        <h2 id="how-heading" className="max-w-prose text-3xl font-bold md:text-4xl">
          Three steps, about five minutes
        </h2>
        <ol className="mt-8 grid gap-4 lg:grid-cols-3">
          {STEPS.map((step, index) => (
            <li
              key={step.title}
              // While pinned, the step being read is emphasised. Without pinning (small
              // screens, reduced motion) every step shows at full strength.
              className={cn(
                'flex flex-col gap-3 rounded-lg border-2 p-5 transition-opacity duration-300',
                !pinned || index === activeStep
                  ? 'border-primary bg-primary-soft opacity-100'
                  : 'border-border bg-surface-raised opacity-60',
              )}
            >
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-full bg-primary text-lg font-bold text-on-primary">
                  {index + 1}
                </span>
                <step.icon aria-hidden="true" className="size-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold">{step.title}</h3>
              <p>{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export default function LandingPage() {
  const hero = useHeroEntrance<HTMLDivElement>();
  const legend = useRevealOnScroll<HTMLDivElement>();
  const limits = useRevealOnScroll<HTMLDivElement>();
  return (
    <>
      <section className="px-5 py-10 md:py-16">
        <div
          ref={hero}
          className="mx-auto grid max-w-page items-center gap-10 lg:grid-cols-[1fr_1.05fr]"
        >
          <div className="flex flex-col gap-5">
            <h1 data-hero-text className="text-3xl font-bold md:text-4xl xl:text-5xl">
              Which of Mum&rsquo;s medicines should you ask the pharmacist about?
            </h1>
            <p data-hero-text className="max-w-prose text-lg text-text-muted">
              MedMap takes a list of medicines, supplements and vitamins and shows the combinations
              that a named source has flagged. You get a short list to bring to the pharmacy.
            </p>
            <div data-hero-text className="flex flex-wrap gap-3">
              <ButtonLink to="/register" size="lg">
                Create a free account
              </ButtonLink>
              <ButtonLink to="/login" size="lg" variant="secondary">
                Sign in
              </ButtonLink>
            </div>
            {/* Safety text is outside the animated set: it is visible from the first frame. */}
            <p className="max-w-prose text-sm text-text-muted">{SAFETY_TEMPLATES.notAdvice}</p>
          </div>
          <HeroMap />
        </div>
      </section>

      <HowItWorks />

      <section className="px-5 py-14" aria-labelledby="read-heading">
        <div ref={legend} className="mx-auto flex max-w-page flex-col gap-6">
          <h2 id="read-heading" data-reveal className="max-w-prose text-3xl font-bold md:text-4xl">
            Lines you can read without relying on colour
          </h2>
          <ul className="grid gap-4 md:grid-cols-3">
            {SEVERITIES.map((severity) => (
              <li
                key={severity}
                data-reveal
                className="flex flex-col gap-3 rounded-lg border border-border bg-surface-raised p-5"
              >
                <LineSample severity={severity} />
                <p
                  className={`flex items-center gap-2 text-xl font-bold text-severity-${severity}`}
                >
                  <SeverityIcon severity={severity} className="size-5" />
                  {SEVERITY_LABELS[severity]}
                </p>
                <p className="text-text-muted">
                  {severity === 'serious' && 'A thick solid line with a warning triangle.'}
                  {severity === 'moderate' && 'A dashed line with a diamond.'}
                  {severity === 'minor' && 'A thin dotted line with a circle.'}
                </p>
              </li>
            ))}
          </ul>
          <p data-reveal className="max-w-prose text-text-muted">
            Every line also has its name written on it. A large-text mode and a high-contrast theme
            are in the settings.
          </p>
        </div>
      </section>

      <section
        className="border-t border-border bg-surface-raised px-5 py-14"
        aria-labelledby="limits-heading"
      >
        <div ref={limits} className="mx-auto flex max-w-page flex-col gap-5">
          <h2 id="limits-heading" className="max-w-prose text-3xl font-bold md:text-4xl">
            What MedMap does not do
          </h2>
          {/* Limits are safety content: shown at once, never animated. */}
          <ul className="flex max-w-prose list-disc flex-col gap-3 pl-5 text-lg">
            <li>
              It never says a combination has no risks. If nothing is flagged, it says only that the
              source lists no interaction.
            </li>
            <li>It never tells you to stop, change, skip or delay a medicine.</li>
            <li>{SAFETY_TEMPLATES.supplementCoverage}</li>
            <li>
              Medicines it could not identify are shown as &ldquo;could not check&rdquo;, not
              hidden.
            </li>
            <li>{SAFETY_TEMPLATES.urgent}</li>
          </ul>
          <div>
            <ButtonLink to="/register" size="lg">
              Start a medicine list
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
