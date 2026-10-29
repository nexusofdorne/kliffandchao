import Image from 'next/image';
import { Credit } from '@/components/site/chrome/Credit';
import { guestMotif, sponsorGroups, type Fabric } from '@/content/motif';

// The motif as the 3.0 design lays it out: the two sponsor palettes on the left, the guests'
// outfit ideas and palette on the right. On a narrow window the two halves stack.
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
        <div className="motif-figures">
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
              className="h-full"
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
        {/* guests screenshot the palette to shop for outfits, so the credit sits inside that crop */}
        <Credit
          prefix="PALETTE & STATIONERY"
          className="text-[var(--green)] opacity-70"
        />
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
