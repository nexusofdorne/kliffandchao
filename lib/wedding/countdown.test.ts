import { describe, expect, it } from 'vitest';
import { computeCountdown } from './countdown';

describe('computeCountdown', () => {
  it('is all zeros once the target has passed', () => {
    const target = new Date('2027-03-05T16:00:00+08:00');
    const now = new Date('2027-03-05T16:00:01+08:00');
    expect(computeCountdown(target, now)).toEqual({ months: 0, days: 0, hours: 0, minutes: 0, seconds: 0 });
  });

  it('is all zeros at the exact target instant', () => {
    const target = new Date('2027-03-05T16:00:00+08:00');
    expect(computeCountdown(target, target)).toEqual({ months: 0, days: 0, hours: 0, minutes: 0, seconds: 0 });
  });

  it('counts whole calendar months, not days/30', () => {
    // Exactly 2 calendar months before the target, same day/time.
    const target = new Date('2027-03-05T16:00:00+08:00');
    const now = new Date('2027-01-05T16:00:00+08:00');
    const result = computeCountdown(target, now);
    expect(result.months).toBe(2);
    expect(result.days).toBe(0);
    expect(result.hours).toBe(0);
  });

  it('backs off one month when the naive anchor overshoots the target', () => {
    // From Jan 31st, "+1 month" normally lands on March 3rd in JS (Feb has
    // no 31st) — past a March 5th target by calendar-month arithmetic one
    // month out, so this exercises the overshoot correction.
    const target = new Date('2027-03-05T16:00:00+08:00');
    const now = new Date('2027-01-31T16:00:00+08:00');
    const result = computeCountdown(target, now);
    expect(result.months).toBe(1);
  });

  it('rolls the remainder into days/hours/minutes/seconds within the final month', () => {
    const target = new Date('2027-03-05T16:00:00+08:00');
    const now = new Date('2027-03-04T14:58:59+08:00'); // 1 day, 1 hour, 1 minute, 1 second before
    const result = computeCountdown(target, now);
    expect(result.months).toBe(0);
    expect(result.days).toBe(1);
    expect(result.hours).toBe(1);
    expect(result.minutes).toBe(1);
    expect(result.seconds).toBe(1);
  });

  // local-time dates, so these hold in any time zone the tests run in
  it('counts from a month-end day to the last day of a shorter month', () => {
    const target = new Date(2027, 2, 5, 16, 0, 0);
    // Oct 31 + 4 months is Feb 28, then 5 days to Mar 5 (not "Feb 31" = Mar 3 and 2 days)
    expect(computeCountdown(target, new Date(2026, 9, 31, 16, 0, 0))).toMatchObject({ months: 4, days: 5, hours: 0 });
    // Oct 30 + 4 months is Feb 28 too
    expect(computeCountdown(target, new Date(2026, 9, 30, 16, 0, 0))).toMatchObject({ months: 4, days: 5, hours: 0 });
    expect(computeCountdown(target, new Date(2026, 10, 5, 16, 0, 0))).toMatchObject({ months: 4, days: 0 });
  });

  it('never goes up as time passes', () => {
    const target = new Date(2027, 2, 5, 16, 0, 0);
    const total = (c: ReturnType<typeof computeCountdown>) => c.months * 100 + c.days;
    let previous = Infinity;
    for (let t = new Date(2026, 8, 1, 16).getTime(); t < target.getTime(); t += 86400000) {
      const value = total(computeCountdown(target, new Date(t)));
      expect(value).toBeLessThanOrEqual(previous);
      previous = value;
    }
  });
});
