import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { isSafeNextPath } from './lib/auth/safe-next';
import { SESSION_COOKIE_NAME, verifySession } from './lib/auth/session';
import { env } from './lib/env';
import { refreshAdminSession } from './lib/supabase/middleware';

// Redirect UX only — NOT the sole gate. CVE-2025-29927 showed middleware can
// be bypassed with a crafted header; every gated layout and API route calls
// requireGate()/requireGateApi() or requireAdmin()/requireAdminApi()
// independently, which is the check that actually matters. This just avoids
// rendering a gated page before redirecting, for everyone not trying to
// bypass it.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Must come before the /admin branch below, not be folded into its
  // exclusion check and fall through: falling through ran this path
  // against the *guest* gate's cookie instead, which redirected a signed-
  // out admin visitor to the wedding password screen instead of showing
  // the login form.
  if (pathname === '/admin/login') {
    return NextResponse.next();
  }

  if (pathname.startsWith('/admin')) {
    // Also refreshes Supabase's session cookie — see refreshAdminSession's
    // own comment for why that has to happen here rather than in a Server
    // Component.
    const { response, isAuthorized } = await refreshAdminSession(request);
    return isAuthorized ? response : NextResponse.redirect(new URL('/admin/login', request.url));
  }

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
  matcher: ['/story', '/rsvp', '/admin/:path*'],
};
