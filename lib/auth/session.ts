import 'server-only';
import { jwtVerify, SignJWT } from 'jose';

export const SESSION_COOKIE_NAME = 'session';
export const SESSION_MAX_AGE_SECONDS = 180 * 24 * 60 * 60; // 180 days, per docs/PLAN.md cookie spec

type SessionClaims = { epoch: number };

export async function signSession(secret: string, epoch: number): Promise<string> {
  return new SignJWT({ epoch } satisfies SessionClaims)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(new TextEncoder().encode(secret));
}

// Pinning algorithms here (not just at sign time) is what makes an `alg`
// confusion attack fail — see CLAUDE.md "sameSite: 'lax' cookie" sibling
// note in docs/PLAN.md "Password gate" for the matching CVE-2025-29927 note.
export async function verifySession(token: string, secret: string, currentEpoch: number): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), { algorithms: ['HS256'] });
    return (payload as Partial<SessionClaims>).epoch === currentEpoch;
  } catch {
    return false;
  }
}
