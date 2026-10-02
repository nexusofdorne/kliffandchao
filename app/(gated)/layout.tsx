import type { ReactNode } from 'react';
import { requireGate } from '@/lib/auth/require-gate';

// Chrome (TopBar, AudioToggle, TrackProgressProvider) lives in
// story/layout.tsx, not here: /rsvp is a full-screen overlay route that
// hides the persistent chrome entirely — prototype/index.html's
// `body.rsvp-open .topbar,.audio-btn{display:none}` — and it has no scroll
// track to report progress on.
export default async function GatedLayout({ children }: { children: ReactNode }) {
  await requireGate();
  return children;
}
