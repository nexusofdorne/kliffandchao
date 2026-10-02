import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { isAllowlistedAdminEmail } from '../auth/admin-allowlist';
import { env } from '../env';

export type AdminSessionCheck = { response: NextResponse; isAuthorized: boolean };

// Supabase's session cookie needs refreshing on a schedule shorter than its
// own expiry, or an admin mid-session gets silently logged out — this is
// the one place with read/write access to both the request and the
// response cookies at once, which is why it has to live in proxy.ts rather
// than in lib/supabase/server.ts (Server Components can only read cookies).
// It also resolves `isAuthorized` for the caller, since getUser() is
// already being paid for here either way — proxy.ts's own check is
// redirect UX only (requireAdmin() is the one that actually matters, same
// reasoning as the guest gate's), but it still needs the answer to redirect.
export async function refreshAdminSession(request: NextRequest): Promise<AdminSessionCheck> {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, isAuthorized: isAllowlistedAdminEmail(user?.email, env.ADMIN_EMAILS) };
}
