// How a guest arrives on /story decides what plays first (docs/REDESIGN_PLAN.md
// decision 11): straight from the gate's dive into the monitor, or any other way
// (a returning cookie, a reload, "back to home" from RSVP).

export const ARRIVAL_PARAM = 'arrival';
export const ARRIVAL_FROM_GATE = 'gate';

/**
 * Where the gate sends the guest after the dive. Only the story itself gets
 * the arrival flag: a guest who followed a link to /rsvp lands there as before.
 */
export function gateDestination(next: string): string {
  return next === '/story'
    ? `/story?${ARRIVAL_PARAM}=${ARRIVAL_FROM_GATE}`
    : next;
}

/** True for the flag the gate adds, and nothing else. */
export function isGateArrival(value: string | null | undefined): boolean {
  return value === ARRIVAL_FROM_GATE;
}
