import { describe, expect, it } from 'vitest';
import { computeAttendanceTally } from './stats';

describe('computeAttendanceTally', () => {
  it('counts a guest with no current answer as pending, not not-attending', () => {
    const tally = computeAttendanceTally([{ status: null }], 1);
    expect(tally).toMatchObject({ invited: 1, attending: 0, notAttending: 0, pending: 1 });
  });

  it('tallies a mix of attending, not attending and pending across households', () => {
    const tally = computeAttendanceTally(
      [{ status: 'ATTENDING' }, { status: 'ATTENDING' }, { status: 'NOT_ATTENDING' }, { status: null }],
      3,
    );
    expect(tally).toEqual({ invited: 4, households: 3, attending: 2, notAttending: 1, pending: 1 });
  });

  it('handles an empty guest list', () => {
    expect(computeAttendanceTally([], 0)).toEqual({
      invited: 0,
      households: 0,
      attending: 0,
      notAttending: 0,
      pending: 0,
    });
  });
});
