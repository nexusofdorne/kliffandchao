import { describe, expect, it } from 'vitest';
import { gateDestination, isGateArrival } from './arrival';

describe('gateDestination', () => {
  it('flags the story so the arrival sequence knows to play', () => {
    expect(gateDestination('/story')).toBe('/story?arrival=gate');
  });

  it('leaves any other destination alone', () => {
    expect(gateDestination('/rsvp')).toBe('/rsvp');
    expect(gateDestination('/story/extra')).toBe('/story/extra');
  });
});

describe('isGateArrival', () => {
  it('accepts only the exact flag', () => {
    expect(isGateArrival('gate')).toBe(true);
    expect(isGateArrival('Gate')).toBe(false);
    expect(isGateArrival('')).toBe(false);
    expect(isGateArrival(null)).toBe(false);
    expect(isGateArrival(undefined)).toBe(false);
  });
});
