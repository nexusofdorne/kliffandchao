'use client';

import { useEffect, useRef } from 'react';
import { HorizontalTrack, type HorizontalTrackHandle } from '@/components/site/HorizontalTrack';
import { IntroPanel } from '@/components/site/intro/IntroPanel';
import { JourneyPanel } from '@/components/site/journey/JourneyPanel';
import { useTrackProgress } from '@/components/site/TrackProgressProvider';
import { WeddingPanel } from '@/components/site/wedding/WeddingPanel';
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
      wedding={<WeddingPanel />}
    />
  );
}
