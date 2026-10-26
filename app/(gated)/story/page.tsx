'use client';

import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { IntroPanel } from '@/components/site/intro/IntroPanel';
import { JourneyPanel } from '@/components/site/journey/JourneyPanel';
import { DesktopStory } from '@/components/site/scene/DesktopStory';
import { StackedStory } from '@/components/site/StackedStory';
import { useStoryLayout } from '@/components/site/useStoryLayout';
import { WeddingPanel } from '@/components/site/wedding/WeddingPanel';
import { sceneAssets } from '@/config/scene-layers.generated';
import { ARRIVAL_PARAM, isGateArrival } from '@/lib/scene/arrival';
import {
  STORY_MOBILE_QUERY,
  STORY_REDUCED_MOTION_QUERY,
} from '@/lib/track/layout';

const noopSubscribe = () => () => {};

// Wide screens get the scene engine (docs/REDESIGN_PLAN.md); phones keep the
// stacked story.
export default function StoryPage() {
  const params = useSearchParams();
  // read once: the flag is stripped from the URL below, and a re-render must
  // not replay the arrival
  const [arrival] = useState(() => isGateArrival(params.get(ARRIVAL_PARAM)));
  const hydrated = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  const layout = useStoryLayout();

  useEffect(() => {
    if (!new URLSearchParams(location.search).has(ARRIVAL_PARAM)) return;
    const url = new URL(location.href);
    url.searchParams.delete(ARRIVAL_PARAM);
    history.replaceState(history.state, '', url);
  }, []);

  // Reload when the screen crosses the phone breakpoint or the reduced-motion
  // preference changes, so no scene or scroll state carries into the other
  // layout. (The old pinned track did the same.)
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
    <StackedStory
      intro={<IntroPanel />}
      journey={<JourneyPanel />}
      wedding={<WeddingPanel />}
    />
  );
}
