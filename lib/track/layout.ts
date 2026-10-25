export const STORY_MOBILE_QUERY = '(max-width: 768px)';
export const STORY_REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

export type StoryLayout = 'horizontal' | 'mobile' | 'reduced';

// A wide screen can still require native section/rail scrolling. Keeping
// this decision shared prevents the track and carousel choosing differently.
export function resolveStoryLayout(
  isMobile: boolean,
  reducedMotion: boolean,
): StoryLayout {
  if (reducedMotion) return 'reduced';
  return isMobile ? 'mobile' : 'horizontal';
}
