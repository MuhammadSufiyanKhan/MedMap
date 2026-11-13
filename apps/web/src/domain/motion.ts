/**
 * Every duration, easing and distance used by animation hooks. Presentation components
 * never hard-code these. Safety content (severity, warnings, disclaimers) is never animated.
 */
export const MOTION = {
  duration: { fast: 0.2, base: 0.45, slow: 0.8, count: 0.9 },
  ease: { out: 'power2.out', inOut: 'power2.inOut', soft: 'power1.out' },
  distance: { sm: 12, md: 24, lg: 48 },
  stagger: { tight: 0.05, base: 0.09 },
} as const;

/** Media queries used with gsap.matchMedia(). */
export const MOTION_QUERIES = {
  allowed: '(prefers-reduced-motion: no-preference)',
  reduced: '(prefers-reduced-motion: reduce)',
} as const;
