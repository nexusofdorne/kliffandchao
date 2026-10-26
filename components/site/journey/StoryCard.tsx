'use client';

import Image from 'next/image';
import { forwardRef, type KeyboardEvent } from 'react';
import type { Chapter, FlatStory } from '@/content/chapters';

type StoryCardProps = {
  story: FlatStory;
  chapter: Chapter;
  isActive: boolean;
  priority: boolean;
  onSelect: () => void;
};

// prototype/index.html's .cf — a polaroid-ish photocard: photo, a veil
// gradient so the top/bottom text stays legible over any photo, and a rim
// that's its own layer rather than a border (a border would sit outside
// the overflow-clipped photo and leave a hairline gap at the corners).
export const StoryCard = forwardRef<HTMLDivElement, StoryCardProps>(function StoryCard(
  { story, chapter, isActive, priority, onSelect },
  ref,
) {
  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect();
    }
  }

  return (
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      aria-label={story.caption ? `${chapter.title} — ${story.caption}` : chapter.title}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      className={`coverflow-card cursor-pointer overflow-hidden rounded-[30px] bg-[#1a1f12] text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[var(--lime)] ${
        isActive ? 'is-active' : ''
      }`}
    >
      <Image
        src={story.image}
        alt=""
        fill
        sizes="(max-width: 768px) 74vw, 400px"
        priority={priority}
        draggable={false}
        className="object-cover"
      />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(6,10,4,.62)_0%,rgba(6,10,4,.06)_34%,rgba(6,10,4,.10)_52%,rgba(6,10,4,.78)_100%)]" />
      <div className="pointer-events-none absolute inset-0 rounded-[inherit] border border-[var(--glass-rim)] shadow-[inset_0_1px_0_rgba(255,255,255,.18)]" />
      <div className="absolute inset-x-0 top-0 p-[clamp(14px,2vh,24px)_clamp(14px,1.5vw,24px)]">
        <div className="mb-[1vh] text-[8.5px] tracking-[.14em] opacity-[.72]">
          {chapter.number} &middot; {chapter.title}
        </div>
        {story.caption ? (
          <div className="text-[clamp(13px,2.05vh,22px)] font-semibold leading-[1.2] tracking-[-.01em]">
            {story.caption}
          </div>
        ) : null}
      </div>
      <div className="absolute inset-x-0 bottom-0 p-[clamp(14px,2vh,24px)_clamp(14px,1.5vw,24px)]">
        <span className="text-[9.5px] tracking-[.14em] opacity-85 [font-variant-numeric:tabular-nums]">
          {String(story.storyIndexInChapter + 1).padStart(2, '0')} / {String(story.storyCountInChapter).padStart(2, '0')}
        </span>
      </div>
    </div>
  );
});
