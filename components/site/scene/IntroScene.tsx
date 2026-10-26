'use client';

import gsap from 'gsap';
import Image from 'next/image';
import { useImperativeHandle, useRef, type CSSProperties, type Ref } from 'react';
import { VerseCycler } from '@/components/site/intro/VerseCycler';
import { sceneAssets as a } from '@/config/scene-layers.generated';
import { siteConfig } from '@/config/site';
import { Stage, StageLayer, boxStyle } from './Stage';
import { playToEnd, prefersReducedMotion } from './timing';

// Screen 03 (prototype-v3 "03 · intro vid"): the intro film inside the blue
// blob of the monitor's bezel, framed by a ring of grass, flowers and bubbles.
// The nav, wordmark, RSVP and music button are the real chrome on top; the
// verse is the real VerseCycler. Everything starts hidden when the scene is
// "surfaced" (after the terminal, or as a short entrance for a direct visit).

type Side = 'left' | 'top' | 'right' | 'bottom';

export type IntroHandle = {
  /** The grass, flowers and bubbles surface one layer after another, then the video, then the verse. */
  surface: (opts: { order?: Side[]; delay?: number; fast?: boolean }) => Promise<void>;
  /** Resolves once the film has enough buffered to play through. */
  videoReady: () => Promise<void>;
  /** Everything visible and at rest (returning from another scene). */
  rest: () => void;
  parts: () => {
    stage: HTMLElement | null;
    black: HTMLElement | null;
    world: HTMLElement | null;
    bubbles: HTMLElement | null;
    bezel: HTMLElement | null;
    video: HTMLElement | null;
    ui: HTMLElement | null;
  };
};

const grassSides: Side[] = ['left', 'top', 'right', 'bottom'];
const grassAssets = {
  left: a.s03_grass_left,
  top: a.s03_grass_top,
  right: a.s03_grass_right,
  bottom: a.s03_grass_bottom,
} as const;
const bubbles = [
  a.s03_bubble0,
  a.s03_bubble1,
  a.s03_bubble2,
  a.s03_bubble3,
  a.s03_bubble4,
  a.s03_bubble5,
  a.s03_bubble6,
  a.s03_bubble7,
  a.s03_bubble8,
  a.s03_bubble9,
  a.s03_bubble10,
  a.s03_bubble11,
];

const FROM: Record<Side, gsap.TweenVars> = {
  left: { xPercent: -75, scale: 1.1 },
  top: { yPercent: -80, scale: 1.1 },
  right: { xPercent: 70, scale: 1.1 },
  bottom: { yPercent: 70, scale: 1.12 },
};

const hidden: CSSProperties = { opacity: 0 };
const ORIGIN: CSSProperties = { transformOrigin: '50% 46%' };

export function IntroScene({
  ref,
  startHidden,
}: {
  ref?: Ref<IntroHandle>;
  /** Render with the surfacing layers invisible (an entrance will play). */
  startHidden: boolean;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const blackRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const bubblesRef = useRef<HTMLDivElement>(null);
  const bezelRef = useRef<HTMLDivElement>(null);
  const videoBoxRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const uiRef = useRef<HTMLDivElement>(null);
  const hide = startHidden ? hidden : undefined;

  const q = (sel: string) =>
    Array.from(stageRef.current?.querySelectorAll<HTMLElement>(sel) ?? []);

  function videoReady(): Promise<void> {
    const video = videoRef.current;
    if (!video || video.readyState >= 3) return Promise.resolve();
    return new Promise((resolve) => {
      video.addEventListener('canplaythrough', () => resolve(), { once: true });
      video.addEventListener('error', () => resolve(), { once: true });
    });
  }

  async function surface({
    order = ['left', 'top', 'right', 'bottom'],
    delay = 0,
    fast = false,
  }: {
    order?: Side[];
    delay?: number;
    fast?: boolean;
  }) {
    const k = fast ? 0.5 : 1; // time scale
    const t = (seconds: number) => seconds * k;
    const tl = gsap.timeline({ delay });
    const reduced = prefersReducedMotion();

    if (reduced) {
      tl.to(
        [...q('[data-grass]'), ...q('[data-flowers]'), ...q('[data-bubble]'), videoBoxRef.current, uiRef.current],
        { opacity: 1, duration: 0.4 },
        0,
      );
    } else {
      order.forEach((side, i) => {
        tl.fromTo(
          q(`[data-grass="${side}"]`),
          { ...FROM[side], opacity: 0, filter: 'blur(6px)' },
          { xPercent: 0, yPercent: 0, scale: 1, opacity: 1, filter: 'blur(0px)', duration: t(1.7), ease: 'expo.out', clearProps: 'filter' },
          t(i * 0.3),
        );
      });
      tl.fromTo(
        q('[data-flowers]'),
        { yPercent: 4, scale: 1.04, opacity: 0, filter: 'blur(5px)' },
        { yPercent: 0, scale: 1, opacity: 1, filter: 'blur(0px)', duration: t(1.5), ease: 'expo.out', clearProps: 'filter' },
        t(1.25),
      );
      gsap.utils.shuffle(q('[data-bubble]')).forEach((el, i) => {
        tl.fromTo(
          el,
          { yPercent: 30, scale: 0.2, opacity: 0 },
          { yPercent: 0, scale: 1, opacity: 1, duration: t(0.95), ease: 'back.out(1.6)' },
          t(1.35 + i * 0.09),
        );
      });
      tl.fromTo(
        videoBoxRef.current,
        { opacity: 0, filter: 'brightness(1.5) blur(8px)' },
        { opacity: 1, filter: 'none', duration: t(1.5), ease: 'power1.out' },
        t(2.7),
      );
      tl.fromTo(uiRef.current, { opacity: 0 }, { opacity: 1, duration: t(0.7) }, t(3.2));
    }
    // the film starts as it appears
    tl.call(() => void videoRef.current?.play().catch(() => {}), [], t(2.7));
    tl.to({}, { duration: 0.01 }, t(4.2)); // pad the timeline to the full length
    await playToEnd(tl, 600 + delay * 1000);
  }

  function rest() {
    gsap.set(
      [...q('[data-grass]'), ...q('[data-flowers]'), ...q('[data-bubble]'), videoBoxRef.current, uiRef.current, worldRef.current, bubblesRef.current, bezelRef.current],
      { clearProps: 'all' },
    );
    gsap.set(blackRef.current, { clearProps: 'opacity' });
    void videoRef.current?.play().catch(() => {});
  }

  useImperativeHandle(ref, () => ({
    surface,
    videoReady,
    rest,
    parts: () => ({
      stage: stageRef.current,
      black: blackRef.current,
      world: worldRef.current,
      bubbles: bubblesRef.current,
      bezel: bezelRef.current,
      video: videoBoxRef.current,
      ui: uiRef.current,
    }),
  }));

  return (
    <Stage>
      <div ref={stageRef} className="absolute inset-0" style={ORIGIN}>
        <div
          ref={blackRef}
          className="absolute bg-black"
          style={{ ...boxStyle(a.s03_interior), borderRadius: '3.2% / 5.6%', ...ORIGIN }}
        />
        <div ref={worldRef} className="absolute inset-0" style={ORIGIN}>
          <div
            ref={videoBoxRef}
            className="absolute overflow-hidden bg-[#7fa4c2]"
            style={{ ...boxStyle(a.s03_blob), ...hide }}
          >
            <video
              ref={videoRef}
              src={siteConfig.backgrounds.introVideo}
              poster={siteConfig.backgrounds.introPoster}
              muted
              loop
              playsInline
              preload="auto"
              aria-hidden="true"
              tabIndex={-1}
              className="absolute inset-0 h-full w-full object-cover"
            />
          </div>
          {grassSides.map((side) => (
            <StageLayer
              key={side}
              asset={grassAssets[side]}
              data-grass={side}
              style={hide}
            />
          ))}
          <StageLayer asset={a.s03_flowers} data-flowers="" style={hide} />
        </div>
        <div ref={bubblesRef} className="absolute inset-0" style={ORIGIN}>
          {bubbles.map((bubble) => (
            <div
              key={bubble.src}
              data-bubble=""
              className="pointer-events-none absolute"
              style={{ ...boxStyle(bubble), ...hide }}
            >
              <Image
                src={bubble.src}
                alt=""
                width={bubble.px[0]}
                height={bubble.px[1]}
                unoptimized
                draggable={false}
                className="amb-bob block h-full w-full"
              />
            </div>
          ))}
        </div>
        <div ref={bezelRef} className="pointer-events-none absolute inset-0" style={ORIGIN}>
          <StageLayer asset={a.s03_bezel} priority />
        </div>
        <div ref={uiRef} className="absolute inset-0 z-[2]" style={{ pointerEvents: 'none', ...hide }}>
          <div
            className="pointer-events-auto absolute"
            style={{ right: '5.6%', top: '83.5%' }}
          >
            <VerseCycler />
          </div>
        </div>
      </div>
    </Stage>
  );
}
