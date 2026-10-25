import { hashPassword } from '../lib/auth/password';
import { formatPasswordHash } from '../lib/auth/password-env';

const password = process.argv[2];
if (!password) {
  console.error('Usage: npm run hash-password -- <password> [--vercel]');
  process.exit(1);
}

// Default output is a ready-to-paste .env.local assignment. Vercel stores
// raw values and must not receive the local file's escape characters.
console.log(
  formatPasswordHash(
    hashPassword(password),
    process.argv.includes('--vercel') ? 'vercel' : 'local',
  ),
);
