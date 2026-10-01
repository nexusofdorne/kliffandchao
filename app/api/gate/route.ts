import { NextResponse } from 'next/server';
import { verifyPassword } from '@/lib/auth/password';
import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS, signSession } from '@/lib/auth/session';
import { env } from '@/lib/env';
import { gateRequestSchema } from '@/lib/validation';

// Node runtime, not Edge: password verification needs node:crypto's scrypt.
export const runtime = 'nodejs';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = gateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  if (!verifyPassword(parsed.data.password, env.SITE_PASSWORD_HASH)) {
    return NextResponse.json({ error: 'invalid_password' }, { status: 401 });
  }

  const token = await signSession(env.SESSION_SECRET, env.SESSION_EPOCH);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    // Secure cookies aren't sent over plain http://localhost in every
    // browser; only require it where the site is actually served over TLS.
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return response;
}
