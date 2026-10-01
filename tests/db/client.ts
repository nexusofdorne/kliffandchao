import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';

// Standalone client, not lib/prisma.ts's singleton: that file starts with
// `import 'server-only'`, which throws outside Next's bundler (no such
// swap under Vitest). DIRECT_URL, not DATABASE_URL: this network can't
// reach Supabase's pooler host at all — see prisma/seed.ts for the same
// reasoning. These tests run against the Phase 1 Supabase project, which
// is the test database at this stage of the project (nothing is in
// production yet).
export const testPrisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL }),
});
