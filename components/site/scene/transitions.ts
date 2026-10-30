import gsap from 'gsap';
import type { RefObject } from 'react';
import {
  MIST_TRAVEL,
  arrivalCamera,
  arrivalFog,
  arrivalLight,
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

type Parts = {
  intro: IntroHandle;
  journey: JourneyHandle;
  wedding: WeddingHandle;
  world: WorldHandle;
  veil: HTMLDivElement;
  introRoot: HTMLElement;
  journeyRoot: HTMLElement;
  weddingRoot: HTMLElement;
};

/** How far the camera pushes into the monitor before the cut (the stage's scale); the calm
 *  version (reduce motion) does not zoom: the film just flares to light. */
const pushScale = () => (calmMotion() ? 1 : 1.6);

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
  tl.to(
    state,
    { p: to, duration, ease, onUpdate: () => onUpdate(state.p) },
    at,
  );
}

export function createTransitions(
  refs: Refs,
): Partial<
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
  const parts = (): Parts | null => {
    const x = {
      intro: refs.intro.current,
      journey: refs.journey.current,
      wedding: refs.wedding.current,
      world: refs.world.current,
      veil: refs.veil.current,
      introRoot: refs.introRoot.current,
      journeyRoot: refs.journeyRoot.current,
      weddingRoot: refs.weddingRoot.current,
    };
    return Object.values(x).every(Boolean) ? (x as Parts) : null;
  };

  // Arriving on the path: t is time (0..1), and the camera eases in on `ease` while the light
  // fades and the mist clears on time, so the path is still misty as it settles.
  const arriving =
    (world: WorldHandle, ease: (t: number) => number) => (t: number) => {
      const p = ease(t);
      world.pose({
        camera: arrivalCamera(p),
        show: ['journey'],
        fog: arrivalFog(t),
        light: arrivalLight(t),
        mistLag: MIST_TRAVEL * (1 - p),
      });
    };

  // 03 -> 04: the camera pushes into the monitor until its film fills the view and flares to
  // white, and the path comes up out of the light: the camera drifts forward through mist that
  // streams past and clears. Without the folder when the camera is only passing through.
  async function outOfTheMonitor(x: Parts, withFolder: boolean) {
    const p = x.intro.parts();
    const jp = x.journey.parts();
    const arrive = arriving(x.world, gsap.parseEase('power3.out'));
    // the path waits behind the monitor, a step back and deep in the light
    arrive(0);
    gsap.set(x.journeyRoot, { autoAlpha: 0 });
    gsap.set(jp.folder, { opacity: 0 });

    const push = gsap.timeline();
    push
      .to(p.ui, { opacity: 0, duration: 0.3 }, 0)
      .to(p.stage, { scale: pushScale(), duration: 1.3, ease: 'power2.in' }, 0)
      .fromTo(
        x.veil,
        { opacity: 0 },
        { opacity: 1, duration: 0.6, ease: 'power1.in' },
        0.75,
      );
    await playToEnd(push);

    gsap.set(x.introRoot, { autoAlpha: 0 });
    gsap.set(x.journeyRoot, { autoAlpha: 1 });
    const tl = gsap.timeline();
    tl.to(x.veil, { opacity: 0, duration: 0.8, ease: 'power1.out' }, 0);
    tweenProgress(tl, 0, 0, 1, withFolder ? 3.2 : 2.4, 'none', arrive);
    if (withFolder) tl.to(jp.folder, { opacity: 1, duration: 0.8 }, 2.0);
    await playToEnd(tl);
    x.world.rest('journey');
    if (withFolder) gsap.set(jp.folder, { clearProps: 'opacity' });
    x.intro.rest();
    x.intro.setPlaying(false);
  }

  // 04 -> 03: the camera backs off the path into the mist and the light, and the monitor
  // pulls back from its screen.
  async function backIntoTheMonitor(x: Parts) {
    const p = x.intro.parts();
    const jp = x.journey.parts();
    x.intro.setPlaying(true);
    gsap.set(p.stage, { scale: pushScale() });
    gsap.set(p.ui, { opacity: 0 });

    const back = gsap.timeline();
    tweenProgress(
      back,
      0,
      1,
      0,
      1.6,
      'none',
      arriving(x.world, gsap.parseEase('power2.in')),
    );
    back.to(jp.folder, { opacity: 0, duration: 0.4 }, 0);
    if (jp.window)
      back.to(jp.window, { '--win-o': 0, scale: 0.96, duration: 0.5 }, 0);
    back.fromTo(
      x.veil,
      { opacity: 0 },
      { opacity: 1, duration: 0.6, ease: 'power1.in' },
      1.0,
    );
    await playToEnd(back);

    gsap.set(x.introRoot, { autoAlpha: 1 });
    gsap.set(x.journeyRoot, { autoAlpha: 0 });
    x.world.rest(null);
    x.journey.reset();

    const out = gsap.timeline();
    out
      .to(x.veil, { opacity: 0, duration: 0.8, ease: 'power1.out' }, 0)
      .to(p.stage, { scale: 1, duration: 1.6, ease: easings.surfaceOut }, 0)
      .to(p.ui, { opacity: 1, duration: 0.7 }, 1.0);
    await playToEnd(out);
    x.intro.rest();
  }

  // 04 -> 05: one continuous walk up the path, through the round arch and into the hall (the
  // walkthrough film: its first frame is the path as painted, its last the hall). The journey's
  // window and folder step aside first; the hall's folder is there at the end. It plays with
  // reduce motion on too: it is a film of the walk, the move the couple designed.
  async function walkToWedding(x: Parts, windowOpen: boolean) {
    const jp = x.journey.parts();
    const wp = x.wedding.parts();
    x.wedding.reset();
    gsap.set(x.weddingRoot, { autoAlpha: 0, zIndex: 1 });
    gsap.set(wp.folder, { opacity: 0 });
    const away = gsap.timeline();
    if (windowOpen && jp.window) {
      away.to(
        jp.window,
        { '--win-o': 0, scale: 0.95, duration: 0.5, ease: 'power1.in' },
        0,
      );
    }
    away.to(jp.folder, { opacity: 0, duration: 0.4 }, 0);
    await playToEnd(away);

    x.world.rest('journey');
    await x.world.walk('wedding');
    x.world.rest('wedding');
    gsap.set(x.journeyRoot, { autoAlpha: 0 });
    gsap.set(jp.window, { clearProps: 'transform,--win-o' });
    gsap.set(jp.folder, { clearProps: 'opacity' });
    gsap.set(x.weddingRoot, { autoAlpha: 1 });
    const settle = gsap.timeline();
    settle.to(wp.folder, { opacity: 1, duration: 0.6 }, 0.1);
    await Promise.all([x.world.hideWalk(), playToEnd(settle)]);
    gsap.set(wp.folder, { clearProps: 'opacity' });
  }

  // 05 -> 04: the same walk backwards, out of the hall and down the path.
  async function walkToJourney(
    x: Parts,
    openWindow: boolean,
    withFolder: boolean,
  ) {
    const jp = x.journey.parts();
    const wp = x.wedding.parts();
    const away = gsap.timeline();
    away.to([wp.folder, wp.cursor], { opacity: 0, duration: 0.4 }, 0);
    // the wedding window opens by itself, so it is usually open: it goes first
    if (wp.window) {
      away.to(
        wp.window,
        { '--win-o': 0, scale: 0.95, duration: 0.5, ease: 'power1.in' },
        0,
      );
    }
    await playToEnd(away);

    gsap.set(jp.folder, { opacity: 0 });
    x.world.rest('wedding');
    await x.world.walk('journey');
    x.world.rest('journey');
    gsap.set(x.weddingRoot, { autoAlpha: 0 });
    x.wedding.reset();
    gsap.set(x.journeyRoot, { autoAlpha: 1 });
    const settle = gsap.timeline();
    if (withFolder) settle.to(jp.folder, { opacity: 1, duration: 0.6 }, 0.1);
    if (openWindow && jp.window) {
      settle.fromTo(
        jp.window,
        { scale: 0.95, '--win-o': 0 },
        {
          scale: 1,
          '--win-o': 1,
          duration: 0.9,
          ease: 'power2.out',
          clearProps: 'transform',
        },
        0.2,
      );
    }
    await Promise.all([x.world.hideWalk(), playToEnd(settle)]);
    gsap.set(jp.folder, { clearProps: 'opacity' });
  }

  return {
    // 03 -> 05 (a nav jump): out of the monitor onto the path, and on up it into the hall
    // without stopping (the journey's folder and window never show).
    'intro->wedding': async () => {
      const x = parts();
      if (!x) return;
      x.journey.reset();
      x.wedding.reset();
      gsap.set(x.weddingRoot, { autoAlpha: 0, zIndex: 1 });
      await outOfTheMonitor(x, false);
      await walkToWedding(x, false);
      await sleep(700);
      await x.wedding.cursorIn();
    },

    // 05 -> 03 (a nav jump): back down the path and into the monitor without stopping.
    'wedding->intro': async () => {
      const x = parts();
      if (!x) return;
      await walkToJourney(x, false, false);
      await backIntoTheMonitor(x);
    },

    'intro->journey': async () => {
      const x = parts();
      if (!x) return;
      x.journey.reset();
      await outOfTheMonitor(x, true);
    },

    'journey->intro': async () => {
      const x = parts();
      if (!x) return;
      await backIntoTheMonitor(x);
    },

    'journey->wedding': async (_move, from) => {
      const x = parts();
      if (!x) return;
      await walkToWedding(x, from.journeyOpen);
      await sleep(600);
      await x.wedding.cursorIn();
    },

    'wedding->journey': async (move) => {
      const x = parts();
      if (!x) return;
      await walkToJourney(x, move.to.journeyOpen, true);
    },
  };
}
