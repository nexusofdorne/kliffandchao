'use client';

import gsap from 'gsap';
import { useEffect, useRef, useState } from 'react';
import { useAudio } from '@/components/site/AudioProvider';
import { useTrackProgress } from '@/components/site/TrackProgressProvider';
import { IntroScene, type IntroHandle } from './IntroScene';
import { JourneyScene, type JourneyHandle } from './JourneyScene';
import { LightVeil } from './LightVeil';
import { SceneRoot } from './SceneRoot';
import { WeddingScene, type WeddingHandle } from './WeddingScene';
import { WorldScene, type WorldHandle } from './WorldScene';
import { SceneProvider, useScene } from './SceneProvider';
import { Terminal, type TerminalHandle } from './Terminal';
import { createTransitions } from './transitions';
import { isAbort } from './timing';

// The redesigned desktop story. `arrival` is true when the guest has just come
// through the gate's dive (docs/REDESIGN_PLAN.md decision 11): the terminal
// plays, tears apart, and the intro film tunes in on the same monitor. Any other
// way in (a returning cookie, a reload, "back to home" from RSVP) gets a short
// tune-in.
// What fills the screen above and below the stage on tall screens (.scene-ambient): the
// colours of the paintings' top and bottom edges, so the picture seems to carry on.
const AMBIENT = {
  monitor: { top: '#c2ae8f', bottom: '#e0d2bd' }, // the monitor's bezel
  world: { top: '#a3bbcd', bottom: '#4a5139' }, // sky above, the meadow's grass below
};

export function DesktopStory({ arrival }: { arrival: boolean }) {
  return (
    <SceneProvider>
      <Story arrival={arrival} />
    </SceneProvider>
  );
}

function Story({ arrival }: { arrival: boolean }) {
  const { setInputLocked, registerPlayer } = useScene();
  const { setChromeVisible, setChromeLight } = useTrackProgress();
  const { beginMusic } = useAudio();
  const intro = useRef<IntroHandle>(null);
  const journey = useRef<JourneyHandle>(null);
  const journeyRoot = useRef<HTMLElement>(null);
  const wedding = useRef<WeddingHandle>(null);
  const weddingRoot = useRef<HTMLElement>(null);
  const world = useRef<WorldHandle>(null);
  const veil = useRef<HTMLDivElement>(null);
  const terminal = useRef<TerminalHandle>(null);
  const introRoot = useRef<HTMLElement>(null);
  const arrivalRoot = useRef<HTMLElement>(null);
  // the splash can be skipped every time it plays: Skip aborts just the terminal's part
  const skipSplash = useRef<AbortController | null>(null);
  const [splashShowing, setSplashShowing] = useState(arrival);

  // the redesigned scenes keep the white chrome on every scene
  useEffect(() => {
    setChromeLight(false);
    return () => setChromeLight(null);
  }, [setChromeLight]);

  useEffect(() => {
    const players = createTransitions({
      intro,
      journey,
      wedding,
      world,
      veil,
      introRoot,
      journeyRoot,
      weddingRoot,
    });
    const offs = Object.entries(players).map(([kind, player]) =>
      registerPlayer(kind as keyof typeof players, player),
    );
    return () => offs.forEach((off) => off());
  }, [registerPlayer]);

  useEffect(() => {
    const ctl = new AbortController();
    const { signal } = ctl;
    const introEl = intro.current;
    const term = terminal.current;
    if (!introEl || !term || !introRoot.current || !arrivalRoot.current) return;

    setInputLocked(true);
    setChromeVisible(false);

    const play = async () => {
      if (arrival) {
        const skip = new AbortController();
        skipSplash.current = skip;
        signal.addEventListener('abort', () => skip.abort());
        try {
          await term.run(introEl.videoReady(), skip.signal);
          await term.breakUp(skip.signal);
        } catch (error) {
          // skipped: straight on to the intro (anything else, or leaving the page, stops here)
          if (!isAbort(error) || signal.aborted) throw error;
        }
        setSplashShowing(false);
        // the intro's monitor is the terminal's own picture and its screen starts in
        // the colour the break-up ends on, so swapping them shows no seam
        gsap.set(introRoot.current, { autoAlpha: 1, zIndex: 6 });
        gsap.set(arrivalRoot.current, { display: 'none' });
        beginMusic(); // the song comes in with the intro, not before
        const chrome = setTimeout(() => setChromeVisible(true), 1500);
        signal.addEventListener('abort', () => clearTimeout(chrome));
        await introEl.powerOn();
      } else {
        gsap.set(arrivalRoot.current, { display: 'none' });
        gsap.set(introRoot.current, { autoAlpha: 1 });
        beginMusic();
        setTimeout(() => setChromeVisible(true), 1600);
        await introEl.powerOn({ fast: true });
      }
    };

    play()
      .then(() => {
        if (signal.aborted) return;
        setChromeVisible(true);
        setInputLocked(false);
      })
      .catch((error) => {
        if (!isAbort(error)) throw error;
      });

    return () => ctl.abort();
    // runs once per mount; the callbacks are stable context setters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <SceneRoot id="world" visible z={0} ambient={AMBIENT.world}>
        <WorldScene ref={world} />
      </SceneRoot>
      <SceneRoot id="journey" rootRef={journeyRoot} z={2} clear>
        <JourneyScene ref={journey} />
      </SceneRoot>
      <SceneRoot id="wedding" rootRef={weddingRoot} z={1} clear>
        <WeddingScene ref={wedding} />
      </SceneRoot>
      <SceneRoot id="intro" rootRef={introRoot} z={3} ambient={AMBIENT.monitor}>
        <IntroScene ref={intro} startHidden />
      </SceneRoot>
      <SceneRoot
        id="arrival"
        rootRef={arrivalRoot}
        visible
        z={5}
        ambient={AMBIENT.monitor}
      >
        <Terminal ref={terminal} />
      </SceneRoot>
      <LightVeil ref={veil} />
      {splashShowing ? (
        <button
          type="button"
          onClick={() => {
            skipSplash.current?.abort();
            setSplashShowing(false);
          }}
          className="splash-skip"
        >
          SKIP
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>
      ) : null}
    </>
  );
}
