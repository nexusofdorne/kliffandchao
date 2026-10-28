'use client';

import gsap from 'gsap';
import { Observer } from 'gsap/Observer';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useTrackProgress } from '@/components/site/TrackProgressProvider';
import {
  atScrollEdge,
  createWheelGate,
  keyDirection,
  swipeDirection,
  type Direction,
} from '@/lib/scene/gestures';
import {
  initialState,
  jumpPlan,
  sceneOfSection,
  sectionOf,
  stepPlan,
  tabMove,
  windowMove,
  type Move,
  type MoveKind,
  type SceneId,
  type SceneState,
} from '@/lib/scene/machine';
import { playToEnd } from './timing';

gsap.registerPlugin(Observer);

/** Plays one move. The scene components register these for their own moves. */
export type MovePlayer = (move: Move, from: SceneState) => Promise<void>;

type SceneContextValue = {
  /** The state the story is in, or moving to. */
  state: SceneState;
  /** A transition is playing; input is ignored until it ends. */
  busy: boolean;
  /** Blocks input while something outside the machine (the arrival) plays. */
  setInputLocked: (locked: boolean) => void;
  step: (dir: Direction) => void;
  jumpTo: (scene: SceneId) => void;
  setWindowOpen: (open: boolean) => void;
  goToTab: (tab: number) => void;
  /** Each scene's root element, so the default crossfade can reach them. */
  registerScene: (id: SceneId, element: HTMLElement | null) => void;
  registerPlayer: (kind: MoveKind, player: MovePlayer) => () => void;
};

const SceneContext = createContext<SceneContextValue | null>(null);

const SCENE_CHANGES: readonly MoveKind[] = [
  'intro->journey',
  'journey->intro',
  'journey->wedding',
  'wedding->journey',
  'intro->wedding',
  'wedding->intro',
];

const CROSSFADE_S = 0.7;
const IN_SCENE_MS = 450;

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Typing in a field, or on a control that uses the key itself. */
function keyBelongsToTarget(event: KeyboardEvent): boolean {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return false;
  if (target.closest('input, textarea, select, [contenteditable="true"]')) {
    return true;
  }
  return event.key === ' ' && !!target.closest('button, a, summary');
}

// The desktop story engine. Input (wheel, swipe, arrow keys, nav clicks) turns
// into moves from lib/scene/machine; moves play one at a time, locking input
// while they do, as in the prototype. It reports the section it is in through
// TrackProgressProvider, so the top bar, nav capsule and RSVP pill need no
// changes. Scene components register their own choreography with
// registerPlayer; moves without one get a plain crossfade (which is also the
// whole of reduced motion).
export function SceneProvider({ children }: { children: ReactNode }) {
  const { setUpdate, registerJump } = useTrackProgress();
  const [state, setState] = useState<SceneState>(initialState);
  const [busy, setBusy] = useState(false);

  const stateRef = useRef<SceneState>(initialState);
  const busyRef = useRef(false);
  const scenesRef = useRef<Partial<Record<SceneId, HTMLElement>>>({});
  const playersRef = useRef(new Map<MoveKind, MovePlayer>());
  const wheelGate = useRef(createWheelGate());
  const lockedRef = useRef(false);

  const registerScene = useCallback(
    (id: SceneId, element: HTMLElement | null) => {
      if (element) scenesRef.current[id] = element;
      else delete scenesRef.current[id];
    },
    [],
  );

  const registerPlayer = useCallback((kind: MoveKind, player: MovePlayer) => {
    playersRef.current.set(kind, player);
    return () => {
      if (playersRef.current.get(kind) === player) {
        playersRef.current.delete(kind);
      }
    };
  }, []);

  const crossfade = useCallback(async (from: SceneId, to: SceneId) => {
    const fromEl = scenesRef.current[from];
    const toEl = scenesRef.current[to];
    if (!fromEl || !toEl) return;
    const d = CROSSFADE_S;
    const tl = gsap.timeline();
    tl.set(toEl, { autoAlpha: 0 }, 0)
      .to(toEl, { autoAlpha: 1, duration: d, ease: 'power1.inOut' }, 0)
      .to(fromEl, { autoAlpha: 0, duration: d, ease: 'power1.inOut' }, 0);
    await playToEnd(tl);
  }, []);

  // keeps the nav capsule gliding with the scene; the section it is heading for is the one
  // highlighted, so a jump from the intro to the wedding never lights up the journey
  const glidePanel = useCallback(
    async (from: SceneId, to: SceneId) => {
      const proxy = { v: sectionOf(from) as number };
      const target = sectionOf(to);
      const apply = () =>
        setUpdate({ progress: proxy.v / 2, panel: proxy.v, active: proxy.v === target ? undefined : target });
      const d = CROSSFADE_S;
      const tl = gsap.timeline();
      tl.to(proxy, {
        v: sectionOf(to),
        duration: d,
        ease: 'power2.inOut',
        onUpdate: apply,
      });
      await playToEnd(tl);
      proxy.v = sectionOf(to);
      apply();
    },
    [setUpdate],
  );

  const playMove = useCallback(
    async (move: Move, from: SceneState) => {
      const custom = playersRef.current.get(move.kind);
      if (SCENE_CHANGES.includes(move.kind)) {
        await Promise.all([
          glidePanel(from.scene, move.to.scene),
          custom
            ? custom(move, from)
            : crossfade(from.scene, move.to.scene),
        ]);
        return;
      }
      if (custom) await custom(move, from);
      else await wait(IN_SCENE_MS);
    },
    [crossfade, glidePanel],
  );

  const setInputLocked = useCallback((locked: boolean) => {
    lockedRef.current = locked;
    busyRef.current = locked;
    setBusy(locked);
  }, []);

  const run = useCallback(
    async (plan: readonly Move[]) => {
      if (busyRef.current || plan.length === 0) return;
      busyRef.current = true;
      setBusy(true);
      wheelGate.current.reset();
      try {
        for (const move of plan) {
          const from = stateRef.current;
          stateRef.current = move.to;
          setState(move.to);
          await playMove(move, from);
        }
      } finally {
        busyRef.current = lockedRef.current;
        setBusy(lockedRef.current);
      }
    },
    [playMove],
  );

  const step = useCallback(
    (dir: Direction) => void run(stepPlan(stateRef.current, dir)),
    [run],
  );
  const jumpTo = useCallback(
    (scene: SceneId) => void run(jumpPlan(stateRef.current, scene)),
    [run],
  );
  const setWindowOpen = useCallback(
    (open: boolean) => {
      const move = windowMove(stateRef.current, open);
      if (move) void run([move]);
    },
    [run],
  );
  const goToTab = useCallback(
    (tab: number) => {
      const move = tabMove(stateRef.current, tab);
      if (move) void run([move]);
    },
    [run],
  );

  // lets the stylesheet inset the top bar to sit inside the monitor's bezel
  useEffect(() => {
    document.documentElement.dataset.scenes = '';
    return () => {
      delete document.documentElement.dataset.scenes;
    };
  }, []);

  // the top bar's nav buttons command the engine through the same bridge the
  // pinned track used
  useEffect(() => {
    registerJump((section) => jumpTo(sceneOfSection(section)));
    setUpdate({ progress: 0, panel: 0 });
  }, [registerJump, jumpTo, setUpdate]);

  useEffect(() => {
    // Wheel goes through GSAP's Observer (it owns preventDefault and skips any
    // element marked data-scene-scroll, such as a scrolling window body).
    const wheel = Observer.create({
      target: window,
      type: 'wheel',
      preventDefault: true,
      ignore: '[data-scene-scroll]',
      onWheel: (self) => {
        if (busyRef.current) {
          wheelGate.current.reset();
          return;
        }
        const dir = wheelGate.current.push(self.deltaY, performance.now());
        if (dir) step(dir);
      },
    });

    // A scrolling pane (data-scene-scroll) keeps the wheel until it hits an
    // edge; Observer skips it, so this listener catches the edge case.
    const onPaneWheel = (e: WheelEvent) => {
      const pane =
        e.target instanceof Element
          ? e.target.closest<HTMLElement>('[data-scene-scroll]')
          : null;
      if (!pane || busyRef.current || e.deltaY === 0) return;
      const dir: Direction = e.deltaY > 0 ? 1 : -1;
      if (!atScrollEdge(pane, dir)) return;
      const step_ = wheelGate.current.push(e.deltaY, performance.now());
      if (step_) step(step_);
    };
    window.addEventListener('wheel', onPaneWheel, { passive: true });

    // Touch and keys are plain listeners: the swipe threshold and key map are
    // the same pure helpers the tests cover.
    let touchY: number | null = null;
    const onTouchStart = (e: TouchEvent) => {
      const target = e.target;
      touchY =
        target instanceof Element && target.closest('[data-scene-scroll]')
          ? null
          : e.touches[0].clientY;
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (touchY === null) return;
      const dir = swipeDirection(touchY, e.changedTouches[0].clientY);
      touchY = null;
      if (dir && !busyRef.current) step(dir);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (keyBelongsToTarget(e)) return;
      const dir = keyDirection(e.key, {
        ctrl: e.ctrlKey,
        meta: e.metaKey,
        alt: e.altKey,
      });
      if (!dir) return;
      // a scrolling pane that can still move in this direction keeps the key
      const pane = Array.from(
        document.querySelectorAll<HTMLElement>('[data-scene-scroll]'),
      ).find(
        (el) =>
          el.getClientRects().length > 0 &&
          getComputedStyle(el).visibility === 'visible',
      );
      if (pane && !atScrollEdge(pane, dir)) return;
      e.preventDefault();
      if (!busyRef.current) step(dir);
    };
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('keydown', onKeyDown);

    return () => {
      wheel.kill();
      window.removeEventListener('wheel', onPaneWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [step]);

  const value = useMemo<SceneContextValue>(
    () => ({
      state,
      busy,
      setInputLocked,
      step,
      jumpTo,
      setWindowOpen,
      goToTab,
      registerScene,
      registerPlayer,
    }),
    [
      state,
      busy,
      setInputLocked,
      step,
      jumpTo,
      setWindowOpen,
      goToTab,
      registerScene,
      registerPlayer,
    ],
  );

  return <SceneContext.Provider value={value}>{children}</SceneContext.Provider>;
}

export function useScene(): SceneContextValue {
  const context = useContext(SceneContext);
  if (!context) throw new Error('useScene must be used within SceneProvider');
  return context;
}
