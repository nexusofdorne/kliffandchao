export function formatPasswordHash(
  hash: string,
  target: 'local' | 'vercel',
): string {
  return target === 'local'
    ? `SITE_PASSWORD_HASH=${hash.replace(/\$/g, '\\$')}`
    : hash;
}

export function hasValidPasswordHashFormat(hash: string | undefined): boolean {
  if (!hash) return false;
  const [scheme, n, r, p, salt, key, ...extra] = hash.split('$');
  return (
    extra.length === 0 &&
    scheme === 'scrypt' &&
    n === '16384' &&
    r === '8' &&
    p === '1' &&
    /^[A-Za-z0-9_-]{22}$/.test(salt ?? '') &&
    /^[A-Za-z0-9_-]{86}$/.test(key ?? '')
  );
}
