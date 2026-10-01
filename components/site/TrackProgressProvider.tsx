'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { computeActiveSection } from '@/lib/track/progress';
import type { HorizontalTrackUpdate } from '@/components/site/HorizontalTrack';

type Section = 0 | 1 | 2;

type TrackProgressContextValue = {
  progress: number;
  panel: number;
  activeSection: Section;
  setUpdate: (update: HorizontalTrackUpdate) => void;
  registerJump: (jump: (section: Section) => void) => void;
  jump: (section: Section) => void;
  registerJumpToStory: (jumpToStory: (storyIndex: number) => void) => void;
  jumpToStory: (storyIndex: number) => void;
};

const TrackProgressContext = createContext<TrackProgressContextValue | null>(null);

// Bridges HorizontalTrack (mounted deep inside story/page.tsx) with the
// persistent TopBar and JourneyPanel's coverflow (mounted once in the
// (gated) layout / passed in as the `journey` prop, above where the track
// itself lives — docs/BUILD_PLAN.md App source) — all three need the same
// live scroll position, in opposite directions: the track reports it here,
// its callers read it back and command jumps through the registered
// callbacks.
export function TrackProgressProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState(0);
  const [panel, setPanel] = useState(0);
  const jumpRef = useRef<(section: Section) => void>(() => {});
  const jumpToStoryRef = useRef<(storyIndex: number) => void>(() => {});

  const setUpdate = useCallback((update: HorizontalTrackUpdate) => {
    setProgress(update.progress);
    setPanel(update.panel);
  }, []);

  const registerJump = useCallback((jumpImpl: (section: Section) => void) => {
    jumpRef.current = jumpImpl;
  }, []);

  const jump = useCallback((section: Section) => {
    jumpRef.current(section);
  }, []);

  const registerJumpToStory = useCallback((jumpToStoryImpl: (storyIndex: number) => void) => {
    jumpToStoryRef.current = jumpToStoryImpl;
  }, []);

  const jumpToStory = useCallback((storyIndex: number) => {
    jumpToStoryRef.current(storyIndex);
  }, []);

  const value = useMemo<TrackProgressContextValue>(
    () => ({
      progress,
      panel,
      activeSection: computeActiveSection(panel),
      setUpdate,
      registerJump,
      jump,
      registerJumpToStory,
      jumpToStory,
    }),
    [progress, panel, setUpdate, registerJump, jump, registerJumpToStory, jumpToStory],
  );

  return <TrackProgressContext.Provider value={value}>{children}</TrackProgressContext.Provider>;
}

export function useTrackProgress(): TrackProgressContextValue {
  const context = useContext(TrackProgressContext);
  if (!context) throw new Error('useTrackProgress must be used within TrackProgressProvider');
  return context;
}
