import { describe, expect, it } from 'vitest';
import { searchGuests } from '../../lib/search/match';
import { testPrisma } from './client';

// The real misspelling list from docs/BUILD_PLAN.md "Guest search" — edit
// distance can't catch these (e.g. "Co" -> "Kho" is distance 2 on a
// 3-letter word), which is exactly why dmetaphone is in the scoring ladder.
const MISSPELLING_PAIRS: [misspelled: string, realSurname: string][] = [
  ['Co', 'Kho'],
  ['Chow', 'Chao'],
  ['See', 'Sy'],
  ['Wy', 'Uy'],
  ['Dee', 'Dy'],
  ['Ong', 'Ang'],
];

describe('searchGuests against the misspelling list', () => {
  it.each(MISSPELLING_PAIRS)('"%s" finds a %s guest', async (misspelled, realSurname) => {
    const results = await searchGuests(testPrisma, misspelled);
    expect(results.some((result) => result.displayName.includes(realSurname))).toBe(true);
  });
});

describe('searchGuests against nicknames', () => {
  it.each([
    ['Mon', 'Ramon'],
    ['Char', 'Charmaine'],
    ['Liga', 'Ligaya'],
    ['Danny', 'Daniel'],
  ])('"%s" finds the guest it nicknames (%s)', async (nickname, firstName) => {
    const results = await searchGuests(testPrisma, nickname);
    expect(results.some((result) => result.displayName.includes(firstName))).toBe(true);
  });
});

describe('searchGuests result shape', () => {
  it('returns only { id, displayName } — never partyLabel or notes', async () => {
    const results = await searchGuests(testPrisma, 'Kho');
    expect(results.length).toBeGreaterThan(0);
    for (const result of results) {
      expect(Object.keys(result).sort()).toEqual(['displayName', 'id']);
    }
  });

  it('caps results at 8', async () => {
    // A single-letter query should be broad enough to exceed the cap.
    const results = await searchGuests(testPrisma, 'an');
    expect(results.length).toBeLessThanOrEqual(8);
  });
});
