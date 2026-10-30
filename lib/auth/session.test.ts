import { SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import { signSession, verifySession } from './session';

const SECRET = 'a'.repeat(32);
const EPOCH = 1;

describe('session sign/verify', () => {
  it('round-trips a session signed with the same secret and epoch', async () => {
    const token = await signSession(SECRET, EPOCH);
    await expect(verifySession(token, SECRET, EPOCH)).resolves.toBe(true);
  });

  it('rejects a token signed with a different secret', async () => {
    const token = await signSession(SECRET, EPOCH);
    await expect(verifySession(token, 'b'.repeat(32), EPOCH)).resolves.toBe(false);
  });

  it('rejects a token signed with a different algorithm', async () => {
    const token = await new SignJWT({ epoch: EPOCH })
      .setProtectedHeader({ alg: 'HS512' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(SECRET));

    await expect(verifySession(token, SECRET, EPOCH)).resolves.toBe(false);
  });

  it('rejects a session once SESSION_EPOCH has been bumped', async () => {
    const token = await signSession(SECRET, EPOCH);
    await expect(verifySession(token, SECRET, EPOCH + 1)).resolves.toBe(false);
  });

  it('rejects garbage input instead of throwing', async () => {
    await expect(verifySession('not-a-jwt', SECRET, EPOCH)).resolves.toBe(false);
  });

  it('rejects a session from before "Sign everyone out"', async () => {
    const token = await signSession(SECRET, EPOCH, 0);
    await expect(verifySession(token, SECRET, EPOCH, 0)).resolves.toBe(true);
    await expect(verifySession(token, SECRET, EPOCH, 1)).resolves.toBe(false);
    const fresh = await signSession(SECRET, EPOCH, 1);
    await expect(verifySession(fresh, SECRET, EPOCH, 1)).resolves.toBe(true);
  });

  it('treats a session from before generations existed as generation 0', async () => {
    const old = await new SignJWT({ epoch: EPOCH })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(SECRET));
    await expect(verifySession(old, SECRET, EPOCH, 0)).resolves.toBe(true);
    await expect(verifySession(old, SECRET, EPOCH, 1)).resolves.toBe(false);
  });

  it('skips the generation check when none is given (proxy.ts)', async () => {
    const token = await signSession(SECRET, EPOCH, 3);
    await expect(verifySession(token, SECRET, EPOCH)).resolves.toBe(true);
  });
});
