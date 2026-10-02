import type { PrismaClient } from '../../generated/prisma/client';
import type { ParsedGuestRows } from './parse-rows';

export type GuestUpsertResult = { partiesUpserted: number; guestsUpserted: number };

// Shared by prisma/seed.ts and the Sheets sync routes, so the two ways
// guest data enters the database (a one-time seed, a live webhook) can
// never drift apart. Upserts by externalId only — never deletes; removals
// are handled separately by the admin "Sync now" full pull, which archives
// rather than deletes (docs/BUILD_PLAN.md "Sheet -> DB"). A guest that
// reappears in the sheet after being archived is un-archived here, since
// re-adding a removed row is the couple's way of saying "this was a
// mistake" — no 'server-only' import: prisma/seed.ts runs under tsx,
// outside Next's bundler, where that guard throws unconditionally.
export async function upsertGuestRows(prisma: PrismaClient, parsed: ParsedGuestRows): Promise<GuestUpsertResult> {
  for (const party of parsed.parties) {
    await prisma.party.upsert({
      where: { externalId: party.externalId },
      create: { externalId: party.externalId, label: party.label },
      update: { label: party.label },
    });
  }

  for (const guest of parsed.guests) {
    const party = await prisma.party.findUniqueOrThrow({ where: { externalId: guest.partyExternalId } });
    await prisma.guest.upsert({
      where: { externalId: guest.externalId },
      create: {
        externalId: guest.externalId,
        firstName: guest.firstName,
        lastName: guest.lastName,
        nickname: guest.nickname,
        side: guest.side,
        notesPrivate: guest.notesPrivate,
        partyId: party.id,
      },
      update: {
        firstName: guest.firstName,
        lastName: guest.lastName,
        nickname: guest.nickname,
        side: guest.side,
        notesPrivate: guest.notesPrivate,
        partyId: party.id,
        archivedAt: null,
      },
    });
  }

  return { partiesUpserted: parsed.parties.length, guestsUpserted: parsed.guests.length };
}
