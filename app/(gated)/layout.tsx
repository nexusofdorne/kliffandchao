import type { ReactNode } from 'react';
import { requireGate } from '@/lib/auth/require-gate';
import { AudioToggle } from '@/components/site/chrome/AudioToggle';
import { TopBar } from '@/components/site/chrome/TopBar';
import { TrackProgressProvider } from '@/components/site/TrackProgressProvider';

export default async function GatedLayout({ children }: { children: ReactNode }) {
  await requireGate();
  return (
    <TrackProgressProvider>
      <TopBar />
      <AudioToggle />
      {children}
    </TrackProgressProvider>
  );
}
