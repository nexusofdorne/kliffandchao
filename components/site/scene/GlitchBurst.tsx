'use client';

import gsap from 'gsap';
import { useEffect, useImperativeHandle, useRef, type Ref } from 'react';
import { prefersReducedMotion, rand, sleep } from './timing';

// A short burst of analog-TV static and torn bands over the whole screen: the
// cut between the monitor's film and the meadow happens behind it.

export type GlitchHandle = {
  /** Plays the burst; resolves when it has cleared. */
  burst: (ms?: number) => Promise<void>;
};

const BARS = 5;

export function GlitchBurst({ ref }: { ref?: Ref<GlitchHandle> }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const barRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const root = rootRef.current;
    return () => void gsap.killTweensOf(root);
  }, []);

  function drawNoise(strength: number) {
    const cv = canvasRef.current;
    const ctx = cv?.getContext('2d');
    if (!cv || !ctx) return;
    const img = ctx.createImageData(cv.width, cv.height);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() < strength ? 255 : Math.random() * 120;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }

  async function burst(ms = 520) {
    const root = rootRef.current;
    if (!root) return;
    if (prefersReducedMotion()) {
      await sleep(Math.min(ms, 200));
      return;
    }
    const t0 = performance.now();
    gsap.set(root, { opacity: 1 });
    const frame = () => {
      const p = Math.min(1, (performance.now() - t0) / ms);
      // up to a peak in the middle, then clearing
      const k = Math.sin(p * Math.PI);
      drawNoise(0.04 + 0.2 * k);
      if (canvasRef.current) {
        canvasRef.current.style.opacity = (0.15 + 0.7 * k * rand(0.5, 1)).toFixed(2);
      }
      barRefs.current.forEach((bar) => {
        if (!bar) return;
        bar.style.top = `${rand(0, 95)}%`;
        bar.style.height = `${rand(1.5, 9) * (0.4 + k)}%`;
        bar.style.transform = `translateX(${rand(-6, 6) * k}%)`;
        bar.style.opacity = Math.random() < 0.8 ? (0.35 + 0.5 * k).toFixed(2) : '0';
      });
      root.style.background =
        Math.random() < 0.18 * k ? `rgba(255,255,255,${rand(0.15, 0.5).toFixed(2)})` : 'transparent';
    };
    gsap.ticker.add(frame);
    try {
      // a timer ends it too: a background tab freezes the ticker
      await sleep(ms);
    } finally {
      gsap.ticker.remove(frame);
      gsap.set(root, { opacity: 0, background: 'transparent' });
    }
  }

  useImperativeHandle(ref, () => ({ burst }));

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[9] opacity-0"
      style={{ mixBlendMode: 'screen' }}
    >
      <canvas ref={canvasRef} width={160} height={90} className="absolute inset-0 h-full w-full" />
      {Array.from({ length: BARS }, (_, i) => (
        <div
          key={i}
          ref={(el) => {
            barRefs.current[i] = el;
          }}
          className="absolute left-0 w-full bg-white/70"
          style={{ opacity: 0 }}
        />
      ))}
    </div>
  );
}
