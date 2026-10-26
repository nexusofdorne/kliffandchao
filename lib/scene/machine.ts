// The desktop story as a small state machine: which scene is showing, and what
// a scroll step, a nav click or a window button should do next. Pure, so the
// rules from prototype-v3/app.js onScroll()/goTo() are unit tested; the
// SceneProvider plays whatever moves this returns.

export type SceneId = 'intro' | 'journey' | 'wedding';

export const SCENES: readonly SceneId[] = ['intro', 'journey', 'wedding'];
export const JOURNEY_TABS = 5;

export interface SceneState {
  readonly scene: SceneId;
  /** The journey window is open (false = the folder icon on the meadow). */
  readonly journeyOpen: boolean;
  /** Active journey chapter, 1..JOURNEY_TABS. Remembered while elsewhere. */
  readonly journeyTab: number;
  readonly weddingOpen: boolean;
}

export type MoveKind =
  | 'intro->journey'
  | 'journey->intro'
  | 'journey->wedding'
  | 'wedding->journey'
  | 'journey-tab'
  | 'journey-open'
  | 'journey-close'
  | 'wedding-open'
  | 'wedding-close';

export interface Move {
  readonly kind: MoveKind;
  /** The state once the move has played. */
  readonly to: SceneState;
  /** Part of a longer hop (a nav jump across a scene): skip the flourish. */
  readonly quick?: boolean;
  /** Opening the window as part of arriving (the cursor does it), not a click. */
  readonly auto?: boolean;
}

export const initialState: SceneState = {
  scene: 'intro',
  journeyOpen: false,
  journeyTab: 1,
  weddingOpen: false,
};

/** 0, 1 or 2: the nav capsule's position and the active section. */
export function sectionOf(scene: SceneId): 0 | 1 | 2 {
  return SCENES.indexOf(scene) as 0 | 1 | 2;
}

export function sceneOfSection(section: 0 | 1 | 2): SceneId {
  return SCENES[section];
}

const clampTab = (tab: number) =>
  Math.min(JOURNEY_TABS, Math.max(1, Math.round(tab)));

/**
 * What one scroll / swipe / arrow key does. `dir` is +1 for "further into the
 * story". Entering the journey also opens its window (the cursor flourish),
 * so that comes back as a second move.
 */
export function stepPlan(state: SceneState, dir: 1 | -1): Move[] {
  if (state.scene === 'intro') {
    return dir > 0 ? enterJourney(state) : [];
  }
  if (state.scene === 'journey') {
    if (state.journeyOpen) {
      const next = state.journeyTab + dir;
      if (next >= 1 && next <= JOURNEY_TABS) {
        return [
          {
            kind: 'journey-tab',
            to: { ...state, journeyTab: next },
          },
        ];
      }
    }
    return dir > 0
      ? [{ kind: 'journey->wedding', to: { ...state, scene: 'wedding' } }]
      : [{ kind: 'journey->intro', to: leaveJourney(state) }];
  }
  // wedding: nothing lies beyond it
  return dir < 0
    ? [{ kind: 'wedding->journey', to: leaveWedding(state) }]
    : [];
}

function enterJourney(state: SceneState): Move[] {
  const arrived: SceneState = { ...state, scene: 'journey' };
  const moves: Move[] = [{ kind: 'intro->journey', to: arrived }];
  if (!state.journeyOpen) {
    moves.push({
      kind: 'journey-open',
      to: { ...arrived, journeyOpen: true },
      auto: true,
    });
  }
  return moves;
}

// Going back out through the screen closes the window and forgets the tab; the
// next arrival opens it again from chapter 1 (prototype reset04).
function leaveJourney(state: SceneState): SceneState {
  return { ...state, scene: 'intro', journeyOpen: false, journeyTab: 1 };
}

/** A nav click: hop scene by scene, skipping the flourish on the way past. */
export function jumpPlan(state: SceneState, target: SceneId): Move[] {
  const from = sectionOf(state.scene);
  const to = sectionOf(target);
  if (from === to) return [];
  const dir = to > from ? 1 : -1;
  const moves: Move[] = [];
  let cur = state;
  for (let at = from; at !== to; at += dir) {
    const hop = hopFrom(cur, dir);
    const isLast = at + dir === to;
    moves.push(isLast ? hop : { ...hop, quick: true });
    cur = hop.to;
  }
  // arriving at the journey from the intro opens its window, as a scroll would
  if (state.scene === 'intro' && target === 'journey' && !cur.journeyOpen) {
    moves.push({
      kind: 'journey-open',
      to: { ...cur, journeyOpen: true },
      auto: true,
    });
  }
  return moves;
}

// Flying back to the meadow closes the wedding window; the journey keeps its own.
function leaveWedding(state: SceneState): SceneState {
  return { ...state, scene: 'journey', weddingOpen: false };
}

function hopFrom(state: SceneState, dir: 1 | -1): Move {
  const kinds: Record<string, MoveKind> = {
    'intro:1': 'intro->journey',
    'journey:1': 'journey->wedding',
    'journey:-1': 'journey->intro',
    'wedding:-1': 'wedding->journey',
  };
  const kind = kinds[`${state.scene}:${dir}`];
  const next = SCENES[SCENES.indexOf(state.scene) + dir];
  return {
    kind,
    to:
      kind === 'journey->intro'
        ? leaveJourney(state)
        : kind === 'wedding->journey'
          ? leaveWedding(state)
          : { ...state, scene: next },
  };
}

/** The folder or the window's red dot. Null when it would change nothing. */
export function windowMove(
  state: SceneState,
  open: boolean,
): Move | null {
  if (state.scene === 'journey' && state.journeyOpen !== open) {
    return {
      kind: open ? 'journey-open' : 'journey-close',
      to: { ...state, journeyOpen: open },
    };
  }
  if (state.scene === 'wedding' && state.weddingOpen !== open) {
    return {
      kind: open ? 'wedding-open' : 'wedding-close',
      to: { ...state, weddingOpen: open },
    };
  }
  return null;
}

/** A tab was clicked in the open journey window. */
export function tabMove(state: SceneState, tab: number): Move | null {
  const next = clampTab(tab);
  if (state.scene !== 'journey' || !state.journeyOpen) return null;
  if (next === state.journeyTab) return null;
  return { kind: 'journey-tab', to: { ...state, journeyTab: next } };
}

/** The state after a whole plan has played. */
export function settle(state: SceneState, plan: readonly Move[]): SceneState {
  return plan.length ? plan[plan.length - 1].to : state;
}
