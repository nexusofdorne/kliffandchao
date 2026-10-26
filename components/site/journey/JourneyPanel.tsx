'use client';

import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { useTrackProgress } from '@/components/site/TrackProgressProvider';
import { chapters, stories } from '@/content/chapters';
import { computeParallaxOffset } from '@/lib/track/progress';
import { ChapterStepper } from './ChapterStepper';
import { Coverflow, type CoverflowHandle } from './Coverflow';
import { siteConfig } from '@/config/site';

// Same reasoning as GateScreen: Ambience generates its randomized grass and
// motes via a lazy useState initializer, not an effect, so it must never
// be server-rendered — a plain static import crashes SSR on `window`.
const Ambience = dynamic(
  () => import('@/components/site/gate/Ambience').then((mod) => mod.Ambience),
  {
    ssr: false,
  },
);

const JOURNEY_LAYER_INDEX = 1;
// A fast scrub can outrun the fade, so the text swap waits for it rather
// than racing it — prototype/index.html's writeCopy().
const COPY_CROSSFADE_MS = 170;
const COPY_OPACITY = 0.84;

function firstStoryOfChapter(chapterIndex: number): number {
  return stories.findIndex((s) => s.chapterIndex === chapterIndex);
}

// The whole journey panel: ambient background, chapter stepper, coverflow
// — prototype/index.html's #journey. This is the phone journey: Coverflow
// reports its own native scroll position back up to pick the active story.
// Wide screens show components/site/scene/JourneyScene instead.
export function JourneyPanel() {
  const { panel } = useTrackProgress();
  const [activeStoryIndex, setActiveStoryIndex] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(0);
  const coverflowRef = useRef<CoverflowHandle>(null);

  useEffect(() => {
    const updateWidth = () => setViewportWidth(window.innerWidth);
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  const activeStory = stories[activeStoryIndex];

  const [displayedParagraph, setDisplayedParagraph] = useState(
    activeStory.paragraph,
  );
  useEffect(() => {
    if (displayedParagraph === activeStory.paragraph) return;
    const timeout = setTimeout(
      () => setDisplayedParagraph(activeStory.paragraph),
      COPY_CROSSFADE_MS,
    );
    return () => clearTimeout(timeout);
  }, [activeStory.paragraph, displayedParagraph]);
  const copyFaded = displayedParagraph !== activeStory.paragraph;

  const parallaxX = computeParallaxOffset(
    panel,
    JOURNEY_LAYER_INDEX,
    viewportWidth,
  );

  // The chapter dots drive Coverflow's native scroll-snap container directly.
  function handleJumpToStory(index: number) {
    coverflowRef.current?.scrollToStory(index);
  }

  return (
    <div className="relative h-full overflow-hidden bg-[#0d0f0a] text-white">
      <div className="absolute inset-0 overflow-hidden opacity-70 motion-safe:[animation:gate-drift_52s_ease-in-out_infinite_alternate] [transform-origin:48%_58%]">
        <Image
          src={siteConfig.backgrounds.journey}
          alt=""
          fill
          sizes="100vw"
          className="object-cover"
        />
      </div>
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,.35),rgba(0,0,0,.82))]" />

      {/* Same ambience as the gate, dialled back behind the timeline —
          z-index 0, not the gate's 2, so the coverflow and copy stay in
          front — docs/PLAN.md "Ambient motion". */}
      <Ambience
        zIndex={0}
        grassHeight="clamp(70px,13vh,150px)"
        bladeFill="rgba(10,20,3,.45)"
      />

      {/* Full-bleed layout box: GSAP's parallax writes `transform` here, so
          it must NOT also be centred with translateX(-50%) — that gets
          wiped and the content lands off the right edge. */}
      <div
        data-story-parallax
        className="journey-content absolute inset-0 z-[3] flex flex-col items-center justify-start text-center max-[768px]:justify-center"
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
          onActiveChange={setActiveStoryIndex}
        />

        <p
          className="mt-[2.6vh] max-w-[min(78vw,660px)] text-[clamp(9px,1.3vh,13px)] uppercase leading-[1.8] tracking-[.1em] transition-opacity duration-[.32s] ease-in-out max-[768px]:max-w-[84vw] max-[768px]:text-[clamp(9px,2.75vw,12px)]"
          style={{ opacity: copyFaded ? 0 : COPY_OPACITY }}
        >
          {displayedParagraph}
        </p>
      </div>

    </div>
  );
}
