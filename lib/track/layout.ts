export const STORY_MOBILE_QUERY = '(max-width: 768px)';
export const STORY_REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

// 'scenes' is the desktop story (components/site/scene): triggered scenes, with
// reduced motion handled inside the engine as crossfades. Phones stack the
// three sections under native scroll; with reduced motion on a phone the same
// stack just stops animating its scroll.
export type StoryLayout = 'scenes' | 'mobile' | 'reduced';

// The phone design lives at /m/ (public/m, published from prototype-mobile/). Phones without
// reduced motion are sent there from the gate and the story.
export const PHONE_STORY_PATH = '/m/index.html';

export function phoneStoryUrl(params: Record<string, string> = {}): string {
  const query = new URLSearchParams(params).toString();
  return query ? `${PHONE_STORY_PATH}?${query}` : PHONE_STORY_PATH;
}

export function resolveStoryLayout(
  isMobile: boolean,
  reducedMotion: boolean,
): StoryLayout {
  if (!isMobile) return 'scenes';
  return reducedMotion ? 'reduced' : 'mobile';
}
