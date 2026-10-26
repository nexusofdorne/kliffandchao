'use client';

import gsap from 'gsap';
import Image from 'next/image';
import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { sceneAssets as a } from '@/config/scene-layers.generated';
import { journeyWindow, stageBox } from '@/config/glass-windows';
import { chapterLayouts, type WindowBox } from '@/config/journey-layout';
import { journeyChapters } from '@/content/chapters';
import { easings } from './ease';
import { GlassWindow } from './GlassWindow';
import { Stage, boxStyle } from './Stage';
import { useScene } from './SceneProvider';
import { playToEnd, prefersReducedMotion, sleep } from './timing';

// Screen 04 (prototype-v3 "04 · journey"): a meadow (WorldScene draws it) with a folder. The cursor
// glides in, double-clicks it, and a frosted glass window grows out of it with
// five chapter tabs. Everything in the window is real: the tab labels, the
// paragraphs, the photos and the (still empty) film slot, and the glass is CSS
// (GlassWindow).

export type JourneyHandle = {
  parts: () => {
    stage: HTMLElement | null;
    window: HTMLElement | null;
    folder: HTMLElement | null;
  };
  /** Back to the folder on the meadow, window closed, nothing selected. */
  reset: () => void;
};

const win = stageBox(journeyWindow);
const TABS = journeyChapters.map((chapter, i) => ({
  id: `journey-tab-${i + 1}`,
  label: chapter.tabLabel ?? chapter.title,
}));

// the window fades with --win-o (see GlassWindow), never opacity or filter
const ANIMATED = 'transform,--win-o,visibility,transformOrigin';
const rel = (box: WindowBox) => ({
  left: `${box.x}%`,
  top: `${box.y}%`,
  width: `${box.w}%`,
  height: `${box.h}%`,
});

/** Where the window grows from: the folder's centre, as % of the window. */
function folderOrigin(folder: { x: number; y: number; w: number; h: number }) {
  const fx = ((folder.x + folder.w / 2 - win.x) / win.w) * 100;
  const fy = ((folder.y + folder.h / 2 - win.y) / win.h) * 100;
  return `${fx}% ${fy}%`;
}

export function JourneyScene({ ref }: { ref?: Ref<JourneyHandle> }) {
  const { state, registerPlayer, setWindowOpen, goToTab } = useScene();
  const stageRef = useRef<HTMLDivElement>(null);
  const windowRef = useRef<HTMLDivElement>(null);
  const folderRef = useRef<HTMLButtonElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const shown = useRef(0); // 0 = no tab raised yet, 1..5 = a chapter
  const [raised, setRaised] = useState(0);

  const q = (sel: string) =>
    Array.from(windowRef.current?.querySelectorAll<HTMLElement>(sel) ?? []);

  /** The tab swap: the tab's raise is CSS; the old words fade out as the new ones fade in. */
  function setTab(n: number, instant = false) {
    const prev = shown.current;
    shown.current = n;
    setRaised(n);
    const panes = q('[data-pane]');
    if (instant || prefersReducedMotion()) {
      panes.forEach((p, i) => gsap.set(p, { opacity: i + 1 === n ? 1 : 0 }));
      return;
    }
    if (prev === n) return;
    if (prev > 0) gsap.to(panes[prev - 1], { opacity: 0, duration: 0.3 });
    if (n > 0) gsap.fromTo(panes[n - 1], { opacity: 0 }, { opacity: 1, duration: 0.48, delay: 0.1 });
  }

  function reset() {
    const w = windowRef.current;
    // only what the animations set: the inline left/top/size are the layout
    gsap.set(w, { clearProps: ANIMATED });
    gsap.set(w, { visibility: 'hidden' });
    gsap.set(cursorRef.current, { clearProps: ANIMATED });
    folderRef.current?.classList.remove('is-selected');
    gsap.set(folderRef.current, { clearProps: 'opacity' });
    setTab(0, true);
  }

  async function openWindow(tab: number) {
    const w = windowRef.current;
    if (!w) return;
    setTab(0, true);
    gsap.set(w, { visibility: 'visible', transformOrigin: folderOrigin(a.j00_folder) });
    if (prefersReducedMotion()) {
      gsap.set(w, { '--win-o': 1 });
    } else {
      const tl = gsap.timeline();
      tl.fromTo(
        w,
        { scale: 0.2, '--win-o': 0 },
        {
          keyframes: {
            '35%': { scale: 0.55, '--win-o': 0.75 },
            '100%': { scale: 1, '--win-o': 1 },
          },
          easeEach: easings.grow,
          duration: 0.8,
          clearProps: 'transform',
        },
      );
      await playToEnd(tl);
    }
    folderRef.current?.classList.remove('is-selected');
    await sleep(150);
    setTab(tab);
    await sleep(prefersReducedMotion() ? 0 : 500);
  }

  async function cursorFlourish() {
    const cursor = cursorRef.current;
    const folder = folderRef.current;
    if (!cursor || !folder) return;
    gsap.set(cursor, { transformOrigin: '10% 5%' });
    const tl = gsap.timeline();
    tl.fromTo(
      cursor,
      { opacity: 0, xPercent: 520, yPercent: 280 },
      {
        keyframes: {
          '45%': { opacity: 1, xPercent: 180, yPercent: 70 },
          '100%': { opacity: 1, xPercent: 0, yPercent: 0 },
        },
        easeEach: easings.cursor,
        duration: 1.3,
      },
    );
    await playToEnd(tl);
    await sleep(380);
    // onto the folder, then a double click
    const onFolder = { xPercent: -58, yPercent: -16 };
    const move = gsap.timeline();
    move.to(cursor, { ...onFolder, duration: 0.36, ease: 'power1.inOut' });
    await playToEnd(move);
    for (let i = 0; i < 2; i++) {
      folder.classList.add('is-selected');
      const click = gsap.timeline();
      click.to(cursor, { scale: 0.84, duration: 0.075 }).to(cursor, { scale: 1, duration: 0.075 });
      await playToEnd(click);
      await sleep(60);
    }
    gsap.to(cursor, { opacity: 0, duration: 0.5, delay: 0.15 });
  }

  async function closeWindow() {
    const w = windowRef.current;
    if (!w) return;
    gsap.set(w, { transformOrigin: folderOrigin(a.j00_folder) });
    if (!prefersReducedMotion()) {
      const tl = gsap.timeline();
      tl.fromTo(w, { scale: 1, '--win-o': 1 }, { scale: 0.06, '--win-o': 0, duration: 0.52, ease: easings.shrink });
      await playToEnd(tl);
    }
    gsap.set(w, { visibility: 'hidden', clearProps: 'transform,--win-o' });
    shown.current = 0;
    setTab(0, true);
  }

  useEffect(() => {
    const offs = [
      registerPlayer('journey-open', async (move) => {
        const folder = folderRef.current;
        if (move.auto && !prefersReducedMotion()) {
          await cursorFlourish();
        } else {
          folder?.classList.add('is-selected');
          await sleep(160);
        }
        await openWindow(move.to.journeyTab);
      }),
      registerPlayer('journey-close', closeWindow),
      registerPlayer('journey-tab', async (move) => {
        setTab(move.to.journeyTab);
        await sleep(prefersReducedMotion() ? 0 : 650);
      }),
    ];
    return () => offs.forEach((off) => off());
    // the players use refs and module scope only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registerPlayer]);

  useImperativeHandle(ref, () => ({
    parts: () => ({
      stage: stageRef.current,
      window: windowRef.current,
      folder: folderRef.current,
    }),
    reset,
  }));

  const open = state.scene === 'journey' && state.journeyOpen;

  return (
    <Stage>
      <div ref={stageRef} className="absolute inset-0">
        <button
          ref={folderRef}
          type="button"
          aria-label="Open the journey folder"
          aria-expanded={open}
          onClick={() => setWindowOpen(true)}
          className="stage-folder absolute cursor-pointer"
          style={boxStyle(a.j00_folder)}
        >
          <Image
            src={a.j00_folder.src}
            alt=""
            width={a.j00_folder.px[0]}
            height={a.j00_folder.px[1]}
            unoptimized
            draggable={false}
            className="block h-full w-full max-w-none"
          />
        </button>

        <GlassWindow
          ref={windowRef}
          spec={journeyWindow}
          label="Our journey"
          tabs={TABS}
          selected={raised - 1}
          onSelect={(i) => goToTab(i + 1)}
          onClose={() => setWindowOpen(false)}
        >
          {journeyChapters.map((chapter, i) => {
            const layout = chapterLayouts[i];
            const photos = a.chapters[String(i + 1) as keyof typeof a.chapters];
            return (
              <section
                key={chapter.title}
                data-pane=""
                aria-hidden={!active(open, state.journeyTab, i)}
                className="pointer-events-none absolute inset-0 z-[4] opacity-0"
              >
                <div
                  className="absolute grid place-items-center overflow-hidden rounded-[2.1cqw] bg-[#343434]"
                  style={rel(layout.video)}
                >
                  {chapter.video ? (
                    <video
                      src={chapter.video}
                      muted
                      loop
                      playsInline
                      autoPlay
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-[0.62cqw] uppercase tracking-[0.3em] text-white/30">
                      Film coming soon
                    </span>
                  )}
                </div>
                {photos.map((photo) => (
                  <Image
                    key={photo.src}
                    src={photo.src}
                    alt=""
                    width={photo.px[0]}
                    height={photo.px[1]}
                    unoptimized
                    draggable={false}
                    className="absolute max-w-none rounded-[1.15cqw] object-cover"
                    style={rel(photo)}
                  />
                ))}
                <div
                  className="pointer-events-auto absolute text-[0.8cqw] leading-[1.55] text-[#14160f]"
                  style={rel(layout.text)}
                >
                  {chapter.paragraphs.map((paragraph) => (
                    <p key={paragraph} className="m-0 mb-[0.85cqw]">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </section>
            );
          })}
        </GlassWindow>

        <div
          ref={cursorRef}
          className="pointer-events-none absolute opacity-0"
          style={{ ...boxStyle(a.cursor), transformOrigin: '10% 5%' }}
        >
          <Image
            src={a.cursor.src}
            alt=""
            width={a.cursor.px[0]}
            height={a.cursor.px[1]}
            unoptimized
            draggable={false}
            className="block h-full w-full max-w-none"
          />
        </div>
      </div>
    </Stage>
  );
}

const active = (open: boolean, tab: number, i: number) => open && tab === i + 1;
