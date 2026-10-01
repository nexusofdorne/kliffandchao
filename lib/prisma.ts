import 'server-only';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { env } from './env';

// One client per process. Next.js hot-reloads modules in dev, which would
// otherwise open a fresh pool on every edit; stashing it on `globalThis`
// survives the reload. DATABASE_URL is the Supabase *pooled* connection —
// see prisma.config.ts for why migrations use DIRECT_URL instead.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
