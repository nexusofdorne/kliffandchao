'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAudio } from '@/components/site/AudioProvider';
import { unlockTyping } from '@/lib/audio/typing';
import { gateDestination } from '@/lib/scene/arrival';
import { phoneStoryUrl, STORY_MOBILE_QUERY } from '@/lib/track/layout';
import { DesktopGate } from './DesktopGate';
import { MobileGate } from './MobileGate';

// What happens after a correct password depends on the screen: phones get the
// 0-100 loader, wide screens dive into the monitor. Both trees are rendered
// (CSS shows one) because the server can't know the viewport, so only the
// branch matching the screen at submit time is ever started.
type Phase = 'idle' | 'loader' | 'dive';

export function GateScreen({ next }: { next: string }) {
  const router = useRouter();
  const audio = useAudio();
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);

  // `interactive-widget=resizes-content` (app/layout.tsx) covers most
  // browsers, but Messenger's in-app browser overlays the on-screen keyboard
  // on top of a static 100vh instead of shrinking it — the password field
  // ends up hidden behind the keyboard with no way to scroll to it, since
  // this screen is h-screen/overflow-hidden by design. visualViewport
  // reports the keyboard's real, shrunk visible area even there, so the
  // screen's own height follows it and the centred form re-centres above
  // the keyboard rather than being covered by it.
  // Phones get the phone design, which has its own password screen (public/m); with reduce
  // motion on it plays its calm version.
  useEffect(() => {
    if (!matchMedia(STORY_MOBILE_QUERY).matches) return;
    location.replace(phoneStoryUrl(next === '/story' ? {} : { next }));
  }, [next]);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const updateHeight = () => setViewportHeight(viewport.height);
    updateHeight();
    viewport.addEventListener('resize', updateHeight);
    return () => viewport.removeEventListener('resize', updateHeight);
  }, []);

  function handleEnter() {
    if (phase !== 'idle') return;
    setError(false);
    // Must happen synchronously, inside this gesture, before the `await`
    // below — iOS drops the gesture token once an async gap has passed, so
    // playback (muted; muted playback is always permitted) has to start
    // here, not after the fetch resolves. docs/PLAN.md "The autoplay
    // problem".
    audio.playMutedSync();
    unlockTyping(); // the terminal's key clicks need their audio context made inside this tap
    void submit();
  }

  async function submit() {
    let response: Response;
    try {
      response = await fetch('/api/gate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
    } catch {
      // Offline or the request never reached the server — same recovery as
      // a rejected password, so the gesture-started muted audio doesn't
      // keep playing silently with no feedback on screen.
      audio.pause();
      setError(true);
      setPassword('');
      return;
    }

    if (!response.ok) {
      audio.pause();
      setError(true);
      setPassword('');
      return;
    }

    // The song keeps playing silently through the loader (phones) or the dive and
    // the terminal (wide screens); it was started inside the Enter tap, and the
    // story brings it in with the intro.
    if (matchMedia(STORY_MOBILE_QUERY).matches) {
      setPhase('loader');
    } else {
      // warm the next route while the camera is still flying in
      router.prefetch(gateDestination(next));
      setPhase('dive');
    }
  }

  function handleLoaderComplete() {
    // Client-side navigation, not a hard redirect: the <audio> element
    // lives in the root layout and only survives a route change if it's
    // client-side — a full reload drops the gesture and the song with it.
    router.push(next);
  }

  function handleDived() {
    // Same rule, and the same reason: client-side only. The dive ends on the
    // terminal's black screen, which is where /story picks up.
    router.push(gateDestination(next));
  }

  const form = {
    password,
    onPasswordChange: setPassword,
    error,
    onEnter: handleEnter,
  };

  return (
    <>
      <div className="min-[769px]:hidden">
        <MobileGate
          {...form}
          loading={phase === 'loader'}
          onLoaderComplete={handleLoaderComplete}
          viewportHeight={viewportHeight}
        />
      </div>
      <div className="max-[768px]:hidden">
        <DesktopGate
          {...form}
          diving={phase === 'dive'}
          onDived={handleDived}
        />
      </div>
    </>
  );
}
