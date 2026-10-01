import { createHash } from 'node:crypto';
import type { RsvpResponseInput } from '../validation';

export function hasDuplicateGuestIds(responses: RsvpResponseInput[]): boolean {
  const ids = responses.map((response) => response.guestId);
  return new Set(ids).size !== ids.length;
}

// Returns the first guestId not in the submitter's own party, or null if
// every response targets a party member. docs/PLAN.md "Validation on POST
// /api/rsvp": the server derives the allowed set from submittedByGuestId,
// never trusts a client-supplied partyId.
export function findGuestOutsideParty(responses: RsvpResponseInput[], partyMemberIds: ReadonlySet<string>): string | null {
  const outside = responses.find((response) => !partyMemberIds.has(response.guestId));
  return outside?.guestId ?? null;
}

export function isPastDeadline(now: Date, deadline: Date): boolean {
  return now.getTime() >= deadline.getTime();
}

// IP addresses aren't logged raw — only a salted hash, enough to spot abuse
// patterns without storing something that identifies a guest on its own.
export function hashIp(ip: string, salt: string): string {
  return createHash('sha256').update(`${ip}:${salt}`).digest('hex');
}
