'use client';

import { useSyncExternalStore } from 'react';
import {
  resolveStoryLayout,
  STORY_MOBILE_QUERY,
  STORY_REDUCED_MOTION_QUERY,
  type StoryLayout,
} from '@/lib/track/layout';

function subscribe(onChange: () => void) {
  const queries = [
    matchMedia(STORY_MOBILE_QUERY),
    matchMedia(STORY_REDUCED_MOTION_QUERY),
  ];
  queries.forEach((query) => query.addEventListener('change', onChange));
  return () =>
    queries.forEach((query) => query.removeEventListener('change', onChange));
}

function snapshot(): StoryLayout {
  return resolveStoryLayout(
    matchMedia(STORY_MOBILE_QUERY).matches,
    matchMedia(STORY_REDUCED_MOTION_QUERY).matches,
  );
}

// The first client render matches SSR; React then applies the actual media
// preferences without a hydration mismatch.
function serverSnapshot(): StoryLayout {
  return 'scenes';
}

export function useStoryLayout(): StoryLayout {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}
