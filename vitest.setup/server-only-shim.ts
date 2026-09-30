// Vitest doesn't do the bundler-level swap Next.js does for `server-only`
// (real package unconditionally throws outside a webpack/Turbopack build),
// so tests alias it to this no-op instead — see vitest.config.ts.
export {};
