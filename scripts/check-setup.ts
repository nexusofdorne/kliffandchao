import { existsSync } from 'node:fs';
import nextEnv from '@next/env';
import { z } from 'zod';
import { parseEnv } from '../lib/env-schema';
import { hasValidPasswordHashFormat } from '../lib/auth/password-env';

let failed = false;
function report(ok: boolean, message: string) {
  console.log(`${ok ? 'OK' : 'FIX'} ${message}`);
  if (!ok) failed = true;
}

report(
  Number(process.versions.node.split('.')[0]) === 24,
  `Node ${process.versions.node}; this project uses Node 24 LTS.`,
);
report(
  existsSync('.env.local'),
  '.env.local exists (copy .env.example and fill it in for local development).',
);
// Use the same expansion rules as next dev. Never print loader errors or
// configuration values: either can include secrets from a malformed file.
nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
try {
  const env = parseEnv(process.env);
  report(true, 'Required environment variables pass validation.');
  report(
    hasValidPasswordHashFormat(env.SITE_PASSWORD_HASH),
    'Password hash has the expected format after Next.js loads it. Use the escaped output from npm run hash-password in .env.local.',
  );
  try {
    const key = JSON.parse(
      Buffer.from(env.GOOGLE_SA_KEY_B64, 'base64').toString('utf8'),
    );
    report(
      z
        .object({
          client_email: z.email(),
          private_key: z.string().includes('PRIVATE KEY'),
        })
        .safeParse(key).success,
      'Google service-account key has the expected structure.',
    );
  } catch {
    report(
      false,
      'GOOGLE_SA_KEY_B64 must contain a base64-encoded service-account JSON file.',
    );
  }
} catch (error) {
  if (error instanceof z.ZodError) {
    const names = [
      ...new Set(error.issues.map((issue) => issue.path.join('.'))),
    ];
    report(
      false,
      `Missing or invalid environment variables: ${names.join(', ')}.`,
    );
  } else {
    report(false, 'Could not validate environment configuration.');
  }
}
report(
  existsSync('generated/prisma/client.ts'),
  'Prisma client exists (npm install generates it).',
);
report(
  existsSync('next-env.d.ts'),
  'Next.js types exist (npm run typecheck generates them).',
);
console.log(
  'This check does not connect to the database or external services.',
);
process.exitCode = failed ? 1 : 0;
