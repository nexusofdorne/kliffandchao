'use client';

import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { HorizontalTrack, type HorizontalTrackHandle } from '@/components/site/HorizontalTrack';
import { IntroPanel } from '@/components/site/intro/IntroPanel';
import { JourneyPanel } from '@/components/site/journey/JourneyPanel';
import { DesktopStory } from '@/components/site/scene/DesktopStory';
import { useTrackProgress } from '@/components/site/TrackProgressProvider';
import { useStoryLayout } from '@/components/site/useStoryLayout';
import { WeddingPanel } from '@/components/site/wedding/WeddingPanel';
import { sceneAssets } from '@/config/scene-layers.generated';
import { stories } from '@/content/chapters';
import { ARRIVAL_PARAM, isGateArrival } from '@/lib/scene/arrival';

const noopSubscribe = () => () => {};

// Wide screens get the redesigned scenes (docs/REDESIGN_PLAN.md); phones keep
// the stacked story. `?scenes=0` falls back to the old pinned track while the
// redesign is being finished.
export default function StoryPage() {
  const params = useSearchParams();
  const scenes = params.get('scenes') !== '0';
  // read once: the flag is stripped from the URL below, and a re-render must
  // not replay the arrival
  const [arrival] = useState(() => isGateArrival(params.get(ARRIVAL_PARAM)));
  const hydrated = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  const layout = useStoryLayout(scenes);

  useEffect(() => {
    if (!new URLSearchParams(location.search).has(ARRIVAL_PARAM)) return;
    const url = new URL(location.href);
    url.searchParams.delete(ARRIVAL_PARAM);
    history.replaceState(history.state, '', url);
  }, []);

  // Until the client knows the screen size, show the gate's last frame (the
  // terminal's black screen on wide screens, plain black on phones), so the
  // cut from the gate never flashes the wrong layout.
  if (!hydrated) {
    return (
      <div className="fixed inset-0 bg-black">
        <Image
          src={sceneAssets.s02_bg.src}
          alt=""
          fill
          unoptimized
          priority
          className="object-cover max-[768px]:hidden"
        />
      </div>
    );
  }
  return layout === 'scenes' ? (
    <DesktopStory arrival={arrival} />
  ) : (
    <TrackStory />
  );
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
