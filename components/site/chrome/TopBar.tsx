'use client';

import { useTrackProgress } from '@/components/site/TrackProgressProvider';
import { RsvpPill } from './RsvpPill';
import { SectionNav } from './SectionNav';
import { Wordmark } from './Wordmark';

// One geometric glass rail holding the logo, the intro/journey/wedding
// capsule nav, and RSVP — website2.0.pdf §2's "area for intro - journey -
// wedding scroll" consolidated into a single bar (prototype/index.html
// .topbar). The bar itself has no surface of its own: each child carries
// its own glass (or none), so only `color` is set here for the logo and nav
// labels to inherit via currentColor.
export function TopBar() {
  const { activeSection, jump } = useTrackProgress();
  const isLight = activeSection === 2;

  return (
    <header
      className="pointer-events-none fixed left-1/2 top-[2.4vh] z-[60] flex w-[min(95vw,1240px)] -translate-x-1/2 items-center gap-[clamp(10px,1.6vw,24px)]"
      style={{ color: isLight ? '#14180d' : '#fff' }}
    >
      <button
        type="button"
        onClick={() => jump(0)}
        aria-label="Back to the intro"
        className={`pointer-events-auto block w-[clamp(34px,5vh,52px)] flex-none ${
          isLight ? '' : 'drop-shadow-[0_1px_6px_rgba(0,0,0,.35)]'
        }`}
      >
        <Wordmark />
      </button>
      <div className="pointer-events-auto flex min-w-0 flex-1 justify-center">
        <SectionNav />
      </div>
      <div className="pointer-events-auto flex-none">
        <RsvpPill />
      </div>
    </header>
  );
}
