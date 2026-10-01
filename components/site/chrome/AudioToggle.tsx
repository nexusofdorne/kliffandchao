'use client';

import { useAudio } from '@/components/site/AudioProvider';
import { useTrackProgress } from '@/components/site/TrackProgressProvider';

// Bottom-left, mirroring the wordmark's top-left position on the wedding
// panel — docs/PLAN.md "The toggle". Shows the equaliser while playing,
// a crossed-out speaker while muted. A glass disc like the top bar's
// pills, re-tinting with the section the same way — prototype/index.html's
// .audio-btn / setSec's `audioBtn.classList.toggle('g'|'g-l', ...)`.
export function AudioToggle() {
  const { isMuted, isPlaying, toggleMute } = useAudio();
  const { activeSection } = useTrackProgress();
  const isLight = activeSection === 2;
  const showEqualizer = isPlaying && !isMuted;

  return (
    <button
      type="button"
      onClick={toggleMute}
      aria-pressed={isMuted}
      aria-label="Toggle music"
      title="Toggle music"
      style={{ color: isLight ? 'var(--olive)' : '#fff' }}
      className={`fixed bottom-[4.4vh] left-[3.2vw] z-[60] grid size-[clamp(40px,5.4vh,52px)] place-items-center rounded-full transition-transform duration-300 ease-[cubic-bezier(.16,1,.3,1)] hover:scale-[1.06] ${
        isLight ? 'glass-light' : 'glass'
      }`}
    >
      {showEqualizer ? (
        <span className="flex h-[15px] items-end gap-[2.5px]" aria-hidden="true">
          {EQUALIZER_BARS.map((bar) => (
            <i
              key={bar.heightPercent}
              className="block w-[2.5px] animate-[eq_.9s_ease-in-out_infinite_alternate] rounded-[1px] bg-current"
              style={{ height: `${bar.heightPercent}%`, animationDelay: `${bar.delaySeconds}s` }}
            />
          ))}
        </span>
      ) : (
        <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-full w-full">
          <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" stroke="none" />
          <path d="M17 9l5 6M22 9l-5 6" stroke="currentColor" fill="none" strokeWidth={2} />
        </svg>
      )}
    </button>
  );
}

// width/delay pairs extracted from prototype/index.html's .audio-btn .eq i
// nth-child rules.
const EQUALIZER_BARS = [
  { heightPercent: 40, delaySeconds: -0.4 },
  { heightPercent: 100, delaySeconds: -0.15 },
  { heightPercent: 62, delaySeconds: -0.65 },
  { heightPercent: 82, delaySeconds: -0.3 },
];
