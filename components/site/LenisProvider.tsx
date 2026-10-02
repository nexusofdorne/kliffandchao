'use client';

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { useEffect, type ReactNode } from 'react';

gsap.registerPlugin(ScrollTrigger);

// Lenis drives the scroll; ScrollTrigger must hear about every frame of it,
// not just the browser's native scroll events, or the two fall out of
// sync. Driving both off the same gsap.ticker (rather than Lenis's own
// rAF loop) is Lenis's documented way of keeping them pixel-perfect
// together.
export function LenisProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    // Lenis hijacks every wheel/touch event globally by default, which also
    // blocks native scrolling inside the app's own overflow-y containers
    // (the wedding tab panels — e.g. a long FAQ list past the fold).
    // allowNestedScroll detects those and lets them scroll natively instead
    // of being swallowed by Lenis's document-level smoothing.
    const lenis = new Lenis({ allowNestedScroll: true });
    const onTick = (time: number) => lenis.raf(time * 1000);

    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(onTick);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(onTick);
      lenis.destroy();
    };
  }, []);

  return children;
}
