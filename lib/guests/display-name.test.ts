import { describe, expect, it } from 'vitest';
import { buildDisplayName } from './display-name';

describe('buildDisplayName', () => {
  it('shows just the plain name when there is no nickname', () => {
    expect(buildDisplayName('Benjamin', 'Kho', null)).toBe('Benjamin Kho');
  });

  it('includes the nickname in quotes when present', () => {
    expect(buildDisplayName('Ramon', 'Kho', 'Mon')).toBe('Ramon "Mon" Kho');
  });
});
