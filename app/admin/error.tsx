'use client';

import { useEffect } from 'react';

// Admin's own error boundary, styled with the plain shadcn/base-ui tokens
// (not the wedding glass aesthetic) per the reusability split — app/admin
// must stay generic. Covers the direct Prisma calls in app/admin/page.tsx
// and app/admin/parties/[id]/page.tsx (e.g. the database being unreachable),
// which would otherwise surface Next.js's bare default error page.
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-5xl flex-col items-start gap-3 p-6">
      <h1 className="text-xl font-semibold text-foreground">Something went wrong</h1>
      <p className="text-sm text-muted-foreground">
        The dashboard couldn&apos;t load — the database may be unreachable. Try again in a moment.
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-md border border-input px-3 py-1.5 text-sm text-foreground"
      >
        Try again
      </button>
    </div>
  );
}
