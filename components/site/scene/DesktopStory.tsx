'use client';

import gsap from 'gsap';
import { useEffect, useRef } from 'react';
import { useTrackProgress } from '@/components/site/TrackProgressProvider';
import { IntroScene, type IntroHandle } from './IntroScene';
import {
  JourneyScaffold,
  SceneRoot,
  WeddingScaffold,
} from './ScenePlayground';
import { SceneProvider, useScene } from './SceneProvider';
import { Terminal, type TerminalHandle } from './Terminal';
import { isAbort } from './timing';

// The redesigned desktop story. `arrival` is true when the guest has just come
// through the gate's dive (docs/REDESIGN_PLAN.md decision 11): the terminal
// plays, then the intro surfaces from its screen. Any other way in (a returning
// cookie, a reload, "back to home" from RSVP) gets a short intro entrance.
export function DesktopStory({ arrival }: { arrival: boolean }) {
  return (
    <SceneProvider>
      <Story arrival={arrival} />
    </SceneProvider>
  );
}

function Story({ arrival }: { arrival: boolean }) {
  const { setInputLocked } = useScene();
  const { setChromeVisible } = useTrackProgress();
  const intro = useRef<IntroHandle>(null);
  const terminal = useRef<TerminalHandle>(null);
  const introRoot = useRef<HTMLElement>(null);
  const arrivalRoot = useRef<HTMLElement>(null);

  useEffect(() => {
    const ctl = new AbortController();
    const { signal } = ctl;
    const introEl = intro.current;
    const term = terminal.current;
    if (!introEl || !term || !introRoot.current || !arrivalRoot.current) return;
    const parts = introEl.parts();

    setInputLocked(true);
    setChromeVisible(false);

    const play = async () => {
      if (arrival) {
        await term.run(introEl.videoReady(), signal);
        // hand over: the bezel of 03 takes the place of 02's, scaled to sit on it,
        // so the grass slides in underneath it while the terminal tears apart
        gsap.set(introRoot.current, { autoAlpha: 1, zIndex: 6 });
        gsap.set(parts.black, { opacity: 0 });
        const settle = { duration: 1.7, ease: 'power2.inOut' } as const;
        gsap.fromTo(parts.stage, { scale: 0.948 }, { scale: 1, ...settle });
        gsap.fromTo(term.stage(), { scale: 1 }, { scale: 1.055, ...settle });
        const chrome = setTimeout(() => setChromeVisible(true), 3200);
        signal.addEventListener('abort', () => clearTimeout(chrome));
        await Promise.all([
          term.breakUp(signal),
          introEl.surface({ order: ['bottom', 'right', 'left', 'top'] }),
        ]);
        gsap.set(parts.black, { clearProps: 'opacity' });
        gsap.set(arrivalRoot.current, { display: 'none' });
      } else {
        gsap.set(arrivalRoot.current, { display: 'none' });
        gsap.set(introRoot.current, { autoAlpha: 1 });
        setTimeout(() => setChromeVisible(true), 1600);
        await introEl.surface({ fast: true });
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
      <SceneRoot id="journey" z={2}>
        <JourneyScaffold />
      </SceneRoot>
      <SceneRoot id="wedding" z={1}>
        <WeddingScaffold />
      </SceneRoot>
      <SceneRoot id="intro" rootRef={introRoot} z={3}>
        <IntroScene ref={intro} startHidden />
      </SceneRoot>
      <SceneRoot id="arrival" rootRef={arrivalRoot} visible z={5}>
        <Terminal ref={terminal} />
      </SceneRoot>
    </>
  );
}
