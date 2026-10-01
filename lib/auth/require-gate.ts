import 'server-only';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { redirect } from 'next/navigation';
import { env } from '../env';
import { SESSION_COOKIE_NAME, verifySession } from './session';

async function hasValidSession(): Promise<boolean> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return false;
  return verifySession(token, env.SESSION_SECRET, env.SESSION_EPOCH);
}

// For Server Components (gated layouts, pages): redirects unauthenticated
// visitors to the gate. This is the independent check docs/PLAN.md requires
// alongside proxy.ts — proxy.ts can be bypassed (CVE-2025-29927), this can't.
export async function requireGate(): Promise<void> {
  if (!(await hasValidSession())) {
    redirect('/');
  }
}

// For Route Handlers, which can't call next/navigation's redirect(): returns
// a 401 response to return as-is when unauthenticated, or null to proceed.
export async function requireGateApi(): Promise<NextResponse | null> {
  if (!(await hasValidSession())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  return null;
}
