import 'server-only';
import { jwtVerify, SignJWT } from 'jose';

export const SESSION_COOKIE_NAME = 'session';
export const SESSION_MAX_AGE_SECONDS = 180 * 24 * 60 * 60; // 180 days, per docs/PLAN.md cookie spec

// `gen` is the SiteSettings session generation it was issued under ("Sign everyone out" in /admin
// bumps it); sessions from before it existed carry none and count as 0.
type SessionClaims = { epoch: number; gen?: number };

export async function signSession(secret: string, epoch: number, generation = 0): Promise<string> {
  return new SignJWT({ epoch, gen: generation } satisfies SessionClaims)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(new TextEncoder().encode(secret));
}

// Pinning algorithms here (not just at sign time) is what makes an `alg`
// confusion attack fail — see CLAUDE.md "sameSite: 'lax' cookie" sibling
// note in docs/PLAN.md "Password gate" for the matching CVE-2025-29927 note.
// `currentGeneration` is left out where the settings can't be read cheaply (proxy.ts, which is
// only a redirect convenience); requireGate() always passes it.
export async function verifySession(
  token: string,
  secret: string,
  currentEpoch: number,
  currentGeneration?: number,
): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), { algorithms: ['HS256'] });
    const claims = payload as Partial<SessionClaims>;
    if (claims.epoch !== currentEpoch) return false;
    return currentGeneration === undefined || (claims.gen ?? 0) === currentGeneration;
  } catch {
    return false;
  }
}
