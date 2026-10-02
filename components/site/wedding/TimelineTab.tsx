import { daySchedule, timelineIntroLines, type ScheduleStop } from '@/content/wedding';

const ICONS: Record<ScheduleStop['icon'], string> = {
  door: 'M14 3H6v18h8M14 3l4 2v14l-4 2M10 12h.01',
  ring: 'M12 21a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM9 8l3-5 3 5',
  glass: 'M8 3h8l-1 6a3 3 0 0 1-6 0L8 3zM12 12v8M9 21h6',
  music: 'M9 18V6l10-2v12M9 18a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0zM19 16a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z',
  plate: 'M5 3v8a3 3 0 0 0 6 0V3M8 3v18M17 3c-1.5 2-2 4-2 6s.5 3 2 3 2-1 2-3-.5-4-2-6zM17 12v9',
  wave: 'M12 21a9 9 0 0 0 9-9M8 13V6a1.5 1.5 0 0 1 3 0v5M11 11V4.5a1.5 1.5 0 0 1 3 0V11M14 11V6a1.5 1.5 0 0 1 3 0v7M8 13l-2-2a1.5 1.5 0 0 0-2 2l3 5',
};

// A vertical spine with an olive circular node per stop, each carrying its
// own icon — redesigned from the PDF's horizontal axis, following
// wedding.jongjeonglee.com (docs/PLAN.md "TIMELINE"). The list scrolls in
// its own area on mobile only; desktop has room for all six stops.
export function TimelineTab() {
  return (
    <div>
      <p className="text-[clamp(10px,1.35vh,14px)] leading-[1.9] text-[#3a4030]">
        {timelineIntroLines.map((line) => (
          <span key={line}>
            {line}
            <br />
          </span>
        ))}
      </p>

      <div className="group relative mx-auto mt-0 w-[min(80vw,330px)]">
        <div className="day-timeline">
          <div className="day-timeline-inner">
            {daySchedule.map((stop) => (
              <div
                key={stop.label}
                className="relative mb-[1vh] grid grid-cols-[auto_1fr] items-center gap-x-[1.5rem] rounded-[22px] py-[1.7vh] pl-[1.6rem] pr-[1.4rem] text-left transition-colors duration-300 hover:bg-white/50"
              >
                <span className="z-[1] grid size-[25px] flex-none place-items-center rounded-full bg-[var(--green)] text-white shadow-[0_0_0_5px_#f5f3ed,0_2px_8px_rgba(42,67,0,.3)]">
                  <svg
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    fill="none"
                    strokeWidth={1.7}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    className="size-[12px]"
                  >
                    <path d={ICONS[stop.icon]} />
                  </svg>
                </span>
                <span>
                  <b className="block text-[clamp(11px,1.5vh,16px)] font-semibold tracking-[.05em]">{stop.time}</b>
                  <span className="mt-[.3vh] block text-[clamp(9px,1.12vh,12px)] tracking-[.14em] text-[#4a5140]">
                    {stop.label}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Fades in on :hover over the list, since a nested scroll area is
            otherwise invisible — only matters on mobile, where the list
            actually scrolls. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-[6px] left-1/2 z-[3] flex -translate-x-1/2 flex-col items-center gap-[3px] opacity-0 transition-opacity duration-300 ease-in-out group-hover:opacity-75 max-[768px]:hidden"
        >
          <span className="relative h-[27px] w-[17px] rounded-[9px] border-[1.4px] border-[var(--olive)] after:absolute after:left-1/2 after:top-[5px] after:h-[5px] after:w-[2.5px] after:-translate-x-1/2 after:rounded-[2px] after:bg-[var(--olive)] after:content-[''] after:[animation:wheel-dot_1.5s_ease-in-out_infinite]" />
          <em className="text-[7.5px] not-italic tracking-[.14em] text-[var(--olive)]">SCROLL</em>
        </div>
      </div>
    </div>
  );
}
