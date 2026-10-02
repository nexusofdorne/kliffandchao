import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { env } from '../env';

// One per request, not a singleton: the client closes over this request's
// cookies, and Next.js gives every request its own cookies() store.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        // Server Components can't write cookies (Next throws) — that's fine
        // here, since proxy.ts's updateSession is what actually refreshes
        // and persists a rotated session; a Server Component only ever
        // needs to read the current one.
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // No-op — see above.
        }
      },
    },
  });
}
