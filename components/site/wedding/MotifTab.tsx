import { motifGroups } from '@/content/motif';
import { siteConfig } from '@/config/site';
import { MotifGroup } from './MotifGroup';

// Desktop lays all five groups out as a 3-column grid — no scroll, no
// wasted space; mobile turns it back into a single scrolling column (the
// .motif-grid media query in globals.css). prototype/index.html's
// .motif-scroll.
export function MotifTab() {
  return (
    <div>
      <div className="mx-auto mt-[2vh] w-[min(92vw,900px)]">
        <div className="motif-grid">
          {motifGroups.map((group) => (
            <MotifGroup key={group.name} group={group} />
          ))}
        </div>
      </div>

      {/* Sits tight under the swatch grid on purpose: guests screenshot the
          motif palette to shop for outfits, so the credit has to be inside
          that crop. */}
      <p className="mt-[2.4vh]">
        <a
          href={siteConfig.chaodesignUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-[7px] text-[9px] font-semibold tracking-[.14em] text-[var(--green)] opacity-70 transition-opacity duration-300 hover:opacity-100 focus-visible:opacity-100"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="size-[12px] flex-none stroke-current" strokeWidth={1.6} fill="none">
            <rect x="3" y="3" width="18" height="18" rx="5" />
            <circle cx="12" cy="12" r="4" />
            <circle cx="17.2" cy="6.8" r="1.2" fill="currentColor" stroke="none" />
          </svg>
          <span>
            PALETTE &amp; STATIONERY BY <b className="font-semibold tracking-[.1em]">CHAODESIGN.PH</b>
          </span>
        </a>
      </p>

      <p className="mt-[3vh] text-[11px] leading-[2] tracking-[.14em] text-[rgba(0,0,0,.5)]">
        All palettes and attire notes are placeholder — swap for the real motif.
      </p>
    </div>
  );
}
