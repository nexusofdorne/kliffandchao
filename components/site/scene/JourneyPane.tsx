'use client';

import Image from 'next/image';
import { createContext, useContext, useState, type CSSProperties } from 'react';
import { journeyWindow, plateBox } from '@/config/glass-windows';
import type { JourneyChapter } from '@/content/chapters';
import {
  aspectOf,
  estimateTextHeight,
  planGallery,
  type GalleryPlan,
  type JourneyMedia,
  type MediaItem,
} from '@/lib/journey/gallery';
import { PhotoLightbox } from './PhotoLightbox';

// One chapter inside the journey window, laid out like the 3.0 designs: the chapter's film on
// the left at full height, then its photos in order, with the words sharing the space with them
// (a narrow column of words before the photos, or the words beside the last photo under the
// others), whichever leaves the least empty space (lib/journey/gallery). Sizes are in mockup
// pixels (--px), so the window keeps its proportions at any screen size. A photo opens big in
// PhotoLightbox when clicked.

const PLATE = plateBox(journeyWindow);
const PLATE_W =
  journeyWindow.body.x1 - journeyWindow.body.x0 - journeyWindow.inset * 2;
const PLATE_H =
  journeyWindow.body.y1 - journeyWindow.body.y0 - journeyWindow.inset * 2;
const PAD = 26;
const GAP = 12;
const TYPE = {
  fontSize: 14,
  charWidth: 7.1,
  lineHeight: 19.5,
  paragraphGap: 12,
};
/** The widths a column of words may take, and the narrowest they may get beside a photo. */
const TEXT_COLUMNS = [170, 200, 240, 290] as const;
const MIN_TEXT_BESIDE_PHOTO = 300;

const px = (n: number) => `calc(var(--px) * ${n})`;

/** Opens a photo in the viewer, or null on a chapter that isn't showing (its photos are faded
 *  out but still there, and mustn't take clicks). Provided by JourneyPane. */
const OpenPhoto = createContext<((photo: MediaItem) => void) | null>(null);

function layoutFor(chapter: JourneyChapter, media: JourneyMedia) {
  const innerH = PLATE_H - PAD * 2;
  const filmW = media.film ? Math.round(innerH * aspectOf(media.film)) : 0;
  const rightW = PLATE_W - PAD * 2 - (filmW ? filmW + PAD : 0);
  // a little slack on the estimate, so the words never quite reach their box's edge
  const textHeight = (w: number) =>
    estimateTextHeight(chapter.paragraphs, w, TYPE) * 1.08;
  const plan = planGallery({
    aspects: media.photos.map(aspectOf),
    width: rightW,
    height: innerH,
    gap: GAP,
    textHeight,
    textColumns: TEXT_COLUMNS,
    minTextWidth: MIN_TEXT_BESIDE_PHOTO,
  });
  return { filmW, rightW, plan };
}

function Photo({ photo, style }: { photo: MediaItem; style: CSSProperties }) {
  const open = useContext(OpenPhoto);
  return (
    <Image
      src={photo.src}
      alt="Open this photo bigger"
      width={photo.px[0]}
      height={photo.px[1]}
      unoptimized
      draggable={false}
      loading="lazy"
      role="button"
      tabIndex={open ? 0 : -1}
      onClick={() => open?.(photo)}
      onKeyDown={(event) => {
        if (!open || (event.key !== 'Enter' && event.key !== ' ')) return;
        event.preventDefault();
        open(photo);
      }}
      className={`block h-auto min-w-0 max-w-none object-cover ${open ? 'pointer-events-auto cursor-zoom-in' : ''}`}
      style={{ borderRadius: px(16), ...style }}
    />
  );
}

/** Photos in justified rows at a basis row height (see lib/journey/gallery). */
function Rows({
  photos,
  rowHeight,
}: {
  photos: readonly MediaItem[];
  rowHeight: number;
}) {
  if (photos.length === 0) return null;
  return (
    <div
      className="journey-gallery flex flex-none flex-wrap content-start"
      style={{ gap: px(GAP) }}
    >
      {photos.map((photo) => {
        const aspect = aspectOf(photo);
        return (
          <Photo
            key={photo.src}
            photo={photo}
            style={{
              flex: `${aspect} 1 ${px(aspect * rowHeight)}`,
              aspectRatio: String(aspect),
            }}
          />
        );
      })}
    </div>
  );
}

function Words({ chapter, width }: { chapter: JourneyChapter; width: number }) {
  return (
    <div
      className="pointer-events-auto min-h-0 flex-none overflow-y-auto text-[#14160f] [scrollbar-width:none]"
      data-scene-scroll=""
      style={{
        width: px(width),
        maxHeight: '100%',
        fontSize: px(TYPE.fontSize),
        lineHeight: `${TYPE.lineHeight / TYPE.fontSize}`,
      }}
    >
      {chapter.paragraphs.map((paragraph) => (
        <p
          key={paragraph}
          className="m-0 last:mb-0"
          style={{ marginBottom: px(TYPE.paragraphGap) }}
        >
          {paragraph}
        </p>
      ))}
    </div>
  );
}

function Arrangement({
  chapter,
  photos,
  plan,
}: {
  chapter: JourneyChapter;
  photos: readonly MediaItem[];
  plan: GalleryPlan;
}) {
  if (plan.kind === 'column') {
    return (
      <div
        className="flex min-w-0 flex-1 items-center"
        style={{ gap: px(GAP * 2) }}
      >
        <Words chapter={chapter} width={plan.textWidth} />
        <div className="min-w-0 flex-1">
          <Rows photos={photos} rowHeight={plan.rowHeight} />
        </div>
      </div>
    );
  }
  const tail = photos.slice(photos.length - plan.tail);
  return (
    <div
      className="flex min-w-0 flex-1 flex-col justify-center"
      style={{ gap: px(GAP) }}
    >
      <Rows
        photos={photos.slice(0, photos.length - plan.tail)}
        rowHeight={plan.rowHeight}
      />
      <div
        className="flex flex-none items-center"
        style={{ gap: px(GAP), height: px(plan.tailHeight) }}
      >
        <div
          className="flex min-w-0 flex-1 items-center"
          style={{ paddingRight: px(GAP) }}
        >
          <Words chapter={chapter} width={plan.textWidth - GAP} />
        </div>
        {tail.map((photo) => (
          <Photo
            key={photo.src}
            photo={photo}
            style={{
              height: '100%',
              width: px(aspectOf(photo) * plan.tailHeight),
              flex: 'none',
            }}
          />
        ))}
      </div>
    </div>
  );
}

export function JourneyPane({
  chapter,
  media,
  active,
}: {
  chapter: JourneyChapter;
  media: JourneyMedia;
  active: boolean;
}) {
  const { filmW, rightW, plan } = layoutFor(chapter, media);
  const [viewing, setViewing] = useState<number | null>(null);
  const open = (photo: MediaItem) => setViewing(media.photos.indexOf(photo));
  return (
    <OpenPhoto.Provider value={active ? open : null}>
      <section
        data-pane=""
        aria-hidden={!active}
        aria-label={chapter.title}
        className="pointer-events-none absolute z-[4] flex opacity-0"
        style={{
          left: `${PLATE.x}%`,
          top: `${PLATE.y}%`,
          width: `${PLATE.w}%`,
          height: `${PLATE.h}%`,
          padding: px(PAD),
          gap: px(PAD),
        }}
      >
        {media.film ? (
          <div
            className="relative flex-none overflow-hidden bg-[#343434]"
            style={{ width: px(filmW), borderRadius: px(28) }}
          >
            <video
              src={media.film.src}
              muted
              loop
              playsInline
              autoPlay={active}
              preload={active ? 'auto' : 'metadata'}
              ref={(video) => {
                if (!video) return;
                if (active) void video.play().catch(() => {});
                else video.pause();
              }}
              className="absolute inset-0 h-full w-full object-cover"
            />
          </div>
        ) : null}
        <div className="flex min-w-0" style={{ width: px(rightW) }}>
          <Arrangement chapter={chapter} photos={media.photos} plan={plan} />
        </div>
      </section>
      {active && viewing !== null ? (
        <PhotoLightbox
          photos={media.photos}
          index={viewing}
          onIndex={setViewing}
          onClose={() => setViewing(null)}
        />
      ) : null}
    </OpenPhoto.Provider>
  );
}
