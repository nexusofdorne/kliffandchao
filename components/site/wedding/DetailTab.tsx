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

type DetailTabProps = { active: boolean };

// Keep a "Get directions" button alongside the embed: guests navigate from
// their phones, and the directions link opens the native Google/Apple Maps
// app rather than a cramped in-page frame. The embed is for orientation;
// the button is for actually getting there — docs/PLAN.md "The map is
// embedded, not a link out".
export function DetailTab({ active }: DetailTabProps) {
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
