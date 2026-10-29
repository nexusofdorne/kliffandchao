'use client';

import Image from 'next/image';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { MediaItem } from '@/lib/journey/gallery';

// A chapter's film or photo shown big (a film plays, looping, with controls): the arrows (and
// ← →) step through the chapter's files, Esc, the
// close button or a click outside closes it. It is marked data-scene-modal, so the scene ignores
// the wheel and keys while it is open (SceneProvider), and rendered into <body> so it sits over
// the whole stage.
export function PhotoLightbox({
  photos,
  index,
  onIndex,
  onClose,
}: {
  photos: readonly MediaItem[];
  index: number;
  onIndex: (index: number) => void;
  onClose: () => void;
}) {
  const count = photos.length;
  const step = (by: number) => onIndex((index + by + count) % count);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      else if (event.key === 'ArrowRight') onIndex((index + 1) % count);
      else if (event.key === 'ArrowLeft') onIndex((index - 1 + count) % count);
      else return;
      event.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, count, onIndex, onClose]);

  const photo = photos[index];
  if (!photo) return null;
  const arrow =
    'grid size-[48px] place-items-center rounded-full bg-white/15 text-white backdrop-blur-md transition-colors duration-200 hover:bg-white/30';

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${index + 1} of ${count}`}
      data-scene-modal=""
      className="photo-lightbox fixed inset-0 z-[200] flex items-center justify-center bg-[rgba(10,12,8,.82)] backdrop-blur-sm"
      onClick={onClose}
      onWheel={(event) => event.stopPropagation()}
    >
      {photo.src.endsWith('.mp4') ? (
        <video
          key={photo.src}
          src={photo.src}
          autoPlay
          loop
          muted
          playsInline
          controls
          className="block max-h-[86vh] w-auto max-w-[88vw] rounded-[18px] bg-black shadow-[0_20px_60px_rgba(0,0,0,.45)]"
          onClick={(event) => event.stopPropagation()}
        />
      ) : (
        <Image
          key={photo.src}
          src={photo.src}
          alt=""
          width={photo.px[0]}
          height={photo.px[1]}
          unoptimized
          draggable={false}
          className="block max-h-[86vh] w-auto max-w-[88vw] rounded-[18px] object-contain shadow-[0_20px_60px_rgba(0,0,0,.45)]"
          onClick={(event) => event.stopPropagation()}
        />
      )}
      {count > 1 ? (
        <>
          <button
            type="button"
            aria-label="Previous photo"
            className={`${arrow} absolute left-[3vw] top-1/2 -translate-y-1/2`}
            onClick={(event) => {
              event.stopPropagation();
              step(-1);
            }}
          >
            <Chevron flip />
          </button>
          <button
            type="button"
            aria-label="Next photo"
            className={`${arrow} absolute right-[3vw] top-1/2 -translate-y-1/2`}
            onClick={(event) => {
              event.stopPropagation();
              step(1);
            }}
          >
            <Chevron />
          </button>
        </>
      ) : null}
      <p className="absolute bottom-[3vh] left-1/2 m-0 -translate-x-1/2 text-[12px] tracking-[.14em] text-white/70">
        {index + 1} / {count}
      </p>
      <button
        type="button"
        aria-label="Close photo"
        autoFocus
        className={`${arrow} absolute right-[3vw] top-[3vh]`}
        onClick={onClose}
      >
        <svg
          viewBox="0 0 24 24"
          className="size-[18px]"
          stroke="currentColor"
          strokeWidth={2}
          fill="none"
          aria-hidden="true"
        >
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>
    </div>,
    document.body,
  );
}

function Chevron({ flip = false }: { flip?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-[20px]"
      style={flip ? { transform: 'scaleX(-1)' } : undefined}
      stroke="currentColor"
      strokeWidth={2}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}
