import 'server-only';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

export function normalizePassword(input: string): string {
  return input.normalize('NFKC').trim().toLowerCase();
}

// Format: scrypt$N$r$p$saltBase64url$hashBase64url — matches the command in
// docs/PLAN.md "Password gate" so a hash generated there verifies here.
export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_LENGTH);
  const derived = scryptSync(normalizePassword(password), salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString('base64url')}$${derived.toString('base64url')}`;
}

export function verifyPassword(input: string, hash: string): boolean {
  const parsed = parseScryptHash(hash);
  if (!parsed) return false;

  const derived = scryptSync(normalizePassword(input), parsed.salt, parsed.hash.length, {
    N: parsed.N,
    r: parsed.r,
    p: parsed.p,
  });

  return timingSafeEqual(derived, parsed.hash);
}

type ParsedScryptHash = { N: number; r: number; p: number; salt: Buffer; hash: Buffer };

function parseScryptHash(hash: string): ParsedScryptHash | null {
  const parts = hash.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return null;

  const [, nPart, rPart, pPart, saltPart, hashPart] = parts;
  const N = Number(nPart);
  const r = Number(rPart);
  const p = Number(pPart);
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return null;

  try {
    return { N, r, p, salt: Buffer.from(saltPart, 'base64url'), hash: Buffer.from(hashPart, 'base64url') };
  } catch {
    return null;
  }
}
