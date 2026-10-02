export type Countdown = { months: number; days: number; hours: number; minutes: number; seconds: number };

// Months are counted by calendar, not by dividing days — days/30 drifts
// against the wall calendar and disagrees with what a guest's own phone
// shows them. Step `now` forward month-by-month toward the target, back off
// one if that overshoots, then take the remainder in days/hours/minutes/
// seconds — prototype/index.html's tickCountdown().
export function computeCountdown(target: Date, now: Date): Countdown {
  if (target.getTime() <= now.getTime()) {
    return { months: 0, days: 0, hours: 0, minutes: 0, seconds: 0 };
  }

  let months = (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth());
  const anchor = new Date(now);
  anchor.setMonth(now.getMonth() + months);
  if (anchor > target) {
    months -= 1;
    anchor.setMonth(anchor.getMonth() - 1);
  }

  const remainingSeconds = (target.getTime() - anchor.getTime()) / 1000;
  const days = Math.floor(remainingSeconds / 86400);
  const hours = Math.floor((remainingSeconds % 86400) / 3600);
  const minutes = Math.floor((remainingSeconds % 3600) / 60);
  const seconds = Math.floor(remainingSeconds % 60);

  return { months, days, hours, minutes, seconds };
}
