import { createBrowserClient } from '@supabase/ssr';
import { publicEnv } from '../env.public';

// The browser-side client for the admin login form — the anon key is
// already public (it's one of the two NEXT_PUBLIC_ vars this project
// allows), so there's nothing server-only about this one.
export function createClient() {
  return createBrowserClient(publicEnv.NEXT_PUBLIC_SUPABASE_URL, publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
