import type gsap from 'gsap';

/**
 * Resolves when a timeline finishes, or when its own duration plus a margin
 * has passed on the wall clock, whichever comes first. A background tab stops
 * requestAnimationFrame (and so GSAP's ticker), which would leave a transition
 * hanging and the input locked; the timer snaps it to its end state instead.
 */
export function playToEnd(
  timeline: gsap.core.Timeline,
  margin = 400,
): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      timeline.progress(1);
      resolve();
    };
    const timer = setTimeout(finish, timeline.duration() * 1000 + margin);
    timeline.eventCallback('onComplete', finish);
  });
}

export function prefersReducedMotion(): boolean {
  return matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** An abortable timer, immune to a background tab's frozen animation frames. */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('aborted', 'AbortError'));
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new DOMException('aborted', 'AbortError'));
      },
      { once: true },
    );
  });
}

export const isAbort = (error: unknown): boolean =>
  error instanceof DOMException && error.name === 'AbortError';

export const rand = (min: number, max: number): number =>
  min + Math.random() * (max - min);
