import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';

// The test config requires an explicit, separate test connection. Never
// fall back to DIRECT_URL: it now contains the real guest database.
if (!process.env.TEST_DATABASE_URL)
  throw new Error('Missing TEST_DATABASE_URL');
export const testPrisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.TEST_DATABASE_URL }),
});
