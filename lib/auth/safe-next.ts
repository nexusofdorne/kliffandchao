// Guards the gate's `?next=` deep link. `/path` is fine; `//evil.com` is a
// protocol-relative URL (the browser treats it as absolute), and anything
// with a scheme is already absolute — both are open-redirect vectors.
export function isSafeNextPath(path: string): boolean {
  return path.startsWith('/') && !path.startsWith('//');
}
