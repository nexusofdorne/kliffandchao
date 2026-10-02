'use client';

import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Link from 'next/link';
import type { MouseEvent } from 'react';
import { useTrackProgress } from '@/components/site/TrackProgressProvider';

// Separate from SectionNav's glass pill — two identical glass pills stacked
// read as one broken control (docs/PLAN.md "Persistent chrome"). Uses the
// `--glass-fill-hi` tint, not `.glass`'s own fill, so it isn't composed from
// that class — prototype/index.html's .rsvp-pill.
export function RsvpPill() {
  const { activeSection } = useTrackProgress();
  const isLight = activeSection === 2;

  // Desktop's /story has a pinned ScrollTrigger (HorizontalTrack) that
  // wraps its pinned element in a pin-spacer div outside React's fiber
  // tree. Navigating to /rsvp before that pin is killed raced React's own
  // unmount against GSAP's pin-spacer teardown — React would occasionally
  // try to remove a node from a parent GSAP had already detached it from,
  // crashing with "Failed to execute removeChild" and leaving /rsvp never
  // rendering. Mobile never hit this because it never creates the pin in
  // the first place. Killing every ScrollTrigger here, synchronously
  // before Next's own Link click handler runs (it calls this onClick
  // first), guarantees the pin is already gone by the time React starts
  // tearing down the page. Skipped for a modified click (new tab, etc.),
  // which doesn't navigate away from this tab at all.
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    const isModified = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
    if (isModified) return;
    ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
  }

  return (
    <Link
      href="/rsvp"
      onClick={handleClick}
      className={`block rounded-full px-[clamp(16px,2.4vh,30px)] py-[clamp(8px,1.15vh,13px)] text-[clamp(10px,1.35vh,14px)] font-semibold tracking-[.14em] text-white backdrop-blur-[20px] backdrop-saturate-150 transition-transform duration-300 ease-[cubic-bezier(.16,1,.3,1)] hover:-translate-y-px ${
        isLight
          ? 'border border-transparent bg-[var(--green)] shadow-[0_4px_16px_rgba(42,67,0,.22)] hover:bg-[#5d8d28]'
          : 'border border-[var(--glass-rim)] bg-[var(--glass-fill-hi)] shadow-[var(--glass-shadow)] hover:bg-white/30'
      }`}
    >
      RSVP
    </Link>
  );
}
