import type { ReactNode } from 'react';
import { AudioToggle } from '@/components/site/chrome/AudioToggle';
import { TopBar } from '@/components/site/chrome/TopBar';
import { TrackProgressProvider } from '@/components/site/TrackProgressProvider';

export default function StoryLayout({ children }: { children: ReactNode }) {
  return (
    <TrackProgressProvider>
      <TopBar />
      <AudioToggle />
      {children}
    </TrackProgressProvider>
  );
}
