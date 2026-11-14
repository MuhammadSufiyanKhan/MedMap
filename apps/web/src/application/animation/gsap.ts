import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

let registered = false;

/** Registers GSAP plugins. Called once from the app bootstrap of animated routes. */
export function registerGsap(): void {
  if (!registered) {
    gsap.registerPlugin(useGSAP, ScrollTrigger);
    registered = true;
  }
}

export { gsap, ScrollTrigger, useGSAP };
