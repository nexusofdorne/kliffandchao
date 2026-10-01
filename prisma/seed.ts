import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaPg } from '@prisma/adapter-pg';
import { parseCsv } from '../lib/csv';
import { parseGuestRows } from '../lib/guests/parse-rows';
import { PrismaClient } from '../generated/prisma/client';

// A standalone client, not lib/prisma.ts's singleton: this script runs via
// `tsx` outside Next's bundler, and lib/prisma.ts starts with
// `import 'server-only'`, which unconditionally throws unless a bundler
// swaps it out — there's no such swap here. Same reasoning as
// prisma.config.ts reading process.env directly instead of lib/env.ts.
//
// DIRECT_URL, not DATABASE_URL: a one-shot seed doesn't need pooling, and
// some networks can't reach Supabase's shared pooler host at all (seen on
// this one — TCP connect to *.pooler.supabase.com timed out while the
// per-project db.<ref>.supabase.co host connected fine). The deployed app
// still uses the pooled connection; this is a local-tooling-only call.
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL }) });

const here = dirname(fileURLToPath(import.meta.url));

async function main() {
  const csv = readFileSync(join(here, 'seed-data.csv'), 'utf-8');
  const { parties, guests } = parseGuestRows(parseCsv(csv));

  for (const party of parties) {
    await prisma.party.upsert({
      where: { externalId: party.externalId },
      create: { externalId: party.externalId, label: party.label },
      update: { label: party.label },
    });
  }

  for (const guest of guests) {
    const party = await prisma.party.findUniqueOrThrow({
      where: { externalId: guest.partyExternalId },
    });
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
      },
    });
  }

  console.log(`Seeded ${parties.length} parties and ${guests.length} guests.`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
