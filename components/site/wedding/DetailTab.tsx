import { siteConfig } from '@/config/site';
import { venueAddressLines } from '@/content/wedding';
import { Countdown } from './Countdown';
import { VenueMap } from './VenueMap';

// Matches prototype/index.html's tested href exactly (built from the venue
// name written out, not derived from siteConfig.venueName — that has an
// "&", which Google Maps' destination param handles fine but wasn't what
// was actually tested).
const DIRECTIONS_URL =
  'https://www.google.com/maps/dir/?api=1&destination=Jpark+Island+Resort+and+Waterpark+Mactan+Cebu';

type DetailTabProps = {
  active: boolean;
  /** `split` is the wedding window's layout: the details on the left, the map on the right. */
  layout?: 'stacked' | 'split';
};

// Keep a "Get directions" button alongside the embed: guests navigate from
// their phones, and the directions link opens the native Google/Apple Maps
// app rather than a cramped in-page frame. The embed is for orientation;
// the button is for actually getting there — docs/PLAN.md "The map is
// embedded, not a link out".
export function DetailTab({ active, layout = 'stacked' }: DetailTabProps) {
  if (layout === 'split') return <SplitDetail active={active} />;
  return (
    <div>
      <div className="text-[clamp(20px,3.6vh,40px)] font-semibold tracking-[-.02em]">
        {siteConfig.weddingDateDisplay.toUpperCase()}
      </div>

      <Countdown />

      <div className="glass-light mx-auto mt-[3.2vh] w-[clamp(260px,34vw,520px)] rounded-[22px] p-[5px]">
        <VenueMap active={active} />
      </div>

      <div className="mx-auto mt-[1.4vh] flex w-[clamp(260px,34vw,520px)] flex-wrap items-center justify-between gap-[14px] max-[768px]:justify-center">
        <div className="text-left text-[clamp(9px,1.18vh,12px)] tracking-[.1em] text-[#4a5140] max-[768px]:text-center">
          {venueAddressLines.map((line) => (
            <div key={line}>{line}</div>
          ))}
        </div>
        <a
          href={DIRECTIONS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="whitespace-nowrap rounded-full bg-[var(--green)] px-[2.4vh] py-[1.25vh] text-[clamp(8.5px,1.08vh,11px)] font-semibold tracking-[.14em] text-white shadow-[0_4px_16px_rgba(42,67,0,.2)] transition-[background,transform] duration-200 hover:-translate-y-px hover:bg-[#5d8d28]"
        >
          GET DIRECTIONS →
        </a>
      </div>
    </div>
  );
}

function SplitDetail({ active }: { active: boolean }) {
  return (
    <div className="grid h-full grid-cols-[0.78fr_1.22fr] items-center gap-[3cqw]">
      <div className="text-center">
        <div className="text-[1.5cqw] font-semibold tracking-[-.01em]">
          {siteConfig.weddingDateDisplay.toUpperCase()}
        </div>

        <Countdown compact />

        <div className="text-[0.68cqw] font-semibold uppercase tracking-[.02em]">
          {venueAddressLines[0]}, Cebu
        </div>
        <div className="mx-auto mt-[0.4cqw] max-w-[22cqw] text-[0.62cqw] leading-[1.5] tracking-[.02em] text-[#3f4636]">
          {venueAddressLines[1]}
        </div>

        <a
          href={DIRECTIONS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-[1.3cqw] inline-block whitespace-nowrap rounded-full bg-[var(--green)] px-[1.3cqw] py-[0.6cqw] text-[0.56cqw] font-semibold tracking-[.14em] text-white shadow-[0_4px_16px_rgba(42,67,0,.2)] transition-[background,transform] duration-200 hover:-translate-y-px hover:bg-[#5d8d28]"
        >
          GET DIRECTIONS →
        </a>
      </div>

      <div className="h-[21cqw] rounded-[1.9cqw] bg-white/40 p-[0.25cqw] shadow-[inset_0_1px_0_rgba(255,255,255,.8),0_6px_20px_rgba(40,60,30,.12)]">
        <VenueMap active={active} fill />
      </div>
    </div>
  );
}
