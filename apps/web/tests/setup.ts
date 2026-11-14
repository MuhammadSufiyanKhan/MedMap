import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});

// jsdom has no matchMedia. Reporting "no match" for every query means animation hooks
// take neither the motion nor the reduced-motion branch and simply render final values.
if (typeof window.matchMedia !== 'function') {
  const noop = (): void => undefined;
  window.matchMedia = (query: string): MediaQueryList =>
    // Only the members GSAP reads are provided; the cast covers deprecated ones we omit.
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: noop,
      removeEventListener: noop,
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}
