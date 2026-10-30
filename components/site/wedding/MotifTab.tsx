import Image from 'next/image';
import type { CSSProperties } from 'react';
import { guestMotif, sponsorGroups, type Fabric } from '@/content/motif';

// The motif as the 3.0 design lays it out: the two sponsor palettes on the left, the guests'
// outfit ideas and palette on the right. On a narrow window the two halves stack.
const figureAspectSum = guestMotif.figures.reduce(
  (sum, f) => sum + f.px[0] / f.px[1],
  0,
);

export function MotifTab() {
  return (
    <div className="motif-layout">
      <div className="flex flex-col gap-[3.4vh]">
        {sponsorGroups.map((group) => (
          <section
            key={group.title}
            className="flex flex-col items-center gap-[1.6vh]"
          >
            <h3 className="motif-title">{group.title}</h3>
            <Swatches fabrics={group.fabrics} />
            <dl className="m-0 text-left text-[clamp(9px,1.2vh,12.5px)] leading-[1.6] text-[#2c3124]">
              {group.attire.map((line) => (
                <div key={line.who} className="flex gap-[.5em]">
                  <dt className="font-semibold">{line.who}:</dt>
                  <dd className="m-0">{line.note}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>

      <section className="flex flex-col items-center gap-[1.8vh]">
        <h3 className="motif-title">{guestMotif.title}</h3>
        {/* every outfit is drawn at the same height (each takes width in proportion to its own
            shape), the women first, then the men; on a narrow window they wrap into those rows */}
        <div
          className="motif-figures"
          style={{ '--fig-aspect': String(figureAspectSum) } as CSSProperties}
        >
          {guestMotif.figures.map((figure) => (
            <Image
              key={figure.src}
              src={figure.src}
              alt={figure.alt}
              title={figure.alt}
              width={figure.px[0]}
              height={figure.px[1]}
              unoptimized
              draggable={false}
              className={
                figure.src.includes('/men-')
                  ? 'motif-figure motif-figure--men'
                  : 'motif-figure'
              }
              style={{
                flexGrow: figure.px[0] / figure.px[1],
                aspectRatio: `${figure.px[0]} / ${figure.px[1]}`,
              }}
            />
          ))}
        </div>
        <Swatches fabrics={guestMotif.fabrics} />
        <p className="m-0 text-[clamp(9.5px,1.3vh,13px)] font-semibold text-[#14180d]">
          {guestMotif.note}
        </p>
        <p className="m-0 -mt-[1vh] text-[clamp(8.5px,1.15vh,12px)] text-[#4a5140]">
          {guestMotif.request}
        </p>
      </section>
    </div>
  );
}

function Swatches({ fabrics }: { fabrics: readonly Fabric[] }) {
  return (
    <ul className="motif-swatches">
      {fabrics.map((fabric) => (
        <li key={fabric.src}>
          <Image
            src={fabric.src}
            alt={fabric.name}
            title={fabric.name}
            width={200}
            height={200}
            unoptimized
            draggable={false}
            className="block size-full rounded-full object-cover"
          />
        </li>
      ))}
    </ul>
  );
}
