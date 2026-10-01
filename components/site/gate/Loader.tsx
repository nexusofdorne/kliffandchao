'use client';

import { useEffect, useRef, useState } from 'react';
import {
  computeLoaderPercent,
  LOADER_BACKGROUND_TAB_GUARD_MS,
  LOADER_DURATION_MS,
  LOADER_REVEAL_DELAY_MS,
} from '@/lib/gate/loader';

type LoaderProps = {
  active: boolean;
  onComplete: () => void;
};

// The 0-100 counter shown after a correct password — docs/PLAN.md "The
// 0-100 loader". Rendered unconditionally (not unmounted when inactive) so
// its fade-in transition can run; `active` just toggles visibility.
export function Loader({ active, onComplete }: LoaderProps) {
  const [percent, setPercent] = useState(0);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (!active) return;

    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      // queueMicrotask, not a direct call: react-hooks/set-state-in-effect
      // flags setState called synchronously in the effect body itself:
      // deferring to a microtask (fires before the next paint either way)
      // satisfies that without changing the visible timing.
      queueMicrotask(() => setPercent(100));
      const timeout = setTimeout(() => onCompleteRef.current(), 320);
      return () => clearTimeout(timeout);
    }

    const start = performance.now();
    let finished = false;
    let frame: number;

    const finish = () => {
      if (finished) return;
      finished = true;
      setPercent(100);
      setTimeout(() => onCompleteRef.current(), LOADER_REVEAL_DELAY_MS);
    };

    const step = (now: number) => {
      if (finished) return;
      const elapsed = now - start;
      setPercent(computeLoaderPercent(elapsed, LOADER_DURATION_MS));
      if (elapsed < LOADER_DURATION_MS) frame = requestAnimationFrame(step);
      else finish();
    };
    frame = requestAnimationFrame(step);

    // rAF stops entirely in a backgrounded tab; without this guard, a guest
    // who switches apps mid-load comes back to a loader frozen at 0 forever.
    const backgroundGuard = setTimeout(finish, LOADER_BACKGROUND_TAB_GUARD_MS);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(backgroundGuard);
    };
  }, [active]);

  return (
    <div
      className={`absolute inset-0 z-[4] ${active ? 'flex' : 'hidden'} flex-col items-center justify-center gap-[3vh]`}
    >
      <div className="text-[clamp(46px,13vh,130px)] font-light leading-none tabular-nums tracking-[-.02em] [text-shadow:0_4px_24px_rgba(0,0,0,.45)]">
        {percent}
        <sup className="ml-[.15em] text-[.3em] font-medium opacity-75">%</sup>
      </div>
      <div className="h-[5px] w-[clamp(180px,22vw,340px)] overflow-hidden rounded-full border border-white/20 bg-white/[.16]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-white/70 to-white transition-[width] duration-[180ms] ease-linear"
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="text-[9.5px] tracking-[.18em] opacity-70">PREPARING OUR STORY</div>
    </div>
  );
}
