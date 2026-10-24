'use client';

import { useEffect } from 'react';

// Root error boundary (Next.js App Router convention — must be a Client
// Component). Catches any render-time exception across the gate/journey/
// wedding/RSVP tree that isn't already handled closer to the source, e.g. a
// Server Component failing to reach the database. Never render `error.message`
// here — CLAUDE.md "never send stack traces or internals to the client".
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-[2vh] bg-black px-6 text-center text-white">
      <p className="text-[12px] tracking-[.14em] opacity-70">SOMETHING WENT WRONG</p>
      <p className="max-w-[320px] text-[13px] leading-[1.9] opacity-50">
        Please try again in a moment. If this keeps happening, let the couple know.
      </p>
      <button
        type="button"
        onClick={reset}
        className="glass mt-[1vh] rounded-full px-[22px] py-[11px] text-[10px] tracking-[.14em] transition-colors duration-300 hover:bg-white/[.22]"
      >
        TRY AGAIN
      </button>
    </div>
  );
}
