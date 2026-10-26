import { describe, expect, it } from 'vitest';
import {
  finishPercent,
  HOLD_PERCENT,
  rampPercent,
  typedPrefix,
} from './terminal';

describe('rampPercent', () => {
  it('runs from 0 to the hold level', () => {
    expect(rampPercent(0)).toBe(0);
    expect(rampPercent(1)).toBe(HOLD_PERCENT);
  });

  it('never goes backwards and never passes the hold level', () => {
    let last = 0;
    for (let i = 0; i <= 200; i++) {
      const p = rampPercent(i / 200);
      expect(p).toBeGreaterThanOrEqual(last);
      expect(p).toBeLessThanOrEqual(HOLD_PERCENT);
      last = p;
    }
  });

  it('stalls somewhere along the way, like a real loader', () => {
    const values = Array.from({ length: 101 }, (_, i) => rampPercent(i / 100));
    const flats = values.filter((v, i) => i > 0 && v === values[i - 1]);
    expect(flats.length).toBeGreaterThan(0);
  });

  it('clamps out-of-range input', () => {
    expect(rampPercent(-3)).toBe(0);
    expect(rampPercent(9)).toBe(HOLD_PERCENT);
  });
});

describe('finishPercent', () => {
  it('goes from the hold level to 100', () => {
    expect(finishPercent(0)).toBe(HOLD_PERCENT);
    expect(finishPercent(0.5)).toBe(95);
    expect(finishPercent(1)).toBe(100);
    expect(finishPercent(5)).toBe(100);
  });
});

describe('typedPrefix', () => {
  it('returns the first n characters', () => {
    expect(typedPrefix('hello', 3)).toBe('hel');
    expect(typedPrefix('hello', 0)).toBe('');
    expect(typedPrefix('hello', 99)).toBe('hello');
    expect(typedPrefix('hello', -2)).toBe('');
  });

  it('does not split a character made of two code units', () => {
    expect(typedPrefix('a💚b', 2)).toBe('a💚');
  });
});
