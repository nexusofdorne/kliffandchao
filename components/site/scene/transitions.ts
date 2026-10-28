import gsap from 'gsap';
import type { RefObject } from 'react';
import {
  ARRIVAL_BACK,
  MIST_TRAVEL,
  arrivalCamera,
  arrivalFog,
  arrivalLight,
  crossingBackdrop,
  crossingCamera,
  crossingFog,
  crossingFront,
  crossingMeadow,
} from '@/lib/scene/world';
import { easings } from './ease';
import type { IntroHandle } from './IntroScene';
import type { JourneyHandle } from './JourneyScene';
import type { MovePlayer } from './SceneProvider';
import { calmMotion, playToEnd, sleep } from './timing';
import type { WeddingHandle } from './WeddingScene';
import type { WorldHandle } from './WorldScene';

type Refs = {
  intro: RefObject<IntroHandle | null>;
  journey: RefObject<JourneyHandle | null>;
  wedding: RefObject<WeddingHandle | null>;
  world: RefObject<WorldHandle | null>;
  veil: RefObject<HTMLDivElement | null>;
  introRoot: RefObject<HTMLElement | null>;
  journeyRoot: RefObject<HTMLElement | null>;
  weddingRoot: RefObject<HTMLElement | null>;
};

/** How far the camera pushes into the monitor before the cut (the stage's scale); the calm
 *  version (reduce motion) does not zoom: the film just flares to light. */
const pushScale = () => (calmMotion() ? 1 : 1.6);

/** The intro and the wedding straight to each other: how long the camera takes, monitor to river. */
const DIRECT_S = 5.2;
/** The share of that move the light and the arrival's mist take to clear (the meadow end). */
const DIRECT_ARRIVAL = 0.28;

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
    | 'intro->journey'
    | 'journey->intro'
    | 'journey->wedding'
    | 'wedding->journey'
    | 'intro->wedding'
    | 'wedding->intro',
    MovePlayer
  >
> {
  const crossing = (world: WorldHandle) => (q: number) =>
    world.pose({
      camera: crossingCamera(q),
      show: ['journey', 'wedding'],
      backdrop: crossingBackdrop(q),
      front: crossingFront(q),
      meadow: crossingMeadow(q),
      fog: crossingFog(q),
      light: 0.1 * crossingFog(q),
    });

  // Arriving in the meadow: t is time (0..1), and the camera eases in on `ease` while the
  // light fades and the mist clears on time, so the meadow is still misty as it settles.
  const arriving = (world: WorldHandle, ease: (t: number) => number) => (t: number) => {
    const p = ease(t);
    world.pose({
      camera: arrivalCamera(p),
      show: ['journey'],
      fog: arrivalFog(t),
      light: arrivalLight(t),
      mistLag: MIST_TRAVEL * (1 - p),
    });
  };

  // The intro and the wedding straight to each other: one camera move from just through the
  // monitor's screen (a step back in the meadow) all the way to the river, u = time 0..1. The
  // meadow passes without stopping: its light and mist clear at the start, the bank of mist
  // comes in the middle, the river settles at the end. The way back plays it from 1 to 0.
  const throughMeadow = (world: WorldHandle) => {
    const ease = gsap.parseEase('power2.inOut');
    return (u: number) => {
      const c = ARRIVAL_BACK + (1 - ARRIVAL_BACK) * ease(u);
      const q = Math.max(0, c);
      const a = Math.min(1, u / DIRECT_ARRIVAL);
      world.pose({
        camera: { journey: c, wedding: crossingCamera(q).wedding },
        show: ['journey', 'wedding'],
        backdrop: crossingBackdrop(q),
        front: crossingFront(q),
        meadow: crossingMeadow(q),
        fog: Math.max(arrivalFog(a), crossingFog(q)),
        light: Math.max(arrivalLight(a), 0.1 * crossingFog(q)),
        mistLag: MIST_TRAVEL * (1 - a),
      });
    };
  };

  return {
    // 03 -> 05 (a nav jump): the camera pushes into the monitor until its film flares to
    // white, comes out of the light into the meadow and keeps going, through the mist and on
    // to the river. The journey is not a stop: its folder and window never show.
    'intro->wedding': async () => {
      const intro = refs.intro.current;
      const journey = refs.journey.current;
      const wedding = refs.wedding.current;
      const world = refs.world.current;
      const veil = refs.veil.current;
      const introRoot = refs.introRoot.current;
      const journeyRoot = refs.journeyRoot.current;
      const weddingRoot = refs.weddingRoot.current;
      if (!intro || !journey || !wedding || !world || !veil || !introRoot || !journeyRoot || !weddingRoot) return;
      journey.reset();
      wedding.reset();
      const p = intro.parts();
      const wp = wedding.parts();
      gsap.set(journeyRoot, { autoAlpha: 0 });
      gsap.set(weddingRoot, { autoAlpha: 0, zIndex: 1 });
      const pose = throughMeadow(world);
      pose(0);
      gsap.set(wp.folder, { opacity: 0 });

      const push = gsap.timeline();
      push
        .to(p.ui, { opacity: 0, duration: 0.3 }, 0)
        .to(p.stage, { scale: pushScale(), duration: 1.3, ease: 'power2.in' }, 0)
        .fromTo(veil, { opacity: 0 }, { opacity: 1, duration: 0.6, ease: 'power1.in' }, 0.75);
      await playToEnd(push);

      gsap.set(introRoot, { autoAlpha: 0 });
      const tl = gsap.timeline();
      tl.to(veil, { opacity: 0, duration: 0.8, ease: 'power1.out' }, 0);
      tweenProgress(tl, 0, 0, 1, DIRECT_S, 'none', pose);
      // the river's folder is there to be found as the camera settles
      tl.set(weddingRoot, { autoAlpha: 1 }, DIRECT_S * 0.84).to(wp.folder, { opacity: 1, duration: 0.8 }, DIRECT_S * 0.84);
      await playToEnd(tl);
      world.rest('wedding');
      gsap.set(wp.folder, { clearProps: 'opacity' });
      intro.rest();
      intro.setPlaying(false);
      await sleep(700);
      await wedding.cursorIn();
    },

    // 05 -> 03 (a nav jump): back the same way without stopping in the meadow: the river
    // falls away into the mist, the meadow goes past, the light floods in and the monitor
    // pulls back from its screen.
    'wedding->intro': async () => {
      const intro = refs.intro.current;
      const journey = refs.journey.current;
      const wedding = refs.wedding.current;
      const world = refs.world.current;
      const veil = refs.veil.current;
      const introRoot = refs.introRoot.current;
      const journeyRoot = refs.journeyRoot.current;
      const weddingRoot = refs.weddingRoot.current;
      if (!intro || !journey || !wedding || !world || !veil || !introRoot || !journeyRoot || !weddingRoot) return;
      const p = intro.parts();
      const wp = wedding.parts();
      intro.setPlaying(true);
      gsap.set(journeyRoot, { autoAlpha: 0 });
      gsap.set(p.stage, { scale: pushScale() });
      gsap.set(p.ui, { opacity: 0 });
      const pose = throughMeadow(world);

      const back = gsap.timeline();
      back.to([wp.folder, wp.cursor], { opacity: 0, duration: 0.4 }, 0);
      if (wp.window) back.to(wp.window, { '--win-o': 0, scale: 0.95, duration: 0.5, ease: 'power1.in' }, 0);
      back.set(weddingRoot, { autoAlpha: 0 }, 0.6);
      tweenProgress(back, 0.15, 1, 0, DIRECT_S, 'none', pose);
      back.fromTo(veil, { opacity: 0 }, { opacity: 1, duration: 0.6, ease: 'power1.in' }, 0.15 + DIRECT_S - 0.45);
      await playToEnd(back);

      gsap.set(introRoot, { autoAlpha: 1 });
      world.rest(null);
      wedding.reset();
      journey.reset();

      const out = gsap.timeline();
      out
        .to(veil, { opacity: 0, duration: 0.8, ease: 'power1.out' }, 0)
        .to(p.stage, { scale: 1, duration: 1.6, ease: easings.surfaceOut }, 0)
        .to(p.ui, { opacity: 1, duration: 0.7 }, 1.0);
      await playToEnd(out);
      intro.rest();
    },

    // 03 -> 04: the camera pushes into the monitor until its film fills the view and flares
    // to white, and the meadow comes up out of the light: the camera drifts forward through
    // mist that streams past and clears.
    'intro->journey': async () => {
      const intro = refs.intro.current;
      const journey = refs.journey.current;
      const world = refs.world.current;
      const veil = refs.veil.current;
      const introRoot = refs.introRoot.current;
      const journeyRoot = refs.journeyRoot.current;
      if (!intro || !journey || !world || !veil || !introRoot || !journeyRoot) return;
      journey.reset();
      const p = intro.parts();
      const jp = journey.parts();
      const arrive = arriving(world, gsap.parseEase('power3.out'));
      // the meadow waits behind the monitor, a step back and deep in the light
      arrive(0);
      gsap.set(journeyRoot, { autoAlpha: 0 });
      gsap.set(jp.folder, { opacity: 0 });

      const push = gsap.timeline();
      push
        .to(p.ui, { opacity: 0, duration: 0.3 }, 0)
        .to(p.stage, { scale: pushScale(), duration: 1.3, ease: 'power2.in' }, 0)
        .fromTo(veil, { opacity: 0 }, { opacity: 1, duration: 0.6, ease: 'power1.in' }, 0.75);
      await playToEnd(push);

      gsap.set(introRoot, { autoAlpha: 0 });
      gsap.set(journeyRoot, { autoAlpha: 1 });
      const tl = gsap.timeline();
      tl.to(veil, { opacity: 0, duration: 0.8, ease: 'power1.out' }, 0);
      tweenProgress(tl, 0, 0, 1, 3.2, 'none', arrive);
      tl.to(jp.folder, { opacity: 1, duration: 0.8 }, 2.0);
      await playToEnd(tl);
      world.rest('journey');
      gsap.set(jp.folder, { clearProps: 'opacity' });
      intro.rest();
      intro.setPlaying(false);
    },

    // 04 -> 03: the camera backs out of the meadow into the mist and the light, and the
    // monitor pulls back from its screen.
    'journey->intro': async () => {
      const intro = refs.intro.current;
      const journey = refs.journey.current;
      const world = refs.world.current;
      const veil = refs.veil.current;
      const introRoot = refs.introRoot.current;
      const journeyRoot = refs.journeyRoot.current;
      if (!intro || !journey || !world || !veil || !introRoot || !journeyRoot) return;
      const p = intro.parts();
      const jp = journey.parts();
      intro.setPlaying(true);
      gsap.set(p.stage, { scale: pushScale() });
      gsap.set(p.ui, { opacity: 0 });

      const back = gsap.timeline();
      tweenProgress(back, 0, 1, 0, 1.6, 'none', arriving(world, gsap.parseEase('power2.in')));
      back.to(jp.folder, { opacity: 0, duration: 0.4 }, 0);
      if (jp.window) back.to(jp.window, { '--win-o': 0, scale: 0.96, duration: 0.5 }, 0);
      back.fromTo(veil, { opacity: 0 }, { opacity: 1, duration: 0.6, ease: 'power1.in' }, 1.0);
      await playToEnd(back);

      gsap.set(introRoot, { autoAlpha: 1 });
      gsap.set(journeyRoot, { autoAlpha: 0 });
      world.rest(null);
      journey.reset();

      const out = gsap.timeline();
      out
        .to(veil, { opacity: 0, duration: 0.8, ease: 'power1.out' }, 0)
        .to(p.stage, { scale: 1, duration: 1.6, ease: easings.surfaceOut }, 0)
        .to(p.ui, { opacity: 1, duration: 0.7 }, 1.0);
      await playToEnd(out);
      intro.rest();
    },

    // 04 -> 05: the camera travels on through the meadow. Its plants rush past the
    // lens, its ground slides away underneath, and the river's valley, water and
    // banks come up out of the distance behind them; the meadow's sky and far
    // hills give way to the river's inside a bank of mist the camera flies through.
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
      const pose = crossing(world);
      pose(1);
      gsap.set(jp.folder, { opacity: 0 });

      const tl = gsap.timeline();
      tl.to([wp.folder, wp.cursor], { opacity: 0, duration: 0.4 }, 0);
      // the wedding window opens by itself, so it is usually open: it goes first
      if (wp.window) tl.to(wp.window, { '--win-o': 0, scale: 0.95, duration: 0.5, ease: 'power1.in' }, 0);
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
