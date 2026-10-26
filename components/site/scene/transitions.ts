import gsap from 'gsap';
import type { RefObject } from 'react';
import {
  arrivalCamera,
  crossingBackdrop,
  crossingCamera,
  crossingFront,
} from '@/lib/scene/world';
import { easings } from './ease';
import type { GlitchHandle } from './GlitchBurst';
import type { IntroHandle } from './IntroScene';
import type { JourneyHandle } from './JourneyScene';
import type { MovePlayer } from './SceneProvider';
import { playToEnd, prefersReducedMotion, sleep } from './timing';
import type { WeddingHandle } from './WeddingScene';
import type { WorldHandle } from './WorldScene';

type Refs = {
  intro: RefObject<IntroHandle | null>;
  journey: RefObject<JourneyHandle | null>;
  wedding: RefObject<WeddingHandle | null>;
  world: RefObject<WorldHandle | null>;
  glitch: RefObject<GlitchHandle | null>;
  introRoot: RefObject<HTMLElement | null>;
  journeyRoot: RefObject<HTMLElement | null>;
  weddingRoot: RefObject<HTMLElement | null>;
};

/** How far the camera pushes into the monitor before the cut (the stage's scale). */
const PUSH = 1.6;

/** A plain crossfade between two scene roots: reduced motion only. */
async function crossfade(from: HTMLElement, to: HTMLElement) {
  const tl = gsap.timeline();
  tl.set(to, { autoAlpha: 0 }, 0)
    .to(to, { autoAlpha: 1, duration: 0.5 }, 0)
    .to(from, { autoAlpha: 0, duration: 0.5 }, 0);
  await playToEnd(tl);
}

/** Runs `onUpdate` with a progress that goes from `from` to `to` on the timeline. */
function tweenProgress(
  tl: gsap.core.Timeline,
  at: number,
  from: number,
  to: number,
  duration: number,
  ease: string | gsap.EaseFunction,
  onUpdate: (p: number) => void,
) {
  const state = { p: from };
  onUpdate(from);
  tl.to(state, { p: to, duration, ease, onUpdate: () => onUpdate(state.p) }, at);
}

export function createTransitions(refs: Refs): Partial<
  Record<
    'intro->journey' | 'journey->intro' | 'journey->wedding' | 'wedding->journey',
    MovePlayer
  >
> {
  const crossing = (world: WorldHandle) => (q: number) =>
    world.pose({
      camera: crossingCamera(q),
      show: ['journey', 'wedding'],
      backdrop: crossingBackdrop(q),
      front: crossingFront(q),
    });

  return {
    // 03 -> 04: the camera pushes into the monitor until the screen fills the view,
    // a burst of static covers the cut, and the camera travels on into the meadow:
    // its layers come up from a little way back, the nearer ones moving faster.
    'intro->journey': async () => {
      const intro = refs.intro.current;
      const journey = refs.journey.current;
      const world = refs.world.current;
      const glitch = refs.glitch.current;
      const introRoot = refs.introRoot.current;
      const journeyRoot = refs.journeyRoot.current;
      if (!intro || !journey || !world || !glitch || !introRoot || !journeyRoot) return;
      journey.reset();
      const p = intro.parts();
      const jp = journey.parts();
      if (prefersReducedMotion()) {
        world.rest('journey');
        await crossfade(introRoot, journeyRoot);
        intro.setPlaying(false);
        return;
      }
      // the meadow is drawn behind the monitor, a little way back, before the cut
      world.pose({ camera: arrivalCamera(0), show: ['journey'] });
      gsap.set(journeyRoot, { autoAlpha: 0 });
      gsap.set(jp.folder, { opacity: 0 });

      const push = gsap.timeline();
      push
        .to(p.ui, { opacity: 0, duration: 0.3 }, 0)
        .to(p.stage, { scale: PUSH, duration: 1.3, ease: 'power2.in' }, 0);
      await playToEnd(push);

      const burst = glitch.burst(560);
      await sleep(230);
      gsap.set(introRoot, { autoAlpha: 0 });
      gsap.set(journeyRoot, { autoAlpha: 1 });

      const tl = gsap.timeline();
      tweenProgress(tl, 0, 0, 1, 2.1, 'power3.out', (q) =>
        world.pose({ camera: arrivalCamera(q), show: ['journey'] }),
      );
      tl.to(jp.folder, { opacity: 1, duration: 0.7 }, 1.5);
      await Promise.all([burst, playToEnd(tl)]);
      world.rest('journey');
      gsap.set(jp.folder, { clearProps: 'opacity' });
      intro.rest();
      intro.setPlaying(false);
    },

    // 04 -> 03: the camera backs out of the meadow, static covers the cut, and the
    // monitor pulls back from the screen.
    'journey->intro': async () => {
      const intro = refs.intro.current;
      const journey = refs.journey.current;
      const world = refs.world.current;
      const glitch = refs.glitch.current;
      const introRoot = refs.introRoot.current;
      const journeyRoot = refs.journeyRoot.current;
      if (!intro || !journey || !world || !glitch || !introRoot || !journeyRoot) return;
      const p = intro.parts();
      const jp = journey.parts();
      intro.setPlaying(true);
      if (prefersReducedMotion()) {
        await crossfade(journeyRoot, introRoot);
        world.rest(null);
        journey.reset();
        return;
      }
      gsap.set(p.stage, { scale: PUSH });
      gsap.set(p.ui, { opacity: 0 });

      const back = gsap.timeline();
      tweenProgress(back, 0, 1, 0, 1.2, 'power2.in', (q) =>
        world.pose({ camera: arrivalCamera(q), show: ['journey'] }),
      );
      back.to(jp.folder, { opacity: 0, duration: 0.4 }, 0);
      if (jp.window) back.to(jp.window, { '--win-o': 0, scale: 0.96, duration: 0.5 }, 0);
      await playToEnd(back);

      const burst = glitch.burst(560);
      await sleep(230);
      gsap.set(introRoot, { autoAlpha: 1 });
      gsap.set(journeyRoot, { autoAlpha: 0 });
      world.rest(null);
      journey.reset();

      const out = gsap.timeline();
      out
        .to(p.stage, { scale: 1, duration: 1.6, ease: easings.surfaceOut }, 0)
        .to(p.ui, { opacity: 1, duration: 0.7 }, 1.0);
      await Promise.all([burst, playToEnd(out)]);
      intro.rest();
    },

    // 04 -> 05: the camera travels on through the meadow. Its plants rush past the
    // lens, its ground slides away underneath, and the river's valley, water and
    // banks come up out of the distance behind them; the meadow's sky and far
    // hills give way to the river's while the plants are passing.
    'journey->wedding': async (_move, from) => {
      const journey = refs.journey.current;
      const wedding = refs.wedding.current;
      const world = refs.world.current;
      const journeyRoot = refs.journeyRoot.current;
      const weddingRoot = refs.weddingRoot.current;
      if (!journey || !wedding || !world || !journeyRoot || !weddingRoot) return;
      wedding.reset();
      const jp = journey.parts();
      const wp = wedding.parts();
      gsap.set(weddingRoot, { autoAlpha: 0, zIndex: 1 });
      if (prefersReducedMotion()) {
        world.rest('wedding');
        await crossfade(journeyRoot, weddingRoot);
        await wedding.cursorIn();
        return;
      }
      const pose = crossing(world);
      pose(0);
      gsap.set(wp.folder, { opacity: 0 });

      const tl = gsap.timeline();
      if (from.journeyOpen && jp.window) {
        tl.to(jp.window, { '--win-o': 0, scale: 0.95, duration: 0.6, ease: 'power1.in' }, 0);
      }
      tl.to(jp.folder, { opacity: 0, duration: 0.45 }, 0);
      tweenProgress(tl, 0.25, 0, 1, 3.8, 'power2.inOut', pose);
      // the river's folder is there to be found as the camera settles
      tl.set(weddingRoot, { autoAlpha: 1 }, 3.2).to(wp.folder, { opacity: 1, duration: 0.8 }, 3.2);
      await playToEnd(tl);

      gsap.set(journeyRoot, { autoAlpha: 0 });
      gsap.set(jp.window, { clearProps: 'transform,--win-o' });
      gsap.set(jp.folder, { clearProps: 'opacity' });
      gsap.set(wp.folder, { clearProps: 'opacity' });
      world.rest('wedding');
      await sleep(900);
      await wedding.cursorIn();
    },

    // 05 -> 04: back the way we came
    'wedding->journey': async (move) => {
      const journey = refs.journey.current;
      const wedding = refs.wedding.current;
      const world = refs.world.current;
      const journeyRoot = refs.journeyRoot.current;
      const weddingRoot = refs.weddingRoot.current;
      if (!journey || !wedding || !world || !journeyRoot || !weddingRoot) return;
      const jp = journey.parts();
      const wp = wedding.parts();
      gsap.set(journeyRoot, { autoAlpha: 1 });
      if (prefersReducedMotion()) {
        gsap.set(jp.window, { clearProps: 'transform,--win-o' });
        gsap.set(jp.folder, { clearProps: 'opacity' });
        world.rest('journey');
        await crossfade(weddingRoot, journeyRoot);
        wedding.reset();
        return;
      }
      const pose = crossing(world);
      pose(1);
      gsap.set(jp.folder, { opacity: 0 });

      const tl = gsap.timeline();
      tl.to([wp.folder, wp.cursor], { opacity: 0, duration: 0.4 }, 0);
      tweenProgress(tl, 0.15, 1, 0, 3.4, 'power2.inOut', pose);
      tl.set(weddingRoot, { autoAlpha: 0 }, 2.2).to(jp.folder, { opacity: 1, duration: 0.7 }, 2.6);
      if (move.to.journeyOpen) {
        tl.fromTo(
          jp.window,
          { scale: 0.95, '--win-o': 0 },
          { scale: 1, '--win-o': 1, duration: 0.9, ease: 'power2.out', clearProps: 'transform' },
          3.0,
        );
      }
      await playToEnd(tl);
      gsap.set(weddingRoot, { autoAlpha: 0 });
      gsap.set(jp.folder, { clearProps: 'opacity' });
      world.rest('journey');
      wedding.reset();
    },
  };
}
