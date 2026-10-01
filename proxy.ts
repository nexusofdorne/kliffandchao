import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { isSafeNextPath } from './lib/auth/safe-next';
import { SESSION_COOKIE_NAME, verifySession } from './lib/auth/session';
import { env } from './lib/env';

// Redirect UX only — NOT the sole gate. CVE-2025-29927 showed middleware can
// be bypassed with a crafted header; every gated layout and API route calls
// requireGate()/requireGateApi() independently (lib/auth/require-gate.ts),
// which is the check that actually matters. This just avoids rendering a
// gated page before redirecting, for everyone not trying to bypass it.
export async function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const authorized = token ? await verifySession(token, env.SESSION_SECRET, env.SESSION_EPOCH) : false;

  if (authorized) {
    return NextResponse.next();
  }

  const url = new URL('/', request.url);
  const next = request.nextUrl.pathname;
  if (isSafeNextPath(next)) {
    url.searchParams.set('next', next);
  }
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/story', '/rsvp'],
};
