'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { computeActiveSection } from '@/lib/track/progress';

type Section = 0 | 1 | 2;

type TrackProgressContextValue = {
  progress: number;
  panel: number;
  activeSection: Section;
  // The top bar and audio button tint for the wedding panel's cream
  // background by default; the desktop scenes override it (the river is
  // dark enough for white controls) and hide the chrome while a transition
  // needs the whole screen.
  isLight: boolean;
  setChromeLight: (light: boolean | null) => void;
  chromeVisible: boolean;
  setChromeVisible: (visible: boolean) => void;
  setUpdate: (update: { progress: number; panel: number }) => void;
  registerJump: (jump: (section: Section) => void) => void;
  jump: (section: Section) => void;
};

const TrackProgressContext = createContext<TrackProgressContextValue | null>(null);

// Bridges the story's scroll engine (the desktop scenes, or the phone's
// stacked sections) with the
// persistent TopBar and JourneyPanel's coverflow (mounted once in the
// (gated) layout / passed in as the `journey` prop, above where the track
// itself lives — docs/BUILD_PLAN.md App source) — all three need the same
// live scroll position, in opposite directions: the track reports it here,
// its callers read it back and command jumps through the registered
// callbacks.
export function TrackProgressProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState(0);
  const [panel, setPanel] = useState(0);
  const [chromeLight, setChromeLight] = useState<boolean | null>(null);
  const [chromeVisible, setChromeVisible] = useState(true);
  const jumpRef = useRef<(section: Section) => void>(() => {});

  const setUpdate = useCallback((update: { progress: number; panel: number }) => {
    setProgress(update.progress);
    setPanel(update.panel);
  }, []);

  const registerJump = useCallback((jumpImpl: (section: Section) => void) => {
    jumpRef.current = jumpImpl;
  }, []);

  const jump = useCallback((section: Section) => {
    jumpRef.current(section);
  }, []);

  const value = useMemo<TrackProgressContextValue>(
    () => ({
      progress,
      panel,
      activeSection: computeActiveSection(panel),
      isLight: chromeLight ?? computeActiveSection(panel) === 2,
      setChromeLight,
      chromeVisible,
      setChromeVisible,
      setUpdate,
      registerJump,
      jump,
    }),
    [progress, panel, chromeLight, chromeVisible, setUpdate, registerJump, jump],
  );

  return <TrackProgressContext.Provider value={value}>{children}</TrackProgressContext.Provider>;
}

export function useTrackProgress(): TrackProgressContextValue {
  const context = useContext(TrackProgressContext);
  if (!context) throw new Error('useTrackProgress must be used within TrackProgressProvider');
  return context;
}
