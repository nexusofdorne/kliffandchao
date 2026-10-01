'use client';

import { useEffect, useRef, useState } from 'react';

type Blade = { path: string; durationSeconds: number; delaySeconds: number; opacity: number };

const GRASS_VIEWBOX_WIDTH = 1200;
const GRASS_VIEWBOX_HEIGHT = 170;
const DESKTOP_BLADE_COUNT = 60;
const MOBILE_BLADE_COUNT = 34;
const MOBILE_BREAKPOINT_PX = 768;

function buildBlades(count: number): Blade[] {
  const width = GRASS_VIEWBOX_WIDTH / count;
  return Array.from({ length: count }, (_, i) => {
    const x = (i + 0.2 + Math.random() * 0.6) * width;
    const height = 58 + Math.random() * 95;
    const lean = (Math.random() - 0.5) * 30;
    const baseWidth = 2 + Math.random() * 2.6;
    const path =
      `M${x.toFixed(1)} ${GRASS_VIEWBOX_HEIGHT} ` +
      `Q${(x + lean * 0.35).toFixed(1)} ${(GRASS_VIEWBOX_HEIGHT - height * 0.55).toFixed(1)} ` +
      `${(x + lean).toFixed(1)} ${(GRASS_VIEWBOX_HEIGHT - height).toFixed(1)} ` +
      `Q${(x + lean * 0.35 + baseWidth).toFixed(1)} ${(GRASS_VIEWBOX_HEIGHT - height * 0.55).toFixed(1)} ` +
      `${(x + baseWidth).toFixed(1)} ${GRASS_VIEWBOX_HEIGHT} Z`;
    return {
      path,
      durationSeconds: 3.4 + Math.random() * 3,
      delaySeconds: -Math.random() * 6,
      opacity: 0.5 + Math.random() * 0.5,
    };
  });
}

type Mote = { x: number; y: number; r: number; rise: number; amp: number; phase: number; speed: number; alpha: number };

const DEFAULT_MOTE_DENSITY = 26000;
const MAX_MOTE_COUNT = 55;
const MAX_DEVICE_PIXEL_RATIO = 2; // 3x on phones triples fill rate for no visible gain

function getInitialReducedMotion(): boolean {
  return typeof window !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

type AmbienceProps = {
  density?: number;
  // "r,g,b" (no `rgba(...)` wrapper) so callers don't need to know the
  // canvas fillStyle format.
  tint?: string;
  // The journey panel sits the same three layers behind its coverflow, at
  // z-index 0 instead of the gate's 2 (above the scrim) — docs/PLAN.md
  // "Ambient motion", and with its own shorter grass and darker blade fill.
  zIndex?: number;
  grassHeight?: string;
  bladeFill?: string;
};

// Swaying grass + drifting pollen, shared between the gate and the journey
// panel per docs/PLAN.md "Ambient motion" — build once, mount on both.
export function Ambience({
  density = DEFAULT_MOTE_DENSITY,
  tint = '255,251,238',
  zIndex = 2,
  grassHeight = 'clamp(90px,17vh,190px)',
  bladeFill = 'rgba(16,28,6,.5)',
}: AmbienceProps) {
  // Lazy initializers, not an effect + setState: this component is only
  // ever mounted client-side (GateScreen imports it with { ssr: false }),
  // so there's no server-rendered version to mismatch against, and
  // computing it here avoids react-hooks/set-state-in-effect entirely.
  const [reduced] = useState(getInitialReducedMotion);
  const [blades] = useState<Blade[] | null>(() =>
    reduced ? null : buildBlades(window.innerWidth < MOBILE_BREAKPOINT_PX ? MOBILE_BLADE_COUNT : DESKTOP_BLADE_COUNT),
  );
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (reduced || !canvasEl) return;
    // Rebind to a type that's non-null by declaration: nested function
    // declarations below close over the declared type, not the narrowing
    // from the guard above, so `canvasEl` alone would still read as
    // possibly-null inside them.
    const canvas: HTMLCanvasElement = canvasEl;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO);
    let width = 0;
    let height = 0;
    let motes: Mote[] = [];
    let frame = 0;

    function resize() {
      width = canvas.width = canvas.offsetWidth * dpr;
      height = canvas.height = canvas.offsetHeight * dpr;
      const count = Math.round(Math.min(MAX_MOTE_COUNT, (canvas.offsetWidth * canvas.offsetHeight) / density));
      motes = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        r: (0.7 + Math.random() * 2.1) * dpr,
        rise: (0.05 + Math.random() * 0.22) * dpr,
        amp: (6 + Math.random() * 22) * dpr,
        phase: Math.random() * Math.PI * 2,
        speed: 0.003 + Math.random() * 0.006,
        alpha: 0.14 + Math.random() * 0.42,
      }));
    }

    function tick() {
      ctx!.clearRect(0, 0, width, height);
      for (const mote of motes) {
        mote.y -= mote.rise;
        mote.phase += mote.speed;
        if (mote.y < -8) {
          mote.y = height + 8;
          mote.x = Math.random() * width;
        }
        ctx!.beginPath();
        ctx!.arc(mote.x + Math.sin(mote.phase) * mote.amp, mote.y, mote.r, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(${tint},${mote.alpha})`;
        ctx!.fill();
      }
      frame = requestAnimationFrame(tick);
    }

    resize();
    tick();
    window.addEventListener('resize', resize);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(frame);
    };
  }, [reduced, density, tint]);

  if (reduced) return null;

  return (
    <>
      <svg
        className="pointer-events-none absolute inset-x-0 bottom-0 w-full"
        style={{ height: grassHeight, zIndex }}
        viewBox={`0 0 ${GRASS_VIEWBOX_WIDTH} ${GRASS_VIEWBOX_HEIGHT}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {blades?.map((blade, i) => (
          <path
            key={i}
            d={blade.path}
            fill={bladeFill}
            style={{
              transformBox: 'fill-box',
              transformOrigin: '50% 100%',
              animation: `sway ${blade.durationSeconds}s ease-in-out infinite alternate`,
              animationDelay: `${blade.delaySeconds}s`,
              opacity: blade.opacity,
            }}
          />
        ))}
      </svg>
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 h-full w-full"
        style={{ zIndex }}
        aria-hidden="true"
      />
    </>
  );
}
