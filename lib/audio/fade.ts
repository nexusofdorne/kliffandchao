// Matches prototype/index.html's fadeIn(): ramps volume 0 -> targetVolume
// over durationMs, so the song doesn't slam to full the instant the gate
// resolves.
export const DEFAULT_TARGET_VOLUME = 0.55;

export function computeFadeVolume(elapsedMs: number, durationMs: number, targetVolume: number): number {
  const t = Math.min(1, Math.max(0, elapsedMs / durationMs));
  return t * targetVolume;
}

export function fadeIn(audio: HTMLAudioElement, durationMs: number, targetVolume: number = DEFAULT_TARGET_VOLUME): void {
  audio.volume = 0;
  const start = performance.now();

  function step(now: number) {
    const volume = computeFadeVolume(now - start, durationMs, targetVolume);
    audio.volume = volume;
    if (volume < targetVolume) requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
}
