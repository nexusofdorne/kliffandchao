'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { DEFAULT_TARGET_VOLUME, fadeIn } from '@/lib/audio/fade';
import { siteConfig } from '@/config/site';

const MUTED_STORAGE_KEY = 'muted';
const FADE_IN_MS = 1500;
const UNMUTE_FADE_MS = 600;

type AudioContextValue = {
  isMuted: boolean;
  isPlaying: boolean;
  // Must be called synchronously inside the same click/keydown handler that
  // triggers the gate's fetch — iOS drops the user-gesture token once an
  // `await` has run, so play() has to happen before that, muted (muted
  // playback is always permitted) — docs/PLAN.md "The autoplay problem".
  playMutedSync: () => void;
  // The song comes in with the intro, not at the gate: it restarts from the top
  // and fades up. A no-op once the music is already playing (coming back from RSVP).
  beginMusic: () => void;
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

  // the handlers below read these, so they stay stable across renders
  const isMutedRef = useRef(isMuted);
  const isPlayingRef = useRef(false);
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  const markPlaying = useCallback((playing: boolean) => {
    isPlayingRef.current = playing;
    setIsPlaying(playing);
  }, []);

  const playMutedSync = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = true;
    // a wrong password pauses it again before it has started, which rejects this promise
    // (an AbortError); that is expected, not a failure
    audio.play().catch(() => {});
  }, []);

  const beginMusic = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || isPlayingRef.current) return;
    // it may have been playing silently since the Enter tap: start the song over
    audio.currentTime = 0;
    audio.muted = isMutedRef.current;
    audio.volume = 0; // so it does not blip at full volume before the fade starts
    audio.play().then(
      () => {
        markPlaying(true);
        if (isMutedRef.current) audio.volume = DEFAULT_TARGET_VOLUME;
        else fadeIn(audio, FADE_IN_MS);
      },
      // refused (no tap on this visit): the button stays on "off" and one tap starts it
      () => markPlaying(false),
    );
  }, [markPlaying]);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    markPlaying(false);
  }, [markPlaying]);

  const toggleMute = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    // the music never started (no tap on this visit): this tap is the one that starts it
    if (!isPlayingRef.current && !isMutedRef.current) {
      audio.muted = false;
      audio.volume = 0;
      audio.play().then(() => {
        markPlaying(true);
        fadeIn(audio, FADE_IN_MS);
      }, () => {});
      return;
    }
    const nextMuted = !isMutedRef.current;
    isMutedRef.current = nextMuted;
    setIsMuted(nextMuted);
    window.localStorage.setItem(MUTED_STORAGE_KEY, nextMuted ? '1' : '0');
    audio.muted = nextMuted;
    if (nextMuted) return;
    if (audio.paused) {
      audio.volume = 0;
      audio.play().then(() => markPlaying(true), () => {});
    }
    fadeIn(audio, UNMUTE_FADE_MS);
  }, [markPlaying]);

  return (
    <AudioProviderContext.Provider value={{ isMuted, isPlaying, playMutedSync, beginMusic, pause, toggleMute }}>
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
