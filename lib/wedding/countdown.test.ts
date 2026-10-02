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
});
