'use client';

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { fadeIn } from '@/lib/audio/fade';
import { siteConfig } from '@/config/site';

const MUTED_STORAGE_KEY = 'muted';
const FADE_IN_MS = 1500;

type AudioContextValue = {
  isMuted: boolean;
  isPlaying: boolean;
  // Must be called synchronously inside the same click/keydown handler that
  // triggers the gate's fetch — iOS drops the user-gesture token once an
  // `await` has run, so play() has to happen before that, muted (muted
  // playback is always permitted) — docs/PLAN.md "The autoplay problem".
  playMutedSync: () => void;
  unmuteAndFadeIn: () => void;
  pause: () => void;
  toggleMute: () => void;
};

const AudioProviderContext = createContext<AudioContextValue | null>(null);

export function AudioProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isMuted, setIsMuted] = useState(
    () => typeof window !== 'undefined' && window.localStorage.getItem(MUTED_STORAGE_KEY) === '1',
  );
  const [isPlaying, setIsPlaying] = useState(false);

  const playMutedSync = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = true;
    void audio.play();
  }, []);

  const unmuteAndFadeIn = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    setIsPlaying(true);
    if (!isMuted) {
      audio.muted = false;
      fadeIn(audio, FADE_IN_MS);
    }
  }, [isMuted]);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    setIsPlaying(false);
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted((wasMuted) => {
      const nextMuted = !wasMuted;
      window.localStorage.setItem(MUTED_STORAGE_KEY, nextMuted ? '1' : '0');
      const audio = audioRef.current;
      if (audio) {
        audio.muted = nextMuted;
        if (!nextMuted && audio.paused) void audio.play();
      }
      return nextMuted;
    });
  }, []);

  return (
    <AudioProviderContext.Provider value={{ isMuted, isPlaying, playMutedSync, unmuteAndFadeIn, pause, toggleMute }}>
      {children}
      <audio ref={audioRef} loop preload="none" src={siteConfig.audioSrc} />
    </AudioProviderContext.Provider>
  );
}

export function useAudio(): AudioContextValue {
  const context = useContext(AudioProviderContext);
  if (!context) throw new Error('useAudio must be used within AudioProvider');
  return context;
}
