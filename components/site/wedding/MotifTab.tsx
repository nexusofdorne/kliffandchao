import { Credit } from '@/components/site/chrome/Credit';
import { motifGroups } from '@/content/motif';
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
        <Credit prefix="PALETTE & STATIONERY" className="text-[var(--green)] opacity-70" />
      </p>

      <p className="mt-[3vh] text-[11px] leading-[2] tracking-[.14em] text-[rgba(0,0,0,.5)]">
        All palettes and attire notes are placeholder — swap for the real motif.
      </p>
    </div>
  );
}
