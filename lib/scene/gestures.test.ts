import { describe, expect, it } from 'vitest';
import {
  createWheelGate,
  keyDirection,
  swipeDirection,
  WHEEL_QUIET_MS,
} from './gestures';

describe('createWheelGate', () => {
  it('ignores small nudges and fires once the delta passes the threshold', () => {
    const gate = createWheelGate();
    expect(gate.push(10, 0)).toBeNull();
    expect(gate.push(10, 20)).toBeNull();
    expect(gate.push(30, 40)).toBe(1);
  });

  it('reports the direction of the accumulated delta', () => {
    const gate = createWheelGate();
    expect(gate.push(-120, 0)).toBe(-1);
  });

  it('swallows a trackpad inertia tail until the stream goes quiet', () => {
    const gate = createWheelGate();
    expect(gate.push(100, 0)).toBe(1);
    // a fading tail of events, each closer together than the quiet period
    for (let t = 16; t < 600; t += 16) {
      expect(gate.push(60, t)).toBeNull();
    }
    // the stream pauses, then a deliberate new gesture fires again
    expect(gate.push(100, 600 + WHEEL_QUIET_MS + 1)).toBe(1);
  });

  it('does not let swallowed events pile up into the next step', () => {
    const gate = createWheelGate();
    gate.push(100, 0);
    gate.push(500, 50);
    gate.push(500, 100);
    // first event after the pause starts from zero: 30 is below the threshold
    expect(gate.push(30, 100 + WHEEL_QUIET_MS + 10)).toBeNull();
  });

  it('can be reset mid-gesture', () => {
    const gate = createWheelGate();
    gate.push(30, 0);
    gate.reset();
    expect(gate.push(30, 10)).toBeNull();
  });
});

describe('swipeDirection', () => {
  it('maps a swipe up to forward and a swipe down to back', () => {
    expect(swipeDirection(500, 300)).toBe(1);
    expect(swipeDirection(300, 500)).toBe(-1);
  });

  it('ignores short drags', () => {
    expect(swipeDirection(500, 470)).toBeNull();
  });
});

describe('keyDirection', () => {
  it.each([
    ['ArrowDown', 1],
    ['PageDown', 1],
    [' ', 1],
    ['ArrowUp', -1],
    ['PageUp', -1],
  ] as const)('maps %s to %i', (key, dir) => {
    expect(keyDirection(key)).toBe(dir);
  });

  it('ignores other keys and modified presses', () => {
    expect(keyDirection('a')).toBeNull();
    expect(keyDirection('ArrowDown', { meta: true })).toBeNull();
    expect(keyDirection(' ', { ctrl: true })).toBeNull();
  });
});
