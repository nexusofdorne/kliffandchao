import type { MotifGroup as MotifGroupData } from '@/content/motif';

type MotifGroupProps = { group: MotifGroupData };

// One palette + attire note per entourage group, expanding in place to show
// attire samples — <details>, not a custom disclosure, so the browser
// supplies the open/close state, keyboard handling and correct ARIA for
// free. Inside the desktop grid the row simply grows taller, which is the
// "expand, don't cover the page" ask — prototype/index.html's .motif-row.
export function MotifGroup({ group }: MotifGroupProps) {
  return (
    <details className="group/row glass-light self-start overflow-hidden rounded-[22px] transition-shadow duration-300 open:shadow-[0_14px_40px_rgba(28,40,14,.16)]">
      <summary className="cursor-pointer list-none px-[clamp(12px,1.4vw,22px)] py-[2.2vh] focus-visible:-outline-offset-[3px] focus-visible:outline-1 focus-visible:outline-[var(--green)] [&::-webkit-details-marker]:hidden">
        <div className="mb-[1.2vh] text-[clamp(12px,1.9vh,20px)] font-medium tracking-[-.01em]">{group.name}</div>
        <div className="mt-[1.6vh] flex flex-wrap justify-center gap-[clamp(8px,1.2vw,18px)]">
          {group.swatches.map((swatch) => (
            <div key={swatch.name} className="flex flex-col items-center gap-[.8vh]">
              <i
                style={{ background: swatch.hex }}
                className="block size-[clamp(26px,3.6vh,44px)] rounded-full shadow-[inset_0_0_0_1px_rgba(0,0,0,.12)]"
              />
              <span className="text-[9px] tracking-[.14em] text-[rgba(0,0,0,.5)]">{swatch.name}</span>
            </div>
          ))}
        </div>
        <p className="mt-[1.2vh] text-[clamp(9px,1.12vh,12px)] leading-[1.6] tracking-[.06em] text-[#4a5140]">
          {group.note}
        </p>
        <em className="mt-[1.1vh] block text-[8.5px] font-normal not-italic tracking-[.14em] text-[var(--green)] opacity-85">
          <span className="group-open/row:hidden">+ SEE ATTIRE SAMPLES</span>
          <span className="hidden group-open/row:inline">– HIDE SAMPLES</span>
        </em>
      </summary>
      <div className="animate-[fadeup_.38s_cubic-bezier(.16,1,.3,1)_both] px-[clamp(12px,1.4vw,22px)] pb-[2.4vh] before:mb-[2vh] before:block before:h-px before:bg-[rgba(20,24,13,.12)] before:content-['']">
        <div className="grid grid-cols-3 gap-[clamp(6px,.7vw,10px)]">
          {group.samples.map((sample, index) => (
            <div key={`${sample.label}-${index}`} className="text-center">
              <i
                style={{ background: sample.hex }}
                className="block aspect-[3/4] rounded-[14px] bg-cover bg-center shadow-[inset_0_0_0_1px_rgba(20,24,13,.10)]"
              />
              <span className="mt-[.8vh] block text-[7.5px] leading-[1.5] tracking-[.1em] text-[#4a5140]">
                {sample.label}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-[1.6vh] text-[clamp(9px,1.12vh,12px)] leading-[1.6] tracking-[.06em] text-[#4a5140]">
          Placeholder tiles — swap each for a real outfit photo.
        </p>
      </div>
    </details>
  );
}
