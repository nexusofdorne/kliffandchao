import 'server-only';
import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';
import { env } from '../env';
import { createClient } from '../supabase/server';
import { isAllowlistedAdminEmail } from './admin-allowlist';

async function getAuthorizedAdminEmail(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isAllowlistedAdminEmail(user?.email, env.ADMIN_EMAILS)) return null;
  return user?.email ?? null;
}

// For Server Components (the admin dashboard, party history): redirects
// anyone without a Supabase session *and* an allowlisted email to the admin
// login — a Supabase account alone isn't authorization (docs/BUILD_PLAN.md
// "Admin auth"), so this checks both, same as requireGate() does for the
// independent-of-proxy.ts reasoning.
export async function requireAdmin(): Promise<string> {
  const email = await getAuthorizedAdminEmail();
  if (!email) redirect('/admin/login');
  return email;
}

// For Route Handlers, which can't call next/navigation's redirect().
export async function requireAdminApi(): Promise<NextResponse | null> {
  const email = await getAuthorizedAdminEmail();
  if (!email) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return null;
}
