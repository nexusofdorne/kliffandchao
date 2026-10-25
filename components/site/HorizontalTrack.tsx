'use client';

import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  type ReactNode,
} from 'react';
import { useStoryLayout } from './useStoryLayout';
import {
  STORY_MOBILE_QUERY,
  STORY_REDUCED_MOTION_QUERY,
} from '@/lib/track/layout';
import {
  computePanel,
  computeScrollBudget,
  computeSectionScrollTarget,
  computeSnapTarget,
  computeStoryScrollTarget,
  TRACK_SEGMENT_PERCENT,
} from '@/lib/track/progress';

gsap.registerPlugin(useGSAP, ScrollTrigger);

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
export const HorizontalTrack = forwardRef<
  HorizontalTrackHandle,
  HorizontalTrackProps
>(function HorizontalTrack(
  { storyCount, intro, journey, wedding, onUpdate },
  ref,
) {
  const pinRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const onUpdateRef = useRef(onUpdate);
  const scrollTriggerRef = useRef<ScrollTrigger | null>(null);
  const layout = useStoryLayout();

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

  // Reload after either layout preference changes so GSAP pin spacers and
  // the old scroll position cannot carry into the new layout. This extends
  // prototype/index.html's existing breakpoint-change reload behavior.
  useEffect(() => {
    const queries = [
      matchMedia(STORY_MOBILE_QUERY),
      matchMedia(STORY_REDUCED_MOTION_QUERY),
    ];
    const reload = () => location.reload();
    queries.forEach((query) => query.addEventListener('change', reload));
    return () =>
      queries.forEach((query) => query.removeEventListener('change', reload));
  }, []);

  // Mobile (and reduced-motion) never sets up the pinned ScrollTrigger below,
  // so `onUpdate` would otherwise never fire there and `panel` would stay
  // stuck at its initial 0 for the whole visit — which left TopBar's
  // light/dark nav color and the wedding/journey panels' parallax offset
  // frozen at the intro's values no matter how far the guest had actually
  // scrolled. The three sections just stack under native vertical scroll
  // here, so "panel" is simply whichever section's top has passed the
  // viewport's midpoint.
  useEffect(() => {
    if (layout === 'horizontal') return;

    // Without a pinned ScrollTrigger to snap for it (desktop's own `snap`
    // option above), a guest could let go mid-flick and be left parked
    // halfway between two full-height sections, half of each showing.
    // SNAP_IDLE_MS of no further scroll means they've stopped, not just
    // paused mid-flick — only then is it safe to assume where they landed
    // is where they meant to stop, and correct it to the nearer section.
    const SNAP_IDLE_MS = 160;
    const SNAP_THRESHOLD_PX = 2;
    let snapTimeoutId: ReturnType<typeof setTimeout>;

    function reportActiveSection() {
      const viewportMid = window.innerHeight / 2;
      let section = 0;
      SECTION_IDS.forEach((id, index) => {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= viewportMid)
          section = index;
      });
      onUpdateRef.current?.({
        progress: section / (SECTION_IDS.length - 1),
        panel: section,
      });

      clearTimeout(snapTimeoutId);
      // Reduced-motion visitors get ordinary scrolling, without an idle
      // correction unexpectedly jumping them to another section.
      if (layout === 'mobile')
        snapTimeoutId = setTimeout(snapToNearestSection, SNAP_IDLE_MS);
    }

    function snapToNearestSection() {
      const sections = SECTION_IDS.map((id) => document.getElementById(id));
      let nearest: HTMLElement | null = null;
      let nearestDistance = Infinity;
      for (const el of sections) {
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
  }, [layout]);

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

        if (layout !== 'horizontal') return;

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
        const existing = ScrollTrigger.getAll().find(
          (trigger) => trigger.trigger === pinRef.current,
        );
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
            gsap.set(trackRef.current, {
              xPercent: -TRACK_SEGMENT_PERCENT * panel,
            });
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
    { scope: pinRef, dependencies: [storyCount, layout], revertOnUpdate: true },
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
          document
            .getElementById(SECTION_IDS[section])
            ?.scrollIntoView({
              behavior: layout === 'reduced' ? 'auto' : 'smooth',
            });
          return;
        }
        const { p1, p2 } = computeScrollBudget(storyCount);
        const target = computeSectionScrollTarget(
          section,
          p1,
          p2,
          trigger.start,
          trigger.end,
        );
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
        const target = computeStoryScrollTarget(
          storyIndex,
          storyCount,
          p1,
          p2,
          trigger.start,
          trigger.end,
        );
        // Smooth, unlike jumpToSection: these are short hops within the
        // story stretch, not a long cross-panel jump that would scrub the
        // whole timeline on the way — prototype/index.html's journey jumpTo().
        window.scrollTo({ top: target, behavior: 'smooth' });
      },
    }),
    [storyCount, layout],
  );

  return (
    <div ref={pinRef} className="story-pin">
      <div ref={trackRef} className="story-track">
        {/* h-screen unconditionally, not just on desktop: prototype/index.html's
            #intro,#journey,#wedding{height:100vh} applies at every breakpoint
            — on mobile the panels stack as three full-height sections under
            plain vertical scroll, they don't shrink to their content. */}
        <section id={SECTION_IDS[0]}>{intro}</section>
        <section id={SECTION_IDS[1]}>{journey}</section>
        <section id={SECTION_IDS[2]}>{wedding}</section>
      </div>
    </div>
  );
});
