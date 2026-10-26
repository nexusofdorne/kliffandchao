'use client';

import { useEffect, useLayoutEffect, type ReactNode } from 'react';
import { useTrackProgress } from '@/components/site/TrackProgressProvider';
import { useStoryLayout } from './useStoryLayout';

const SECTION_IDS = ['intro', 'journey', 'wedding'] as const;

// How long a guest must stop scrolling before the page settles on the nearer
// section, and how far off a section may be before it is worth correcting.
const SNAP_IDLE_MS = 160;
const SNAP_THRESHOLD_PX = 2;

// The story on phones (and anywhere reduced motion is on a narrow screen): the
// three sections stack as full-height panels under ordinary vertical scroll.
// Wide screens use the scene engine instead (components/site/scene).
//
// The top bar and nav capsule still need to know where the guest is, so this
// reports the section whose top has passed the viewport's midpoint, and
// commands plain scrolls when a nav button is pressed.
export function StackedStory({
  intro,
  journey,
  wedding,
}: {
  intro: ReactNode;
  journey: ReactNode;
  wedding: ReactNode;
}) {
  const layout = useStoryLayout();
  const { setUpdate, registerJump } = useTrackProgress();

  // Must run before anything measures: a restored scroll offset would start
  // the visit part-way down — docs/PLAN.md "Start every visit at the top."
  useLayoutEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    registerJump((section) => {
      document.getElementById(SECTION_IDS[section])?.scrollIntoView({
        behavior: layout === 'reduced' ? 'auto' : 'smooth',
      });
    });
  }, [registerJump, layout]);

  useEffect(() => {
    let snapTimeoutId: ReturnType<typeof setTimeout>;

    function reportActiveSection() {
      const viewportMid = window.innerHeight / 2;
      let section = 0;
      SECTION_IDS.forEach((id, index) => {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= viewportMid) section = index;
      });
      setUpdate({
        progress: section / (SECTION_IDS.length - 1),
        panel: section,
      });

      clearTimeout(snapTimeoutId);
      // Reduced-motion visitors get ordinary scrolling, without an idle
      // correction unexpectedly jumping them to another section.
      if (layout === 'mobile') {
        snapTimeoutId = setTimeout(snapToNearestSection, SNAP_IDLE_MS);
      }
    }

    // Without this a guest could let go mid-flick and be left parked halfway
    // between two full-height sections, half of each showing.
    function snapToNearestSection() {
      let nearest: HTMLElement | null = null;
      let nearestDistance = Infinity;
      for (const id of SECTION_IDS) {
        const el = document.getElementById(id);
        if (!el) return;
        const distance = Math.abs(el.getBoundingClientRect().top);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearest = el;
        }
      }
      if (nearest && nearestDistance > SNAP_THRESHOLD_PX) {
        window.scrollTo({
          top: window.scrollY + nearest.getBoundingClientRect().top,
          behavior: 'smooth',
        });
      }
    }

    reportActiveSection();
    window.addEventListener('scroll', reportActiveSection, { passive: true });
    return () => {
      clearTimeout(snapTimeoutId);
      window.removeEventListener('scroll', reportActiveSection);
    };
  }, [layout, setUpdate]);

  return (
    <div className="story-pin">
      <div className="story-track">
        {/* h-screen at every breakpoint: the panels stack as three full-height
            sections, they don't shrink to their content. */}
        <section id={SECTION_IDS[0]}>{intro}</section>
        <section id={SECTION_IDS[1]}>{journey}</section>
        <section id={SECTION_IDS[2]}>{wedding}</section>
      </div>
    </div>
  );
}
