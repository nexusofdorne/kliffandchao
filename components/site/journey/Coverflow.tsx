'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { chapters, type FlatStory } from '@/content/chapters';
import { computeCardTransform, computeStepTarget } from '@/lib/track/coverflow';
import { StoryCard } from './StoryCard';
import { useCoverflowGestures } from './useCoverflowGestures';

const MOBILE_BREAKPOINT_PX = 768;
const EAGER_LOAD_COUNT = 3;

function getInitialIsMobile(): boolean {
  return typeof window !== 'undefined' && window.innerWidth > 0 && window.innerWidth < MOBILE_BREAKPOINT_PX;
}

// The gap between card centres on the native scroll-snap rail. Not the same
// as a card's own offsetLeft: the rail's side padding already centres card
// 0 at scrollLeft 0 (scroll-snap-align: center), so a card's *index* times
// this stride is its correct scroll position — prototype/index.html's
// mobile stride()/slideTo().
function measureMobileStride(container: HTMLElement): number {
  const first = container.children[0] as HTMLElement | undefined;
  const second = container.children[1] as HTMLElement | undefined;
  return (second && first ? second.offsetLeft - first.offsetLeft : first?.offsetWidth) || 1;
}

export type CoverflowHandle = { scrollToStory: (index: number) => void };

type CoverflowProps = {
  stories: FlatStory[];
  activeIndex: number;
  // Desktop-only: a card click, a drag/wheel step. Commands HorizontalTrack's
  // pinned scroll (via JourneyPanel → TrackProgressProvider's jumpToStory) —
  // mobile handles its own native scroll-snap locally instead.
  onSelectStory: (index: number) => void;
  // Mobile-only: reports the card the native scroll-snap container has
  // settled on, since there's no pinned ScrollTrigger to derive it from.
  onMobileActiveChange: (index: number) => void;
};

// prototype/index.html's #flow / .cf — desktop positions every card with a
// measured-width transform (lib/track/coverflow.ts); mobile hands the same
// cards to native scroll-snap (docs/PLAN.md "Mobile journey is its own
// design"), so this component owns two self-contained interaction modes
// rather than one driven by a prop.
export const Coverflow = forwardRef<CoverflowHandle, CoverflowProps>(function Coverflow(
  { stories, activeIndex, onSelectStory, onMobileActiveChange },
  ref,
) {
  const [isMobile] = useState(getInitialIsMobile);
  const [cardWidth, setCardWidth] = useState(0);
  const firstCardRef = useRef<HTMLDivElement>(null);
  const { containerRef, justSwipedRef } = useCoverflowGestures(!isMobile, (direction) => {
    onSelectStory(computeStepTarget(activeIndex, direction, stories.length));
  });

  // The stride tracks the card's clamp()-sized real width, so it never
  // drifts from the CSS the moment the viewport crosses a clamp boundary.
  useEffect(() => {
    if (isMobile) return;
    function measure() {
      if (firstCardRef.current) setCardWidth(firstCardRef.current.offsetWidth);
    }
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [isMobile]);

  const scrollToStory = useCallback(
    (index: number) => {
      const container = containerRef.current;
      if (!container) return;
      container.scrollTo({ left: index * measureMobileStride(container), behavior: 'smooth' });
    },
    [containerRef],
  );

  useImperativeHandle(ref, () => ({ scrollToStory }), [scrollToStory]);

  // No rAF throttling: an rAF-gated "ticking" flag never resets if rAF is
  // throttled (a backgrounded tab), jamming the handler permanently —
  // docs/PLAN.md's own warning. Reading scrollLeft directly in the listener
  // and early-returning on an unchanged index keeps DOM writes to once per
  // settled card instead.
  useEffect(() => {
    if (!isMobile) return;
    const container = containerRef.current;
    if (!container) return;
    let lastIndex = -1;
    function handleScroll() {
      if (!container || !container.clientWidth) return;
      const stride = measureMobileStride(container);
      const index = Math.min(stories.length - 1, Math.max(0, Math.round(container.scrollLeft / stride)));
      if (index === lastIndex) return;
      lastIndex = index;
      onMobileActiveChange(index);
    }
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [isMobile, stories.length, containerRef, onMobileActiveChange]);

  function handleSelect(index: number) {
    // A drag ends in a click event too; ignore that one.
    if (justSwipedRef.current) {
      justSwipedRef.current = false;
      return;
    }
    if (isMobile) {
      // Tapping a side card brings it to the centre rather than doing nothing.
      if (index !== activeIndex) scrollToStory(index);
      return;
    }
    onSelectStory(index);
  }

  return (
    <div ref={containerRef} className="coverflow-rail">
      {stories.map((story, index) => (
        <StoryCard
          key={`${story.chapterIndex}-${story.storyIndexInChapter}`}
          ref={index === 0 ? firstCardRef : undefined}
          story={story}
          chapter={chapters[story.chapterIndex]}
          isActive={index === activeIndex}
          transform={isMobile ? null : computeCardTransform(index - activeIndex, cardWidth || 360)}
          priority={index < EAGER_LOAD_COUNT}
          onSelect={() => handleSelect(index)}
        />
      ))}
    </div>
  );
});
