'use client';

import { useEffect, useRef } from 'react';
import { HorizontalTrack, type HorizontalTrackHandle } from '@/components/site/HorizontalTrack';
import { IntroPanel } from '@/components/site/intro/IntroPanel';
import { JourneyPanel } from '@/components/site/journey/JourneyPanel';
import { useTrackProgress } from '@/components/site/TrackProgressProvider';
import { stories } from '@/content/chapters';

export default function StoryPage() {
  const trackRef = useRef<HorizontalTrackHandle>(null);
  const { setUpdate, registerJump, registerJumpToStory } = useTrackProgress();

  useEffect(() => {
    registerJump((section) => trackRef.current?.jumpToSection(section));
    registerJumpToStory((storyIndex) => trackRef.current?.jumpToStory(storyIndex));
  }, [registerJump, registerJumpToStory]);

  return (
    <HorizontalTrack
      ref={trackRef}
      storyCount={stories.length}
      onUpdate={setUpdate}
      intro={<IntroPanel />}
      journey={<JourneyPanel />}
      wedding={
        <div className="flex h-full flex-col items-center justify-center gap-2 bg-[#f4ede6] text-center">
          <p className="text-xs uppercase tracking-[.14em] text-black/50">Wedding — Phase 4 step 6</p>
        </div>
      }
    />
  );
}
