import type { ReactNode } from 'react';
import { AudioToggle } from '@/components/site/chrome/AudioToggle';
import { TopBar } from '@/components/site/chrome/TopBar';
import { TrackProgressProvider } from '@/components/site/TrackProgressProvider';
import { LenisProvider } from '@/components/site/LenisProvider';

export default function StoryLayout({ children }: { children: ReactNode }) {
  return (
    <LenisProvider>
      <TrackProgressProvider>
        <TopBar />
        <AudioToggle />
        {children}
      </TrackProgressProvider>
    </LenisProvider>
  );
}
