import gsap from 'gsap';
import type { RefObject } from 'react';
import { easings } from './ease';
import type { IntroHandle } from './IntroScene';
import type { JourneyHandle } from './JourneyScene';
import type { WeddingHandle } from './WeddingScene';
import type { MovePlayer } from './SceneProvider';
import { playToEnd, prefersReducedMotion, sleep } from './timing';

type Refs = {
  intro: RefObject<IntroHandle | null>;
  journey: RefObject<JourneyHandle | null>;
  introRoot: RefObject<HTMLElement | null>;
  journeyRoot: RefObject<HTMLElement | null>;
  wedding: RefObject<WeddingHandle | null>;
  weddingRoot: RefObject<HTMLElement | null>;
  haze: RefObject<HTMLElement | null>;
  setChromeVisible: (visible: boolean) => void;
};

// How far into the clip (seconds) we are deep in the motion blur, where the river takes over.
const FLY_CUT = 4.9;

async function until(test: () => boolean, maxMs: number) {
  const t0 = performance.now();
  while (!test() && performance.now() - t0 < maxMs) await sleep(30);
}

// How far the intro's layers rush past the camera as we go "through the screen".
const THROUGH = { world: 2.9, bubbles: 4, bezel: 1.3, behind: 1.12 };

/** A plain crossfade between two scene roots: reduced motion, and the fallback. */
async function crossfade(from: HTMLElement, to: HTMLElement) {
  const tl = gsap.timeline();
  tl.set(to, { autoAlpha: 0 }, 0)
    .to(to, { autoAlpha: 1, duration: 0.5 }, 0)
    .to(from, { autoAlpha: 0, duration: 0.5 }, 0);
  await playToEnd(tl);
}

export function createTransitions(refs: Refs): Partial<Record<
  'intro->journey' | 'journey->intro' | 'journey->wedding' | 'wedding->journey',
  MovePlayer
>> {
  return {
    // 03 -> 04: the next scene appears inside the blob, then the grass border
    // rushes past the camera: we go through the screen instead of cutting.
    // 03 stays on top with its interior emptied; 04 waits underneath.
    'intro->journey': async () => {
      const intro = refs.intro.current;
      const journey = refs.journey.current;
      const introRoot = refs.introRoot.current;
      const journeyRoot = refs.journeyRoot.current;
      if (!intro || !journey || !introRoot || !journeyRoot) return;
      journey.reset();
      gsap.set(journeyRoot, { autoAlpha: 1 });
      const p = intro.parts();
      if (prefersReducedMotion()) {
        await crossfade(introRoot, journeyRoot);
        intro.setPlaying(false);
        return;
      }
      gsap.set(p.black, { opacity: 0 });
      const D = 1.8;
      const tl = gsap.timeline();
      tl.to(p.ui, { opacity: 0, duration: 0.35 }, 0)
        .to(p.video, { opacity: 0, duration: 0.65, ease: 'power1.inOut' }, 0)
        .to(p.bezel, { scale: THROUGH.bezel, opacity: 0, duration: 0.7, ease: 'power1.in' }, 0)
        .to(p.bubbles, { scale: THROUGH.bubbles, opacity: 0, duration: D, ease: easings.dive }, 0.25)
        .to(
          p.world,
          {
            keyframes: {
              '30%': { scale: 1.12 },
              '85%': { scale: THROUGH.world, filter: 'blur(4px)' },
              '100%': { scale: THROUGH.world * 1.08, filter: 'blur(5px)', opacity: 0 },
            },
            easeEach: easings.dive,
            duration: D,
          },
          0.25,
        )
        .fromTo(
          journey.parts().stage,
          { scale: THROUGH.behind },
          { scale: 1, duration: D + 0.5, ease: 'power2.out' },
          0,
        );
      await playToEnd(tl);
      gsap.set(introRoot, { autoAlpha: 0 });
      intro.rest();
      intro.setPlaying(false);
      gsap.set(journey.parts().stage, { clearProps: 'transform' });
    },

    // 04 -> 03: climb back out through the screen
    'journey->intro': async () => {
      const intro = refs.intro.current;
      const journey = refs.journey.current;
      const introRoot = refs.introRoot.current;
      const journeyRoot = refs.journeyRoot.current;
      if (!intro || !journey || !introRoot || !journeyRoot) return;
      const p = intro.parts();
      intro.setPlaying(true);
      if (prefersReducedMotion()) {
        await crossfade(journeyRoot, introRoot);
        journey.reset();
        return;
      }
      gsap.set(introRoot, { autoAlpha: 1 });
      gsap.set(p.black, { opacity: 0 });
      const D = 1.6;
      const ease = easings.surfaceOut;
      const tl = gsap.timeline();
      tl.to(journey.parts().stage, { scale: THROUGH.behind, duration: D, ease }, 0)
        .fromTo(
          p.world,
          { scale: THROUGH.world * 1.08, filter: 'blur(5px)', opacity: 0 },
          {
            keyframes: {
              '15%': { scale: THROUGH.world, filter: 'blur(4px)', opacity: 1 },
              '100%': { scale: 1, filter: 'blur(0px)', opacity: 1 },
            },
            easeEach: ease,
            duration: D,
          },
          0,
        )
        .fromTo(p.bubbles, { scale: THROUGH.bubbles, opacity: 0 }, { scale: 1, opacity: 1, duration: D, ease }, 0)
        .fromTo(p.bezel, { scale: THROUGH.bezel, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.7, ease: 'power1.out' }, 0.9)
        .fromTo(p.ui, { opacity: 0 }, { opacity: 1, duration: 0.6 }, 1.2)
        .fromTo(p.video, { opacity: 0 }, { opacity: 1, duration: 0.7, ease: 'power1.inOut' }, 1.0);
      await playToEnd(tl);
      gsap.set(journeyRoot, { autoAlpha: 0 });
      gsap.set(journey.parts().stage, { clearProps: 'transform' });
      journey.reset();
      intro.rest();
    },

    // 04 -> 05: the camera dashes forward low through the meadow grass (the
    // clip) and comes out of the motion blur at the river. The clip has the
    // top bar baked in, so the real one is hidden while it plays.
    'journey->wedding': async (move, from) => {
      const journey = refs.journey.current;
      const wedding = refs.wedding.current;
      const jr = refs.journeyRoot.current;
      const wr = refs.weddingRoot.current;
      const haze = refs.haze.current;
      if (!journey || !wedding || !jr || !wr || !haze) return;
      wedding.reset();
      gsap.set(wr, { autoAlpha: 0, zIndex: 4 });
      if (prefersReducedMotion()) {
        await crossfade(jr, wr);
        await wedding.cursorIn();
        return;
      }
      const jp = journey.parts();
      const wp = wedding.parts();
      const fly = jp.fly;
      const canFly = !!fly && fly.readyState >= 2;
      if (from.journeyOpen) {
        gsap.to(jp.window, {
          scale: canFly ? 0.95 : 0.9,
          yPercent: canFly ? 0 : -16,
          '--win-o': 0, // the window fades with --win-o so its glass keeps its blur (GlassWindow)
          transformOrigin: '50% 50%',
          duration: canFly ? 0.6 : 0.85,
          ease: canFly ? 'power1.in' : easings.shrink,
        });
      }
      gsap.to(jp.folder, { opacity: 0, duration: canFly ? 0.4 : 0.5 });
      refs.setChromeVisible(false);

      if (canFly && fly) {
        fly.currentTime = 0;
        await until(() => !fly.seeking, 1500);
        await sleep(550);
        gsap.set(fly, { opacity: 1 }); // the clip opens on this exact meadow, so the swap is invisible
        fly.playbackRate = 1.3;
        await fly.play().catch(() => {});
        await until(() => fly.currentTime >= FLY_CUT || fly.ended || fly.paused, 8000);
        const tl = gsap.timeline();
        tl.fromTo(
          wp.stage,
          { scale: 1.2, filter: 'blur(14px)' },
          { scale: 1, filter: 'blur(0px)', duration: 1.6, ease: easings.arrive, clearProps: 'filter,transform' },
          0,
        ).to(wr, { autoAlpha: 1, duration: 0.75, ease: 'power1.inOut' }, 0);
        await playToEnd(tl);
        fly.pause();
        gsap.set(fly, { opacity: 0 });
      } else {
        // the clip can't play: push up and forward through a haze
        const tl = gsap.timeline();
        tl.to(jp.stage, { yPercent: -7, scale: 1.6, filter: 'blur(10px)', duration: 2.1, ease: 'power2.in' }, 0.25)
          .to(haze, { keyframes: { '50%': { opacity: 0.88 }, '100%': { opacity: 0 } }, duration: 2.7 }, 0.45)
          .fromTo(
            wp.stage,
            { yPercent: 9, scale: 1.3, filter: 'blur(10px)' },
            { yPercent: 0, scale: 1, filter: 'blur(0px)', duration: 2.1, ease: easings.arrive, clearProps: 'filter,transform' },
            1.45,
          )
          .to(wr, { autoAlpha: 1, duration: 0.9, ease: 'power1.out' }, 1.45);
        await playToEnd(tl);
      }
      gsap.set(jr, { autoAlpha: 0 });
      gsap.set(jp.stage, { clearProps: 'transform,filter' });
      refs.setChromeVisible(true);
      await sleep(1000);
      await wedding.cursorIn();
    },

    // 05 -> 04: back out of the river to the meadow
    'wedding->journey': async (move) => {
      const journey = refs.journey.current;
      const wedding = refs.wedding.current;
      const jr = refs.journeyRoot.current;
      const wr = refs.weddingRoot.current;
      const haze = refs.haze.current;
      if (!journey || !wedding || !jr || !wr || !haze) return;
      const jp = journey.parts();
      const wp = wedding.parts();
      gsap.set(jr, { autoAlpha: 1 });
      gsap.set(jp.fly, { opacity: 0 });
      if (prefersReducedMotion()) {
        gsap.set(jp.window, { clearProps: 'transform,--win-o' });
        gsap.set(jp.folder, { clearProps: 'transform,opacity,filter' });
        await crossfade(wr, jr);
        wedding.reset();
        return;
      }
      const tl = gsap.timeline();
      tl.fromTo(
        jp.stage,
        { scale: 1.25, filter: 'blur(10px)' },
        { scale: 1, filter: 'blur(0px)', duration: 1.8, ease: easings.arrive, clearProps: 'filter,transform' },
        0,
      )
        .fromTo(jp.folder, { opacity: 0 }, { opacity: 1, duration: 0.6 }, 0.6)
        .to(haze, { keyframes: { '45%': { opacity: 0.7 }, '100%': { opacity: 0 } }, duration: 1.9 }, 0)
        .to(wp.stage, { yPercent: 9, scale: 1.3, filter: 'blur(10px)', duration: 1.5, ease: easings.shrink }, 0)
        .to(wr, { autoAlpha: 0, duration: 1.1 }, 0.3);
      if (move.to.journeyOpen) {
        tl.fromTo(
          jp.window,
          { scale: 0.95, '--win-o': 0, yPercent: 0 },
          { scale: 1, '--win-o': 1, duration: 0.9, ease: 'power2.out', clearProps: 'transform' },
          0.8,
        );
      }
      await playToEnd(tl);
      gsap.set(wp.stage, { clearProps: 'transform,filter' });
      gsap.set(wr, { autoAlpha: 0 });
      wedding.reset();
    },
  };
}
