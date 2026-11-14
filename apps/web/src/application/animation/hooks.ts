import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { MOTION, MOTION_QUERIES } from '../../domain/motion';
import { gsap, registerGsap, ScrollTrigger, useGSAP } from './gsap';

/**
 * Animation hooks. Rules they all follow:
 * - Run only inside `gsap.matchMedia()` for `prefers-reduced-motion: no-preference`.
 *   With reduced motion nothing is hidden or moved: the final state shows at once.
 * - Hidden start states are set here, from JavaScript, never in CSS. If scripts fail the
 *   content is simply visible.
 * - Only transform and opacity are animated.
 * - `useGSAP` reverts everything on unmount, including ScrollTriggers.
 * - Never attach these to safety content (severity, warnings, notices).
 */

/** Fades and lifts the direct children marked `[data-reveal]` when the container scrolls into view. */
export function useRevealOnScroll<T extends HTMLElement>(): RefObject<T | null> {
  const scope = useRef<T>(null);
  registerGsap();
  useGSAP(
    () => {
      const media = gsap.matchMedia();
      media.add(MOTION_QUERIES.allowed, () => {
        const targets = gsap.utils.toArray<HTMLElement>('[data-reveal]', scope.current);
        if (targets.length === 0) {
          return;
        }
        gsap.from(targets, {
          opacity: 0,
          y: MOTION.distance.md,
          duration: MOTION.duration.base,
          ease: MOTION.ease.out,
          stagger: MOTION.stagger.base,
          scrollTrigger: { trigger: scope.current, start: 'top 82%', once: true },
        });
      });
    },
    { scope },
  );
  return scope;
}

/** Staggers in the children marked `[data-stagger]` once, on mount. */
export function useStaggerIn<T extends HTMLElement>(dependency?: unknown): RefObject<T | null> {
  const scope = useRef<T>(null);
  registerGsap();
  useGSAP(
    () => {
      const media = gsap.matchMedia();
      media.add(MOTION_QUERIES.allowed, () => {
        const targets = gsap.utils.toArray<HTMLElement>('[data-stagger]', scope.current);
        if (targets.length === 0) {
          return;
        }
        gsap.from(targets, {
          opacity: 0,
          y: MOTION.distance.sm,
          duration: MOTION.duration.fast * 1.5,
          ease: MOTION.ease.out,
          stagger: MOTION.stagger.tight,
          clearProps: 'opacity,transform',
        });
      });
    },
    { scope, dependencies: [dependency] },
  );
  return scope;
}

/**
 * Hero entrance: text first, then the map draws itself. Medicine labels (`[data-node]`)
 * appear before the lines (`[data-edge]`), which draw along their length.
 */
export function useHeroEntrance<T extends HTMLElement>(): RefObject<T | null> {
  const scope = useRef<T>(null);
  registerGsap();
  useGSAP(
    () => {
      const media = gsap.matchMedia();
      media.add(MOTION_QUERIES.allowed, () => {
        const timeline = gsap.timeline({ defaults: { ease: MOTION.ease.out } });
        timeline.from('[data-hero-text]', {
          opacity: 0,
          y: MOTION.distance.md,
          duration: MOTION.duration.base,
          stagger: MOTION.stagger.base,
        });
        timeline.from(
          '[data-node]',
          {
            opacity: 0,
            scale: 0.85,
            transformOrigin: '50% 50%',
            duration: MOTION.duration.base,
            stagger: MOTION.stagger.base,
          },
          '-=0.15',
        );
        timeline.from(
          '[data-edge]',
          { opacity: 0, duration: MOTION.duration.slow, stagger: MOTION.stagger.base },
          '-=0.1',
        );
        timeline.from(
          '[data-edge-label]',
          { opacity: 0, duration: MOTION.duration.fast, stagger: MOTION.stagger.tight },
          '-=0.3',
        );
      });
    },
    { scope },
  );
  return scope;
}

/**
 * Pinned "how it works" sequence. The section stays in place while the reader scrolls
 * through its steps; `activeStep` says which step to highlight. With reduced motion, or on
 * narrow screens, nothing is pinned and every step is shown in full (`pinned` is false).
 */
export function usePinnedSteps<T extends HTMLElement>(
  stepCount: number,
): { ref: RefObject<T | null>; activeStep: number; pinned: boolean } {
  const ref = useRef<T>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [pinned, setPinned] = useState(false);
  registerGsap();
  useGSAP(
    () => {
      const media = gsap.matchMedia();
      media.add(`${MOTION_QUERIES.allowed} and (min-width: 1024px)`, () => {
        setPinned(true);
        const trigger = ScrollTrigger.create({
          trigger: ref.current,
          start: 'top top',
          end: () => `+=${String(window.innerHeight * (stepCount - 1) * 0.7)}`,
          pin: true,
          scrub: true,
          onUpdate: (self) => {
            setActiveStep(Math.min(stepCount - 1, Math.floor(self.progress * stepCount)));
          },
        });
        return () => {
          trigger.kill();
          setPinned(false);
          setActiveStep(0);
        };
      });
    },
    { scope: ref, dependencies: [stepCount] },
  );
  return { ref, activeStep, pinned };
}

/**
 * Counts a number up to `value`. Returns the number to display. With reduced motion, or
 * for zero, it returns the final value immediately.
 */
export function useCountUp(value: number): number {
  const [display, setDisplay] = useState(value);
  registerGsap();
  useGSAP(
    () => {
      const media = gsap.matchMedia();
      media.add(MOTION_QUERIES.reduced, () => {
        setDisplay(value);
      });
      media.add(MOTION_QUERIES.allowed, () => {
        if (value === 0) {
          setDisplay(0);
          return;
        }
        const counter = { current: 0 };
        setDisplay(0);
        gsap.to(counter, {
          current: value,
          duration: MOTION.duration.count,
          ease: MOTION.ease.soft,
          onUpdate: () => {
            setDisplay(Math.round(counter.current));
          },
        });
      });
    },
    { dependencies: [value] },
  );
  return display;
}

/** Graph build-in: nodes (`[data-graph-node]`) first, then edges (`[data-graph-edge]`). */
export function useGraphBuildIn<T extends HTMLElement>(dependency: unknown): RefObject<T | null> {
  const scope = useRef<T>(null);
  registerGsap();
  useGSAP(
    () => {
      const media = gsap.matchMedia();
      media.add(MOTION_QUERIES.allowed, () => {
        const nodes = gsap.utils.toArray<HTMLElement>('[data-graph-node]', scope.current);
        const edges = gsap.utils.toArray<SVGElement>('[data-graph-edge]', scope.current);
        const timeline = gsap.timeline({ defaults: { ease: MOTION.ease.out } });
        if (nodes.length > 0) {
          timeline.from(nodes, {
            opacity: 0,
            duration: MOTION.duration.base,
            stagger: MOTION.stagger.tight,
            clearProps: 'opacity',
          });
        }
        if (edges.length > 0) {
          timeline.from(edges, {
            opacity: 0,
            duration: MOTION.duration.base,
            stagger: MOTION.stagger.tight,
            clearProps: 'opacity',
          });
        }
      });
    },
    { scope, dependencies: [dependency] },
  );
  return scope;
}

/** Subtle fade for the routed page. Refreshes ScrollTrigger so pins match the new layout. */
export function useRouteTransition<T extends HTMLElement>(routeKey: string): RefObject<T | null> {
  const scope = useRef<T>(null);
  registerGsap();
  useGSAP(
    () => {
      const media = gsap.matchMedia();
      media.add(MOTION_QUERIES.allowed, () => {
        gsap.from(scope.current, {
          opacity: 0,
          duration: MOTION.duration.fast,
          ease: MOTION.ease.soft,
          clearProps: 'opacity',
        });
      });
    },
    { scope, dependencies: [routeKey] },
  );
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      ScrollTrigger.refresh();
    });
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [routeKey]);
  return scope;
}
