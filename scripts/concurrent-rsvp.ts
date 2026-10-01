// Fires 5 concurrent POST /api/rsvp requests for one household, per
// docs/BUILD_PLAN.md Phase 3's "done when": five submissions, one coherent
// GuestRsvp state, nothing lost. Needs `npm run dev` already running.
import { randomUUID } from 'node:crypto';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const PASSWORD = 'kliffandchao';
const HOUSEHOLD_SEARCH_QUERY = 'Kho'; // Kho Family, seeded in Phase 1
const SUBMISSION_COUNT = 5;

async function login(): Promise<string> {
  const response = await fetch(`${BASE_URL}/api/gate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: PASSWORD }),
  });
  const cookie = response.headers.get('set-cookie');
  if (!response.ok || !cookie) {
    throw new Error(`Login failed: HTTP ${response.status}`);
  }
  return cookie.split(';')[0];
}

// Discovers real guest ids the same way a guest would: search, then load
// the party of the first match — never hardcode ids, which are opaque
// cuids, not the seed CSV's external "g01"-style identifiers.
async function loadHouseholdGuestIds(cookie: string): Promise<string[]> {
  const searchResponse = await fetch(
    `${BASE_URL}/api/guests/search?q=${encodeURIComponent(HOUSEHOLD_SEARCH_QUERY)}`,
    { headers: { Cookie: cookie } },
  );
  const matches: { id: string }[] = await searchResponse.json();
  if (matches.length === 0) {
    throw new Error(`No guest matched "${HOUSEHOLD_SEARCH_QUERY}"`);
  }

  const partyResponse = await fetch(`${BASE_URL}/api/party?guestId=${matches[0].id}`, {
    headers: { Cookie: cookie },
  });
  const party: { members: { id: string }[] } = await partyResponse.json();
  return party.members.map((member) => member.id);
}

async function submit(cookie: string, guestIds: string[], index: number) {
  const body = {
    submittedByGuestId: guestIds[index % guestIds.length],
    responses: guestIds.map((guestId, memberIndex) => ({
      guestId,
      status: (index + memberIndex) % 2 === 0 ? 'ATTENDING' : 'NOT_ATTENDING',
    })),
    message: `Concurrent test submission #${index}`,
    clientSubmissionId: randomUUID(),
  };

  const response = await fetch(`${BASE_URL}/api/rsvp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify(body),
  });

  return { index, status: response.status, body: await response.json() };
}

async function main() {
  const cookie = await login();
  const guestIds = await loadHouseholdGuestIds(cookie);
  console.log(`Submitting for household: ${guestIds.join(', ')}`);

  const indices = Array.from({ length: SUBMISSION_COUNT }, (_, index) => index);
  const results = await Promise.all(indices.map((index) => submit(cookie, guestIds, index)));

  for (const result of results) {
    console.log(`#${result.index}: HTTP ${result.status}`, JSON.stringify(result.body.deduped ?? result.body));
  }

  const submitted = results.filter((result) => result.status === 200).length;
  console.log(`\n${submitted}/${SUBMISSION_COUNT} succeeded. Check GuestRsvp in Prisma Studio for coherence.`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
