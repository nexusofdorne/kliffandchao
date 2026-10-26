'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import { chapters, type FlatStory } from '@/content/chapters';
import { StoryCard } from './StoryCard';
import { useStoryLayout } from '@/components/site/useStoryLayout';

const EAGER_LOAD_COUNT = 3;

// The gap between card centres on the native scroll-snap rail. Not the same
// as a card's own offsetLeft: the rail's side padding already centres card
// 0 at scrollLeft 0 (scroll-snap-align: center), so a card's *index* times
// this stride is its correct scroll position — prototype/index.html's
// mobile stride()/slideTo().
function measureStride(container: HTMLElement): number {
  const first = container.children[0] as HTMLElement | undefined;
  const second = container.children[1] as HTMLElement | undefined;
  return (
    (second && first
      ? second.offsetLeft - first.offsetLeft
      : first?.offsetWidth) || 1
  );
}

export type CoverflowHandle = { scrollToStory: (index: number) => void };

type CoverflowProps = {
  stories: FlatStory[];
  activeIndex: number;
  // Reports the card the native scroll-snap container has settled on.
  onActiveChange: (index: number) => void;
};

// The phone journey (docs/PLAN.md "Mobile journey is its own design"): the
// story photocards on a native scroll-snap rail. Wide screens show the
// journey as a glass window instead (components/site/scene/JourneyScene).
export const Coverflow = forwardRef<CoverflowHandle, CoverflowProps>(
  function Coverflow({ stories, activeIndex, onActiveChange }, ref) {
    const layout = useStoryLayout();
    const containerRef = useRef<HTMLDivElement>(null);

    const scrollToStory = useCallback(
      (index: number) => {
        const container = containerRef.current;
        if (!container) return;
        container.scrollTo({
          left: index * measureStride(container),
          behavior: layout === 'reduced' ? 'auto' : 'smooth',
        });
      },
      [layout],
    );

    useImperativeHandle(ref, () => ({ scrollToStory }), [scrollToStory]);

    // No rAF throttling: an rAF-gated "ticking" flag never resets if rAF is
    // throttled (a backgrounded tab), jamming the handler permanently —
    // docs/PLAN.md's own warning. Reading scrollLeft directly in the listener
    // and early-returning on an unchanged index keeps DOM writes to once per
    // settled card instead.
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;
      let lastIndex = -1;
      function handleScroll() {
        if (!container || !container.clientWidth) return;
        const stride = measureStride(container);
        const index = Math.min(
          stories.length - 1,
          Math.max(0, Math.round(container.scrollLeft / stride)),
        );
        if (index === lastIndex) return;
        lastIndex = index;
        onActiveChange(index);
      }
      container.addEventListener('scroll', handleScroll, { passive: true });
      return () => container.removeEventListener('scroll', handleScroll);
    }, [stories.length, onActiveChange]);

    return (
      <div ref={containerRef} className="coverflow-rail">
        {stories.map((story, index) => (
          <StoryCard
            key={`${story.chapterIndex}-${story.storyIndexInChapter}`}
            story={story}
            chapter={chapters[story.chapterIndex]}
            isActive={index === activeIndex}
            priority={index < EAGER_LOAD_COUNT}
            // Tapping a side card brings it to the centre.
            onSelect={() => {
              if (index !== activeIndex) scrollToStory(index);
            }}
          />
        ))}
      </div>
    );
  },
);
