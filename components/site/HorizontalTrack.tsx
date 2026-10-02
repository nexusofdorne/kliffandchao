'use client';

import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, type ReactNode } from 'react';
import {
  computePanel,
  computeScrollBudget,
  computeSectionScrollTarget,
  computeSnapTarget,
  computeStoryScrollTarget,
  TRACK_SEGMENT_PERCENT,
} from '@/lib/track/progress';

gsap.registerPlugin(useGSAP, ScrollTrigger);

const MOBILE_BREAKPOINT_QUERY = '(max-width: 768px)';
const SECTION_IDS = ['intro', 'journey', 'wedding'] as const;

export type HorizontalTrackUpdate = { progress: number; panel: number };
export type HorizontalTrackHandle = {
  jumpToSection: (section: 0 | 1 | 2) => void;
  jumpToStory: (storyIndex: number) => void;
};

type HorizontalTrackProps = {
  storyCount: number;
  intro: ReactNode;
  journey: ReactNode;
  wedding: ReactNode;
  onUpdate?: (update: HorizontalTrackUpdate) => void;
};

// Owns the pin/track mechanics only — xPercent on the track is intrinsic to
// what a horizontal track is. Everything "what does this progress mean"
// (active section, active story, nav indicator, per-layer parallax) is left
// to callers via onUpdate, using the same pure functions this re-exports
// from lib/track/progress, since those live where the panels themselves
// will (Steps 4-7), not here. The one exception is jumpToSection, exposed
// via ref: TopBar's nav buttons live outside this component (in the gated
// layout — docs/BUILD_PLAN.md App source) but still need to command it.
export const HorizontalTrack = forwardRef<HorizontalTrackHandle, HorizontalTrackProps>(function HorizontalTrack(
  { storyCount, intro, journey, wedding, onUpdate },
  ref,
) {
  const pinRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const onUpdateRef = useRef(onUpdate);
  const scrollTriggerRef = useRef<ScrollTrigger | null>(null);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  // Must run before ScrollTrigger measures anything: a restored scroll
  // offset would desync panel 0 (just unlocked the gate) from a stale
  // scrollY left over from a previous visit — docs/PLAN.md "Start every
  // visit at the top."
  useLayoutEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);
  }, []);

  // A live breakpoint cross would need every mobile-aware descendant (the
  // coverflow, its gesture handling) to re-derive its own isMobile state
  // mid-session. A full reload sidesteps that entirely — matching
  // prototype/index.html's own `MQ_MOBILE.addEventListener('change', ...)`.
  useEffect(() => {
    const query = matchMedia(MOBILE_BREAKPOINT_QUERY);
    const reload = () => location.reload();
    query.addEventListener('change', reload);
    return () => query.removeEventListener('change', reload);
  }, []);

  // useGSAP scopes a gsap.context() to pinRef and calls context.revert() on
  // cleanup instead of manually killing the trigger, which matters because
  // ScrollTrigger's pin wraps the pinned element in a spacer div — a DOM
  // mutation React's fiber tree doesn't know about.
  //
  // Setup is deferred until the viewport reports real dimensions, for two
  // separate reasons found while testing this:
  // 1. docs/PLAN.md's own warning: a hidden pane or some embedded webviews
  //    report 0x0 momentarily, and sizing the pin's `end` from that
  //    collapses the whole timeline to zero length — it never recovers
  //    even once the viewport becomes real, because `end` was already
  //    computed.
  // 2. Arriving at this route via router.push() (not a hard navigation)
  //    crashed with "node is not a child of this node" even with useGSAP
  //    and with React Strict Mode disabled (ruling both out) — Next's RSC
  //    client-navigation can commit this subtree in more than one pass,
  //    and waiting lets React finish before GSAP's pin-spacer surgery
  //    touches the DOM. A direct/hard load never hit either problem.
  //
  // The retry itself runs on setTimeout, not requestAnimationFrame: a
  // backgrounded or embedded-preview tab can suspend rAF indefinitely (the
  // same risk docs/PLAN.md already calls out for the 0-100 loader), and an
  // rAF that never fires once meant the pin was never created at all — the
  // track stayed squeezed into one overflow-hidden screen, unscrollable,
  // with nav clicks silently going nowhere. setTimeout still fires
  // (throttled, not frozen) even then.
  useGSAP(
    () => {
      if (!pinRef.current) return;

      let timeoutId: ReturnType<typeof setTimeout>;
      const trySetup = () => {
        if (!pinRef.current) return;
        if (window.innerWidth === 0 || window.innerHeight === 0) {
          timeoutId = setTimeout(trySetup, 50);
          return;
        }

        const isMobile = matchMedia(MOBILE_BREAKPOINT_QUERY).matches;
        const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (isMobile || reduced) return;

        // Belt and braces against a second ScrollTrigger ever stacking on
        // top of the first: Next's RSC client-navigation can commit this
        // subtree more than once (see above), and when it does, the first
        // commit's effect cleanup isn't guaranteed to run before the second
        // one's setup does — a React-instance-scoped ref guard wouldn't
        // catch that, since each commit gets its own ref. Checking by the
        // actual trigger DOM node catches it regardless of which commit
        // (or Strict Mode re-invoke, or HMR) is responsible. Adopting the
        // existing trigger, rather than killing and recreating, avoids
        // measuring the pin mid-revert — and whichever commit React keeps
        // still needs a live reference for jumpToSection/jumpToStory to
        // work, even if it wasn't the one that created it.
        const existing = ScrollTrigger.getAll().find((trigger) => trigger.trigger === pinRef.current);
        if (existing) {
          scrollTriggerRef.current = existing;
          return;
        }

        const { p1, p2, totalScreens } = computeScrollBudget(storyCount);

        scrollTriggerRef.current = ScrollTrigger.create({
          trigger: pinRef.current,
          start: 'top top',
          end: () => `+=${totalScreens * window.innerHeight}`,
          pin: true,
          scrub: 1,
          // Locks only the two slide phases; the story stretch between P1
          // and P2 stays free-scrolling, or every flick would yank to the
          // next story — docs/PLAN.md "Snap-lock and parallax".
          snap: {
            snapTo: (value: number) => computeSnapTarget(value, p1, p2),
            duration: { min: 0.15, max: 0.4 },
            delay: 0.05,
            ease: 'power2.out',
          },
          onUpdate: (self) => {
            const panel = computePanel(self.progress, p1, p2);
            // Pin #hpin, translate #htrack — pinning and transforming the
            // same element makes ScrollTrigger's pin and this transform
            // fight over it (docs/PLAN.md), hence the separate trackRef.
            gsap.set(trackRef.current, { xPercent: -TRACK_SEGMENT_PERCENT * panel });
            onUpdateRef.current?.({ progress: self.progress, panel });
          },
        });
      };

      // A 0ms timeout (not a frame) still lets React finish the commit
      // first, without betting on a frame actually arriving.
      timeoutId = setTimeout(trySetup, 0);
      return () => {
        clearTimeout(timeoutId);
        scrollTriggerRef.current = null;
      };
    },
    { scope: pinRef, dependencies: [storyCount] },
  );

  useImperativeHandle(
    ref,
    () => ({
      jumpToSection(section) {
        const trigger = scrollTriggerRef.current;
        // Mobile / reduced-motion: nothing is pinned, so there's no scroll
        // budget to jump within — fall back to a plain offset scroll,
        // matching prototype/index.html's `if(!hST) return scrollIntoView`.
        if (!trigger) {
          document.getElementById(SECTION_IDS[section])?.scrollIntoView({ behavior: 'smooth' });
          return;
        }
        const { p1, p2 } = computeScrollBudget(storyCount);
        const target = computeSectionScrollTarget(section, p1, p2, trigger.start, trigger.end);
        // Jump, don't smooth-scroll: smoothing from wedding back to intro
        // would scrub the whole timeline, replaying every story on the way.
        window.scrollTo({ top: target, behavior: 'auto' });
        ScrollTrigger.update();
      },
      jumpToStory(storyIndex) {
        const trigger = scrollTriggerRef.current;
        // Mobile has no pinned budget to jump within — Coverflow drives its
        // own native scroll-snap container instead of calling this at all.
        if (!trigger) return;
        const { p1, p2 } = computeScrollBudget(storyCount);
        const target = computeStoryScrollTarget(storyIndex, storyCount, p1, p2, trigger.start, trigger.end);
        // Smooth, unlike jumpToSection: these are short hops within the
        // story stretch, not a long cross-panel jump that would scrub the
        // whole timeline on the way — prototype/index.html's journey jumpTo().
        window.scrollTo({ top: target, behavior: 'smooth' });
      },
    }),
    [storyCount],
  );

  return (
    <div ref={pinRef} className="h-screen overflow-hidden max-[768px]:h-auto max-[768px]:overflow-visible">
      <div
        ref={trackRef}
        className="flex h-screen w-[300vw] will-change-transform max-[768px]:!transform-none max-[768px]:block max-[768px]:h-auto max-[768px]:w-auto"
      >
        {/* h-screen unconditionally, not just on desktop: prototype/index.html's
            #intro,#journey,#wedding{height:100vh} applies at every breakpoint
            — on mobile the panels stack as three full-height sections under
            plain vertical scroll, they don't shrink to their content. */}
        <section id={SECTION_IDS[0]} className="h-screen w-screen flex-none max-[768px]:w-auto">
          {intro}
        </section>
        <section id={SECTION_IDS[1]} className="h-screen w-screen flex-none max-[768px]:w-auto">
          {journey}
        </section>
        <section id={SECTION_IDS[2]} className="h-screen w-screen flex-none max-[768px]:w-auto">
          {wedding}
        </section>
      </div>
    </div>
  );
});
