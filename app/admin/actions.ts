'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { hashPassword, normalizePassword } from '@/lib/auth/password';
import { requireAdmin } from '@/lib/auth/require-admin';
import { prisma } from '@/lib/prisma';
import { updateSiteSettings } from '@/lib/settings/site-settings';
import { createClient } from '@/lib/supabase/server';

export async function signOutAdmin() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/admin/login');
}

// Site settings (components/admin/SiteSettingsPanel.tsx). Every action checks the admin itself:
// a server action is a public endpoint, whatever page renders it.

export type SettingsActionState = { ok: boolean; message: string } | null;

/** The shortest password the dashboard accepts (after trimming; passwords aren't case-sensitive). */
const MIN_PASSWORD_LENGTH = 4;

export async function setPasswordOpen(open: boolean): Promise<void> {
  const email = await requireAdmin();
  await updateSiteSettings(prisma, { passwordOpen: open }, email);
  revalidatePath('/admin');
}

export async function setRsvpClosed(closed: boolean): Promise<void> {
  const email = await requireAdmin();
  await updateSiteSettings(prisma, { rsvpClosed: closed }, email);
  revalidatePath('/admin');
}

export async function changeSitePassword(_previous: SettingsActionState, form: FormData): Promise<SettingsActionState> {
  const email = await requireAdmin();
  const password = String(form.get('password') ?? '');
  const confirm = String(form.get('confirm') ?? '');
  if (normalizePassword(password).length < MIN_PASSWORD_LENGTH) {
    return { ok: false, message: `Use at least ${MIN_PASSWORD_LENGTH} characters.` };
  }
  if (normalizePassword(password) !== normalizePassword(confirm)) {
    return { ok: false, message: "The two passwords don't match." };
  }
  await updateSiteSettings(prisma, { sitePasswordHash: hashPassword(password) }, email);
  revalidatePath('/admin');
  return { ok: true, message: 'Saved. The new password works now; the old one no longer does.' };
}

export async function signEveryoneOut(): Promise<SettingsActionState> {
  const email = await requireAdmin();
  await updateSiteSettings(prisma, { bumpSessionGeneration: true }, email);
  revalidatePath('/admin');
  return { ok: true, message: 'Everyone has been signed out. Guests need the password again.' };
}
