'use client';

import { useEffect, useRef, useState } from 'react';
import { verses } from '@/content/verses';

const CROSSFADE_MS = 340;
const HINT_FADE_IN_DELAY_MS = 1400;
const HINT_FADE_OUT_DELAY_MS = 7000;
const HINT_OPACITY = 0.5;

// Bottom-right, right-aligned on desktop; centred and a size up on mobile —
// docs/PLAN.md "Placement". A real <button>, not a div, so it's keyboard-
// reachable; aria-live reads the new verse out on change.
// prototype/index.html's #verse / paintVerse().
export function VerseCycler() {
  const [index, setIndex] = useState(0);
  const [faded, setFaded] = useState(false);
  const [hintOpacity, setHintOpacity] = useState(0);
  const busyRef = useRef(false);

  // Self-dismissing affordance: the verse doesn't look tappable otherwise.
  // Cancelled early if the guest taps before either timer fires.
  useEffect(() => {
    const fadeIn = setTimeout(() => setHintOpacity(HINT_OPACITY), HINT_FADE_IN_DELAY_MS);
    const fadeOut = setTimeout(() => setHintOpacity(0), HINT_FADE_OUT_DELAY_MS);
    return () => {
      clearTimeout(fadeIn);
      clearTimeout(fadeOut);
    };
  }, []);

  function handleClick() {
    if (busyRef.current) return; // ignore mashing mid-fade
    busyRef.current = true;
    setFaded(true);
    setHintOpacity(0); // the affordance has done its job
    setTimeout(() => {
      setIndex((i) => (i + 1) % verses.length);
      setFaded(false);
      busyRef.current = false;
    }, CROSSFADE_MS);
  }

  const verse = verses[index];

  return (
    <div className="flex max-w-[min(48vw,540px)] flex-col items-end gap-[.9vh] max-[768px]:w-full max-[768px]:max-w-none max-[768px]:items-center">
      <button
        type="button"
        onClick={handleClick}
        aria-live="polite"
        title="Tap for another verse"
        className={`w-full cursor-pointer py-[.8vh] text-right text-[clamp(8.5px,1.22vh,13px)] font-semibold uppercase leading-[1.95] tracking-[.115em] text-white [text-shadow:0_2px_14px_rgba(0,0,0,.42)] transition-opacity duration-[340ms] ease-in-out hover:opacity-70 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-[6px] focus-visible:outline-white/55 max-[768px]:text-center max-[768px]:text-[clamp(11px,3.1vw,15px)] max-[768px]:leading-[2.05] max-[768px]:tracking-[.1em] ${
          faded ? 'opacity-0' : 'opacity-100'
        }`}
      >
        {verse.text}
        <span className="mt-[1.1vh] block text-[clamp(7.5px,1.02vh,11px)] tracking-[.14em] opacity-80 max-[768px]:text-[clamp(9px,2.5vw,12px)]">
          {verse.ref}
        </span>
      </button>
      <div
        aria-hidden="true"
        style={{ opacity: hintOpacity }}
        className="pointer-events-none text-right text-[8.5px] tracking-[.14em] text-white transition-opacity duration-[600ms] ease-in-out max-[768px]:text-center"
      >
        TAP THE VERSE FOR ANOTHER
      </div>
    </div>
  );
}
