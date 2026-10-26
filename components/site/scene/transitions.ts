import gsap from 'gsap';
import type { RefObject } from 'react';
import { easings } from './ease';
import type { IntroHandle } from './IntroScene';
import type { JourneyHandle } from './JourneyScene';
import type { MovePlayer } from './SceneProvider';
import { playToEnd, prefersReducedMotion } from './timing';

type Refs = {
  intro: RefObject<IntroHandle | null>;
  journey: RefObject<JourneyHandle | null>;
  introRoot: RefObject<HTMLElement | null>;
  journeyRoot: RefObject<HTMLElement | null>;
};

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
  'intro->journey' | 'journey->intro',
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
  };
}
