'use client';

import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { useTrackProgress } from '@/components/site/TrackProgressProvider';
import { chapters, stories } from '@/content/chapters';
import { computeActiveStoryIndex, computeParallaxOffset, computeScrollBudget } from '@/lib/track/progress';
import { ChapterArrows } from './ChapterArrows';
import { ChapterStepper } from './ChapterStepper';
import { Coverflow, type CoverflowHandle } from './Coverflow';

// Same reasoning as GateScreen: Ambience generates its randomized grass and
// motes via a lazy useState initializer, not an effect, so it must never
// be server-rendered — a plain static import crashes SSR on `window`.
const Ambience = dynamic(() => import('@/components/site/gate/Ambience').then((mod) => mod.Ambience), {
  ssr: false,
});

const JOURNEY_LAYER_INDEX = 1;
const MOBILE_BREAKPOINT_PX = 768;
// A fast scrub can outrun the fade, so the text swap waits for it rather
// than racing it — prototype/index.html's writeCopy().
const COPY_CROSSFADE_MS = 170;
const COPY_OPACITY = 0.84;

function getInitialIsMobile(): boolean {
  return typeof window !== 'undefined' && window.innerWidth > 0 && window.innerWidth < MOBILE_BREAKPOINT_PX;
}

function firstStoryOfChapter(chapterIndex: number): number {
  return stories.findIndex((s) => s.chapterIndex === chapterIndex);
}

// The whole journey panel: ambient background, chapter stepper, coverflow
// and prev/next arrows — prototype/index.html's #journey. Desktop's active
// story comes from the pinned track's live scroll progress (the same one
// HorizontalTrack reports for the top bar); mobile has no pinned track, so
// Coverflow reports its own native scroll position back up instead.
export function JourneyPanel() {
  const { progress, panel, jumpToStory } = useTrackProgress();
  const [isMobile] = useState(getInitialIsMobile);
  const [mobileActiveIndex, setMobileActiveIndex] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(0);
  const coverflowRef = useRef<CoverflowHandle>(null);

  useEffect(() => {
    const updateWidth = () => setViewportWidth(window.innerWidth);
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  const { p1, p2 } = computeScrollBudget(stories.length);
  const desktopActiveIndex = computeActiveStoryIndex(progress, p1, p2, stories.length);
  const activeStoryIndex = isMobile ? mobileActiveIndex : desktopActiveIndex;
  const activeStory = stories[activeStoryIndex];

  const [displayedParagraph, setDisplayedParagraph] = useState(activeStory.paragraph);
  useEffect(() => {
    if (displayedParagraph === activeStory.paragraph) return;
    const timeout = setTimeout(() => setDisplayedParagraph(activeStory.paragraph), COPY_CROSSFADE_MS);
    return () => clearTimeout(timeout);
  }, [activeStory.paragraph, displayedParagraph]);
  const copyFaded = displayedParagraph !== activeStory.paragraph;

  const parallaxX = computeParallaxOffset(panel, JOURNEY_LAYER_INDEX, viewportWidth);

  // Mobile has no registered jumpToStory on the pinned track (there isn't
  // one), so the chapter dots and prev/next arrows drive Coverflow's own
  // native scroll-snap container directly instead.
  function handleJumpToStory(index: number) {
    if (isMobile) coverflowRef.current?.scrollToStory(index);
    else jumpToStory(index);
  }

  function handlePrevChapter() {
    const ci = activeStory.chapterIndex;
    handleJumpToStory(firstStoryOfChapter(activeStory.storyIndexInChapter > 0 ? ci : Math.max(0, ci - 1)));
  }

  function handleNextChapter() {
    const ci = activeStory.chapterIndex;
    handleJumpToStory(ci >= chapters.length - 1 ? stories.length - 1 : firstStoryOfChapter(ci + 1));
  }

  return (
    <div className="relative h-full overflow-hidden bg-[#0d0f0a]">
      <div className="absolute inset-0 overflow-hidden opacity-70 motion-safe:[animation:gate-drift_52s_ease-in-out_infinite_alternate] [transform-origin:48%_58%]">
        <Image src="/img/p1_Im0.jpg" alt="" fill sizes="100vw" className="object-cover" />
      </div>
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,.35),rgba(0,0,0,.82))]" />

      {/* Same ambience as the gate, dialled back behind the timeline —
          z-index 0, not the gate's 2, so the coverflow and copy stay in
          front — docs/PLAN.md "Ambient motion". */}
      <Ambience zIndex={0} grassHeight="clamp(70px,13vh,150px)" bladeFill="rgba(10,20,3,.45)" />

      {/* Full-bleed layout box: GSAP's parallax writes `transform` here, so
          it must NOT also be centred with translateX(-50%) — that gets
          wiped and the content lands off the right edge. */}
      <div
        className="journey-content absolute inset-0 z-[3] flex flex-col items-center justify-center text-center"
        style={{ transform: `translateX(${parallaxX}px)` }}
      >
        <ChapterStepper
          chapters={chapters}
          activeChapterIndex={activeStory.chapterIndex}
          onSelectChapter={(ci) => handleJumpToStory(firstStoryOfChapter(ci))}
        />

        <Coverflow
          ref={coverflowRef}
          stories={stories}
          activeIndex={activeStoryIndex}
          onSelectStory={jumpToStory}
          onMobileActiveChange={setMobileActiveIndex}
        />

        <p
          className="mt-[2.6vh] max-w-[min(78vw,660px)] text-[clamp(9px,1.3vh,13px)] uppercase leading-[1.8] tracking-[.1em] transition-opacity duration-[.32s] ease-in-out max-[768px]:max-w-[84vw] max-[768px]:text-[clamp(9px,2.75vw,12px)]"
          style={{ opacity: copyFaded ? 0 : COPY_OPACITY }}
        >
          {displayedParagraph}
        </p>
      </div>

      <ChapterArrows onPrev={handlePrevChapter} onNext={handleNextChapter} />
    </div>
  );
}
