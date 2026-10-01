'use client';

import type { Chapter } from '@/content/chapters';

type ChapterStepperProps = {
  chapters: Chapter[];
  activeChapterIndex: number;
  onSelectChapter: (chapterIndex: number) => void;
};

// Hairline rule + one circle per chapter — prototype/index.html's .chapsel.
// Each item is one column owning both its dot and label, so they can't
// drift apart as label widths change (the same trap, and the same fix, as
// the top bar's section nav).
export function ChapterStepper({ chapters, activeChapterIndex, onSelectChapter }: ChapterStepperProps) {
  return (
    <nav aria-label="Chapters" className="relative flex w-[min(86vw,620px)] flex-none max-[768px]:w-[91vw]">
      <div className="pointer-events-none absolute left-[10%] right-[10%] top-[3px] h-px bg-current opacity-30" aria-hidden="true" />
      {chapters.map((chapter, index) => {
        const isActive = index === activeChapterIndex;
        return (
          <button
            key={chapter.number}
            type="button"
            onClick={() => onSelectChapter(index)}
            aria-label={`Go to chapter ${index + 1} — ${chapter.title}`}
            className={`group relative flex flex-1 flex-col items-center gap-[1.15vh] whitespace-nowrap pb-1 text-[clamp(7.5px,.98vh,10px)] tracking-[.14em] transition-opacity duration-[.28s] focus-visible:outline-none max-[768px]:pb-[2px] max-[768px]:text-[7.5px] max-[768px]:tracking-[.09em] ${
              isActive ? 'font-semibold opacity-100' : 'opacity-45 hover:opacity-80'
            }`}
          >
            <i
              aria-hidden="true"
              className={`block size-[7px] rounded-full bg-current transition-transform duration-[.32s] ease-[cubic-bezier(.16,1,.3,1)] group-focus-visible:shadow-[0_0_0_4px_rgba(157,203,90,.45)] ${
                isActive ? 'scale-[1.85]' : ''
              }`}
            />
            <span>CHAPTER {index + 1}</span>
          </button>
        );
      })}
    </nav>
  );
}
