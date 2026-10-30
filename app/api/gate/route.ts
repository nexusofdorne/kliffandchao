import { NextResponse } from 'next/server';
import { verifyPassword } from '@/lib/auth/password';
import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS, signSession } from '@/lib/auth/session';
import { env } from '@/lib/env';
import { getSiteSettings } from '@/lib/settings/site-settings';
import { gateRequestSchema } from '@/lib/validation';

// Node runtime, not Edge: password verification needs node:crypto's scrypt.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Whether the gate is open (portfolio: the password screen types the password in by itself and
// anything gets in). The phone design asks before it shows its password screen.
export async function GET() {
  const { passwordOpen } = await getSiteSettings();
  return NextResponse.json({ open: passwordOpen });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = gateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  // the password set in /admin (else SITE_PASSWORD_HASH); with the gate open, no check at all
  const settings = await getSiteSettings();
  if (!settings.passwordOpen && !verifyPassword(parsed.data.password, settings.passwordHash)) {
    return NextResponse.json({ error: 'invalid_password' }, { status: 401 });
  }

  const token = await signSession(env.SESSION_SECRET, env.SESSION_EPOCH, settings.sessionGeneration);
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
