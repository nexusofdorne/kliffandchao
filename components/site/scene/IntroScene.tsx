'use client';

import gsap from 'gsap';
import { useImperativeHandle, useRef, type Ref } from 'react';
import { VerseCycler } from '@/components/site/intro/VerseCycler';
import { sceneAssets as a } from '@/config/scene-layers.generated';
import { siteConfig } from '@/config/site';
import { Stage, StageFill, boxStyle } from './Stage';
import { calmMotion, playToEnd } from './timing';

// Screen 03: the intro film plays on the login monitor's own screen. The
// monitor is the same picture as the terminal's (02 - splash login 1), so the
// terminal's last frame hands over to this one without a seam; then the film
// tunes in. Nothing else frames it: no grass, flowers or bubbles. The nav,
// wordmark, RSVP and music button are the real chrome on top; the verse is the
// real VerseCycler.

export type IntroHandle = {
  /** The film tunes in on the monitor's screen, then the verse comes up. */
  powerOn: (opts?: { fast?: boolean }) => Promise<void>;
  /** Resolves once the film has enough buffered to play through. */
  videoReady: () => Promise<void>;
  /** Everything visible and at rest (returning from another scene). */
  rest: () => void;
  /** The film plays only while the scene is on screen. */
  setPlaying: (playing: boolean) => void;
  parts: () => {
    stage: HTMLElement | null;
    screen: HTMLElement | null;
    film: HTMLElement | null;
    ui: HTMLElement | null;
  };
};

const ORIGIN = { transformOrigin: '50% 46%' };

export function IntroScene({
  ref,
  startHidden,
}: {
  ref?: Ref<IntroHandle>;
  /** Render with the film and verse invisible (a power-on will play). */
  startHidden: boolean;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const filmRef = useRef<HTMLVideoElement>(null);
  const uiRef = useRef<HTMLDivElement>(null);
  const hide = startHidden ? { opacity: 0 } : undefined;

  function videoReady(): Promise<void> {
    const video = filmRef.current;
    if (!video || video.readyState >= 3) return Promise.resolve();
    return new Promise((resolve) => {
      video.addEventListener('canplaythrough', () => resolve(), { once: true });
      video.addEventListener('error', () => resolve(), { once: true });
    });
  }

  async function powerOn({ fast = false }: { fast?: boolean } = {}) {
    const k = fast ? 0.5 : 1;
    const tl = gsap.timeline();
    if (calmMotion()) {
      tl.to([filmRef.current, uiRef.current], { opacity: 1, duration: 0.4 }, 0);
    } else {
      // tuning in: bright and soft, then the picture settles
      tl.fromTo(
        filmRef.current,
        { opacity: 0, filter: 'brightness(2.2) contrast(0.7) blur(10px)', scaleY: 1.03 },
        {
          opacity: 1,
          filter: 'brightness(1) contrast(1) blur(0px)',
          scaleY: 1,
          duration: 1.5 * k,
          ease: 'power2.out',
          clearProps: 'filter,transform',
        },
        0,
      );
      tl.fromTo(uiRef.current, { opacity: 0 }, { opacity: 1, duration: 0.8 * k }, 1.4 * k);
    }
    // the film starts as it appears
    tl.call(() => void filmRef.current?.play().catch(() => {}), [], 0);
    await playToEnd(tl, 600);
  }

  function rest() {
    gsap.set([filmRef.current, uiRef.current, stageRef.current], {
      clearProps: 'transform,opacity,filter,visibility',
    });
    void filmRef.current?.play().catch(() => {});
  }

  useImperativeHandle(ref, () => ({
    powerOn,
    videoReady,
    rest,
    setPlaying: (playing) => {
      const video = filmRef.current;
      if (!video) return;
      if (playing) void video.play().catch(() => {});
      else video.pause();
    },
    parts: () => ({
      stage: stageRef.current,
      screen: screenRef.current,
      film: filmRef.current,
      ui: uiRef.current,
    }),
  }));

  return (
    <Stage>
      <div ref={stageRef} className="absolute inset-0" style={ORIGIN}>
        <StageFill asset={a.s02_bg} priority />
        <div
          ref={screenRef}
          className="intro-screen"
          style={boxStyle(a.s02_screen)}
        >
          <video
            ref={filmRef}
            src={siteConfig.backgrounds.introVideo}
            poster={siteConfig.backgrounds.introPoster}
            muted
            loop
            playsInline
            preload="auto"
            aria-hidden="true"
            tabIndex={-1}
            className="absolute inset-0 h-full w-full object-cover"
            style={hide}
          />
          <div aria-hidden="true" className="intro-screen__shade" />
        </div>
        <div
          ref={uiRef}
          className="absolute inset-0 z-[2]"
          style={{ pointerEvents: 'none', ...hide }}
        >
          <div
            className="pointer-events-auto absolute"
            style={{ right: '8%', top: '82.5%' }}
          >
            <VerseCycler />
          </div>
        </div>
      </div>
    </Stage>
  );
}
