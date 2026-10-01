'use client';

import { useState } from 'react';

type Bird = {
  widthPx: number;
  topPercent: number;
  flightDurationSeconds: number;
  flightDelaySeconds: number;
  flapDurationSeconds: number;
  flapDelaySeconds: number;
};

const DESKTOP_BIRD_COUNT = 5;
const MOBILE_BIRD_COUNT = 3;
const MOBILE_BREAKPOINT_PX = 768;

function buildBirds(count: number): Bird[] {
  return Array.from({ length: count }, () => {
    const flightDurationSeconds = 34 + Math.random() * 40;
    return {
      widthPx: 14 + Math.random() * 16,
      topPercent: 8 + Math.random() * 34,
      flightDurationSeconds,
      // Negative delay starts each bird part-way across, so the sky isn't
      // empty for the first half-minute.
      flightDelaySeconds: -Math.random() * flightDurationSeconds,
      flapDurationSeconds: 0.28 + Math.random() * 0.22,
      flapDelaySeconds: -Math.random(),
    };
  });
}

function getInitialBirds(): Bird[] | null {
  if (typeof window === 'undefined' || matchMedia('(prefers-reduced-motion: reduce)').matches) return null;
  return buildBirds(window.innerWidth < MOBILE_BREAKPOINT_PX ? MOBILE_BIRD_COUNT : DESKTOP_BIRD_COUNT);
}

// A double-arc path read as a gull silhouette at this size — cheaper than
// morphing the path for the flap, which is a scaleY on the svg instead.
// docs/BUILD_PLAN.md Phase 4 step 2 / prototype/index.html's buildBirds().
export function Birds() {
  // Lazy initializer, not an effect + setState: this component is only
  // ever mounted client-side (GateScreen imports it with { ssr: false }),
  // so there's no server-rendered version to mismatch against.
  const [birds] = useState(getInitialBirds);

  if (!birds) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-[2] overflow-hidden" aria-hidden="true">
      {birds.map((bird, i) => (
        <span
          key={i}
          className="absolute left-0 block"
          style={{
            width: `${bird.widthPx}px`,
            height: `${bird.widthPx * 0.5}px`,
            top: `${bird.topPercent}%`,
            animation: `fly-across ${bird.flightDurationSeconds}s linear infinite`,
            animationDelay: `${bird.flightDelaySeconds}s`,
          }}
        >
          <svg
            viewBox="0 0 24 10"
            preserveAspectRatio="none"
            className="block h-full w-full overflow-visible"
            style={{
              stroke: 'rgba(255,255,255,.62)',
              fill: 'none',
              strokeWidth: 1.5,
              strokeLinecap: 'round',
              animation: `flap ${bird.flapDurationSeconds}s ease-in-out infinite alternate`,
              animationDelay: `${bird.flapDelaySeconds}s`,
            }}
          >
            <path d="M1 7 Q6.5 1 12 6 Q17.5 1 23 7" />
          </svg>
        </span>
      ))}
    </div>
  );
}
