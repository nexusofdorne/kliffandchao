// What /api/guests/search shows for a match — never partyLabel, which would
// reveal family structure to a stranger (docs/PLAN.md "Name matching").
export function buildDisplayName(firstName: string, lastName: string, nickname: string | null): string {
  return nickname ? `${firstName} "${nickname}" ${lastName}` : `${firstName} ${lastName}`;
}
