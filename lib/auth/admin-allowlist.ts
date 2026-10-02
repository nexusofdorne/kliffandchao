// Pure so the comma-split/case/whitespace handling can be unit tested
// without a Supabase session — Supabase login alone isn't authorization
// (docs/BUILD_PLAN.md), this is the second check that makes it one.
export function isAllowlistedAdminEmail(email: string | null | undefined, adminEmails: string): boolean {
  if (!email) return false;
  const allowlist = adminEmails.split(',').map((entry) => entry.trim().toLowerCase());
  return allowlist.includes(email.trim().toLowerCase());
}
