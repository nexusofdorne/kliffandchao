'use client';

import { useEffect, useState } from 'react';
import { useTrackProgress } from '@/components/site/TrackProgressProvider';
import { computeParallaxOffset } from '@/lib/track/progress';
import { VerseCycler } from './VerseCycler';

const INTRO_LAYER_INDEX = 0;

// Full-bleed background video behind the verse — prototype/index.html's
// #intro. The video is text-free (docs/PLAN.md "The verse is its own
// layer" — the lockup that used to sit here now lives in the persistent
// TopBar), so this panel only carries the plate and the verse.
export function IntroPanel() {
  const { panel } = useTrackProgress();
  const [viewportWidth, setViewportWidth] = useState(0);

  useEffect(() => {
    const updateWidth = () => setViewportWidth(window.innerWidth);
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  const parallaxX = computeParallaxOffset(panel, INTRO_LAYER_INDEX, viewportWidth);

  return (
    <div className="relative h-full overflow-hidden bg-black">
      <div className="absolute inset-0 overflow-hidden motion-safe:[animation:kb_26s_ease-in-out_infinite_alternate]">
        <video
          src="/video/intro-web.mp4"
          poster="/img/intro-poster.jpg"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden="true"
          tabIndex={-1}
          className="h-full w-full object-cover object-[25%_center]"
        />
        {/* White text over bright garden foliage is otherwise unreadable —
            docs/PLAN.md "The verse is its own layer". */}
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_46%,rgba(10,14,8,.34)_74%,rgba(8,11,6,.62)_100%)]" />
      </div>

      {/* Parallax: this foreground layer trails the panel it belongs to, so
          the horizontal slide reads as depth — prototype/index.html's PLX. */}
      <div
        className="absolute inset-0 flex items-end justify-end gap-[5vw] px-[3.4vw] pb-[9.5vh] max-[768px]:flex-col max-[768px]:items-center max-[768px]:justify-end max-[768px]:gap-[3vh] max-[768px]:pb-[15vh]"
        style={{ transform: `translateX(${parallaxX}px)` }}
      >
        <VerseCycler />
      </div>
    </div>
  );
}
