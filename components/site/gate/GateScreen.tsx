'use client';

import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { useAudio } from '@/components/site/AudioProvider';
import { Wordmark } from '@/components/site/chrome/Wordmark';
import { Loader } from './Loader';

// Both generate randomized decoration on mount (grass blade paths, bird
// positions) via a lazy useState initializer rather than an effect, so
// there must be no server-rendered version for the client to mismatch
// against.
const Ambience = dynamic(() => import('./Ambience').then((mod) => mod.Ambience), { ssr: false });
const Birds = dynamic(() => import('./Birds').then((mod) => mod.Birds), { ssr: false });

export function GateScreen({ next }: { next: string }) {
  const router = useRouter();
  const audio = useAudio();
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  function handleEnter(event: FormEvent) {
    event.preventDefault();
    if (loading) return;
    setError(false);
    // Must happen synchronously, inside this gesture, before the `await`
    // below — iOS drops the gesture token once an async gap has passed, so
    // playback (muted; muted playback is always permitted) has to start
    // here, not after the fetch resolves. docs/PLAN.md "The autoplay
    // problem".
    audio.playMutedSync();
    void submit();
  }

  async function submit() {
    const response = await fetch('/api/gate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

    if (!response.ok) {
      audio.pause();
      setError(true);
      setPassword('');
      return;
    }

    audio.unmuteAndFadeIn();
    setLoading(true);
  }

  function handleLoaderComplete() {
    // Client-side navigation, not a hard redirect: the <audio> element
    // lives in the root layout and only survives a route change if it's
    // client-side — a full reload drops the gesture and the song with it.
    router.push(next);
  }

  return (
    <div className="relative h-screen overflow-hidden bg-black text-white">
      <div className="absolute inset-0">
        <Image
          src="/img/intro.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover [animation:gate-drift_42s_ease-in-out_infinite_alternate] [transform-origin:52%_62%]"
        />
        <div className="absolute inset-0 bg-black/40" />
      </div>

      <Ambience />
      <Birds />

      <Loader active={loading} onComplete={handleLoaderComplete} />

      <Wordmark className="absolute left-1/2 top-[6vh] z-[3] w-[clamp(96px,16vh,164px)] -translate-x-1/2 text-white drop-shadow-[0_3px_18px_rgba(0,0,0,.45)]" />

      <div
        className="relative z-[3] flex h-full flex-col items-center justify-center text-center transition-opacity duration-300"
        style={{ opacity: loading ? 0 : 1 }}
      >
        <div className="w-[clamp(288px,44vw,660px)]">
          <h1 className="text-[clamp(28px,6.4vh,64px)] font-medium leading-[1.02] tracking-[-.02em] [text-shadow:0_3px_26px_rgba(0,0,0,.45)]">
            You are <em className="font-normal italic">invited!</em>
          </h1>
          <p className="mt-[2.1vh] text-[clamp(10px,1.42vh,14px)] leading-[1.9] tracking-[.14em] opacity-[.82] [text-shadow:0_2px_14px_rgba(0,0,0,.4)]">
            Please enter the password from your invitation
          </p>

          {/* Deliberately not a <form>: a submit reloads the document and
              destroys the <audio> element along with the ENTER gesture it
              needs — docs/PLAN.md "Background music". */}
          <div className="mt-[4.4vh] flex items-center gap-[clamp(6px,.6vw,10px)] rounded-full bg-white/10 p-[clamp(5px,.62vh,8px)] pl-[clamp(12px,1.3vw,20px)] backdrop-blur-md">
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') handleEnter(event);
              }}
              placeholder="Password"
              aria-label="Password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoComplete="current-password"
              className="h-[clamp(42px,5.7vh,58px)] min-w-0 flex-1 bg-transparent text-[max(16px,clamp(12px,1.62vh,17px))] tracking-[.16em] text-white outline-none placeholder:text-white/40"
            />
            <button
              type="button"
              onClick={handleEnter}
              aria-label="Enter"
              className="grid size-[clamp(42px,5.7vh,58px)] flex-none place-items-center rounded-full bg-white text-[#1a2410]"
            >
              <svg
                viewBox="0 0 24 24"
                strokeLinecap="round"
                strokeLinejoin="round"
                stroke="currentColor"
                fill="none"
                strokeWidth={2.1}
                className="h-[46%] w-[46%]"
                aria-hidden="true"
              >
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>
          </div>

          <p
            role="alert"
            className={`mt-[2vh] overflow-hidden text-[11px] tracking-[.14em] text-[#ffc2b6] transition-[height] duration-200 ${
              error ? 'h-5' : 'h-0'
            }`}
          >
            {error ? "That's not quite it — try again" : null}
          </p>
        </div>
      </div>
    </div>
  );
}
