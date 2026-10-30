import { describe, expect, it } from 'vitest';
import {
  initialState,
  jumpPlan,
  sceneOfSection,
  sectionOf,
  settle,
  stepPlan,
  tabMove,
  windowMove,
  WEDDING_TABS,
  type SceneId,
  type SceneState,
} from './machine';

const kinds = (moves: readonly { kind: string }[]) => moves.map((m) => m.kind);

const inJourney = (over: Partial<SceneState> = {}): SceneState => ({
  ...initialState,
  scene: 'journey',
  ...over,
});

describe('stepPlan', () => {
  it('does nothing when scrolling back from the intro', () => {
    expect(stepPlan(initialState, -1)).toEqual([]);
  });

  it('enters the journey from the intro and then opens its window', () => {
    const plan = stepPlan(initialState, 1);
    expect(kinds(plan)).toEqual(['intro->journey', 'journey-open']);
    expect(settle(initialState, plan)).toMatchObject({
      scene: 'journey',
      journeyOpen: true,
      journeyTab: 1,
    });
  });

  it('does not reopen a window that is already open', () => {
    const state: SceneState = { ...initialState, journeyOpen: true };
    expect(kinds(stepPlan(state, 1))).toEqual(['intro->journey']);
  });

  it('steps through the five tabs while the window is open', () => {
    let state = inJourney({ journeyOpen: true });
    for (let tab = 2; tab <= 5; tab++) {
      const plan = stepPlan(state, 1);
      expect(kinds(plan)).toEqual(['journey-tab']);
      state = settle(state, plan);
      expect(state.journeyTab).toBe(tab);
    }
  });

  it('leaves the journey for the wedding after the last tab, and opens its window', () => {
    const state = inJourney({ journeyOpen: true, journeyTab: 5 });
    const plan = stepPlan(state, 1);
    expect(kinds(plan)).toEqual(['journey->wedding', 'wedding-open']);
    expect(plan[1].auto).toBe(true);
    expect(settle(state, plan).weddingOpen).toBe(true);
  });

  it('leaves the journey for the intro before the first tab', () => {
    const state = inJourney({ journeyOpen: true, journeyTab: 1 });
    expect(kinds(stepPlan(state, -1))).toEqual(['journey->intro']);
  });

  it('skips the tabs when the window is closed', () => {
    const state = inJourney({ journeyOpen: false, journeyTab: 3 });
    expect(kinds(stepPlan(state, 1))).toEqual([
      'journey->wedding',
      'wedding-open',
    ]);
    expect(kinds(stepPlan(state, -1))).toEqual(['journey->intro']);
  });

  it('steps through the open wedding window tabs, and stops at either end', () => {
    const open: SceneState = {
      ...initialState,
      scene: 'wedding',
      weddingOpen: true,
      weddingTab: 1,
    };
    expect(stepPlan(open, 1)).toEqual([
      { kind: 'wedding-tab', to: { ...open, weddingTab: 2 } },
    ]);
    expect(stepPlan(open, -1)).toEqual([]);
    const last: SceneState = { ...open, weddingTab: WEDDING_TABS };
    expect(stepPlan(last, 1)).toEqual([]);
    expect(stepPlan(last, -1)).toEqual([
      { kind: 'wedding-tab', to: { ...last, weddingTab: WEDDING_TABS - 1 } },
    ]);
  });

  it('moves to a clicked wedding tab only while its window is open', () => {
    const open: SceneState = {
      ...initialState,
      scene: 'wedding',
      weddingOpen: true,
      weddingTab: 1,
    };
    expect(tabMove(open, 6)).toEqual({
      kind: 'wedding-tab',
      to: { ...open, weddingTab: 6 },
    });
    expect(tabMove(open, 1)).toBeNull();
    expect(tabMove({ ...open, weddingOpen: false }, 3)).toBeNull();
  });

  it('stays at the wedding when scrolling either way (the nav goes back)', () => {
    // reached by scrolling, so the journey window was open on its last tab
    const state: SceneState = {
      ...initialState,
      scene: 'wedding',
      journeyOpen: true,
      journeyTab: 5,
    };
    expect(stepPlan(state, -1)).toEqual([]);
    expect(stepPlan(state, 1)).toEqual([]);
    expect(kinds(jumpPlan(state, 'journey'))).toEqual(['wedding->journey']);
  });

  it('remembers the journey tab across a trip to the wedding and back', () => {
    let state = inJourney({ journeyOpen: true, journeyTab: 5 });
    state = settle(state, stepPlan(state, 1));
    state = settle(state, jumpPlan(state, 'journey'));
    expect(state).toMatchObject({
      scene: 'journey',
      journeyOpen: true,
      journeyTab: 5,
    });
  });
});

describe('jumpPlan', () => {
  it('does nothing for the scene already showing', () => {
    expect(jumpPlan(initialState, 'intro')).toEqual([]);
  });

  it('opens the journey window when jumping there from the intro', () => {
    expect(kinds(jumpPlan(initialState, 'journey'))).toEqual([
      'intro->journey',
      'journey-open',
    ]);
  });

  it('goes from the intro straight to the wedding (no stop at the journey), then opens it', () => {
    const plan = jumpPlan(initialState, 'wedding');
    expect(kinds(plan)).toEqual(['intro->wedding', 'wedding-open']);
    expect(plan[1].auto).toBe(true);
    expect(settle(initialState, plan)).toMatchObject({
      scene: 'wedding',
      weddingOpen: true,
      journeyOpen: false,
    });
  });

  it('goes from the wedding straight back to the intro', () => {
    const state: SceneState = {
      ...initialState,
      scene: 'wedding',
      weddingOpen: true,
    };
    const plan = jumpPlan(state, 'intro');
    expect(kinds(plan)).toEqual(['wedding->intro']);
    expect(settle(state, plan)).toMatchObject({
      scene: 'intro',
      weddingOpen: false,
      journeyOpen: false,
    });
  });

  it('opens the journey window on the way back from the wedding when it was never opened', () => {
    const state: SceneState = {
      ...initialState,
      scene: 'wedding',
      journeyOpen: false,
    };
    expect(kinds(jumpPlan(state, 'journey'))).toEqual([
      'wedding->journey',
      'journey-open',
    ]);
    const open: SceneState = { ...state, journeyOpen: true, journeyTab: 5 };
    expect(kinds(jumpPlan(open, 'journey'))).toEqual(['wedding->journey']);
  });

  it('never passes through the journey on a jump between the intro and the wedding', () => {
    const scenes = (start: SceneState, target: SceneId) =>
      jumpPlan(start, target).map((m) => m.to.scene);
    expect(scenes(initialState, 'wedding')).not.toContain('journey');
    expect(
      scenes({ ...initialState, scene: 'wedding' }, 'intro'),
    ).not.toContain('journey');
  });

  it('closes the journey window and forgets the tab when leaving for the intro', () => {
    const state = inJourney({ journeyOpen: true, journeyTab: 4 });
    const after = settle(state, stepPlan({ ...state, journeyTab: 1 }, -1));
    expect(after).toMatchObject({
      scene: 'intro',
      journeyOpen: false,
      journeyTab: 1,
    });
    const viaJump = settle(
      { ...state, scene: 'wedding' },
      jumpPlan({ ...state, scene: 'wedding' }, 'intro'),
    );
    expect(viaJump).toMatchObject({ journeyOpen: false, journeyTab: 1 });
  });

  it('closes the wedding window when flying back to the journey', () => {
    const state: SceneState = {
      ...initialState,
      scene: 'wedding',
      weddingOpen: true,
    };
    expect(settle(state, jumpPlan(state, 'journey'))).toMatchObject({
      scene: 'journey',
      weddingOpen: false,
    });
  });

  it('marks the window opening that follows an arrival as automatic', () => {
    const [, open] = stepPlan(initialState, 1);
    expect(open.auto).toBe(true);
    expect(windowMove(inJourney(), true)?.auto).toBeUndefined();
  });

  it('does not touch the journey window when jumping back to it', () => {
    const state: SceneState = {
      ...initialState,
      scene: 'wedding',
      journeyOpen: true,
      journeyTab: 4,
    };
    const plan = jumpPlan(state, 'journey');
    expect(kinds(plan)).toEqual(['wedding->journey']);
    expect(settle(state, plan).journeyTab).toBe(4);
  });
});

describe('windowMove and tabMove', () => {
  it('opens and closes the journey window', () => {
    const closed = inJourney();
    const open = windowMove(closed, true);
    expect(open).toMatchObject({
      kind: 'journey-open',
      to: { journeyOpen: true },
    });
    expect(windowMove(open!.to, false)).toMatchObject({
      kind: 'journey-close',
      to: { journeyOpen: false },
    });
  });

  it('opens and closes the wedding window', () => {
    const state: SceneState = { ...initialState, scene: 'wedding' };
    expect(windowMove(state, true)).toMatchObject({ kind: 'wedding-open' });
    expect(windowMove({ ...state, weddingOpen: true }, false)).toMatchObject({
      kind: 'wedding-close',
    });
  });

  it('returns null when the window is already as asked, or in the intro', () => {
    expect(windowMove(inJourney(), false)).toBeNull();
    expect(windowMove(initialState, true)).toBeNull();
  });

  it('moves to a clicked tab only while the journey window is open', () => {
    expect(tabMove(inJourney(), 3)).toBeNull();
    const open = inJourney({ journeyOpen: true });
    expect(tabMove(open, 3)).toMatchObject({ to: { journeyTab: 3 } });
    expect(tabMove(open, 1)).toBeNull();
    expect(tabMove(open, 99)).toMatchObject({ to: { journeyTab: 5 } });
  });
});

describe('sections', () => {
  it('maps scenes to nav sections and back', () => {
    expect(sectionOf('intro')).toBe(0);
    expect(sectionOf('journey')).toBe(1);
    expect(sectionOf('wedding')).toBe(2);
    expect(sceneOfSection(2)).toBe('wedding');
  });
});
