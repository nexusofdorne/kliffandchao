'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { HorizontalTrack, type HorizontalTrackHandle } from '@/components/site/HorizontalTrack';
import { IntroPanel } from '@/components/site/intro/IntroPanel';
import { JourneyPanel } from '@/components/site/journey/JourneyPanel';
import { ScenePlayground } from '@/components/site/scene/ScenePlayground';
import { useTrackProgress } from '@/components/site/TrackProgressProvider';
import { useStoryLayout } from '@/components/site/useStoryLayout';
import { WeddingPanel } from '@/components/site/wedding/WeddingPanel';
import { stories } from '@/content/chapters';

// The redesigned desktop scenes are built behind /story?scenes=1 (docs/
// REDESIGN_PLAN.md); until they replace the track, everyone else gets it as is.
export default function StoryPage() {
  const scenesRequested = useSearchParams().get('scenes') === '1';
  const layout = useStoryLayout(scenesRequested);
  return layout === 'scenes' ? <ScenePlayground /> : <TrackStory />;
}

function TrackStory() {
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
