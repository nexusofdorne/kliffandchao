'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { useTrackProgress } from '@/components/site/TrackProgressProvider';
import { computeNavIndicatorPosition } from '@/lib/track/progress';

const SECTIONS = [
  { section: 0, label: 'INTRO' },
  { section: 1, label: 'JOURNEY' },
  { section: 2, label: 'WEDDING' },
] as const;

// The capsule is the scroll-position indicator, not just an active-tab
// underline — it slides continuously with the track (TrackProgressProvider
// mirrors HorizontalTrack's onUpdate), so this bar doubles as the "area for
// intro-journey-wedding scroll" website2.0.pdf asks for.
// prototype/index.html's .secnav-items / paintNavInd.
export function SectionNav() {
  const { panel, activeSection, jump } = useTrackProgress();
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const isLight = activeSection === 2;

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(([entry]) => setContainerWidth(entry.contentRect.width));
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const { x, width } = computeNavIndicatorPosition(panel, containerWidth);

  return (
    <div
      ref={containerRef}
      className={`relative flex w-[min(52vw,420px)] rounded-full p-[3px] transition-[background,border-color,box-shadow] duration-[.55s] ${
        isLight ? 'glass-light' : 'glass'
      }`}
    >
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-y-[3px] rounded-full ${
          isLight
            ? 'border border-white bg-white/95 shadow-[0_2px_8px_rgba(28,40,14,.12)]'
            : 'border border-[var(--glass-rim)] bg-[var(--glass-fill-hi)] shadow-[inset_0_1px_0_rgba(255,255,255,.3)]'
        }`}
        style={{ width, transform: `translateX(${x}px)` }}
      />
      <nav className="contents" aria-label="Sections">
        {SECTIONS.map(({ section, label }) => (
          <button
            key={label}
            type="button"
            onClick={() => jump(section)}
            className={`relative z-[1] flex-1 whitespace-nowrap rounded-full py-[clamp(7px,1.05vh,11px)] text-[length:var(--nav-fs)] tracking-[.14em] transition-opacity duration-[.25s] ${
              activeSection === section ? 'font-semibold opacity-100' : 'font-normal opacity-[.66]'
            }`}
          >
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}
