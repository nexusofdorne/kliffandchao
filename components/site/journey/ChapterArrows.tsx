'use client';

type ChapterArrowsProps = {
  onPrev: () => void;
  onNext: () => void;
};

// Glass discs flanking the rail, hidden on mobile where swipe replaces them
// — prototype/index.html's .jnav. They step a whole CHAPTER: the photos
// are already reachable by scrolling and by clicking a card, so per-photo
// arrows would just read as chapter navigation anyway.
export function ChapterArrows({ onPrev, onNext }: ChapterArrowsProps) {
  return (
    <>
      <button
        type="button"
        onClick={onPrev}
        aria-label="Previous chapter"
        className="glass absolute left-[2.4vw] top-1/2 z-[6] grid size-[clamp(40px,5.2vh,52px)] -translate-y-1/2 place-items-center rounded-full transition-transform duration-300 ease-[cubic-bezier(.16,1,.3,1)] hover:scale-[1.07] max-[768px]:hidden"
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="h-[36%] w-[36%]"
          stroke="currentColor"
          fill="none"
          strokeWidth={2}
          strokeLinecap="round"
        >
          <path d="M15 5l-7 7 7 7" />
        </svg>
      </button>
      <button
        type="button"
        onClick={onNext}
        aria-label="Next chapter"
        className="glass absolute right-[2.4vw] top-1/2 z-[6] grid size-[clamp(40px,5.2vh,52px)] -translate-y-1/2 place-items-center rounded-full transition-transform duration-300 ease-[cubic-bezier(.16,1,.3,1)] hover:scale-[1.07] max-[768px]:hidden"
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="h-[36%] w-[36%]"
          stroke="currentColor"
          fill="none"
          strokeWidth={2}
          strokeLinecap="round"
        >
          <path d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </>
  );
}
