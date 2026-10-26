'use client';

import gsap from 'gsap';
import Image from 'next/image';
import { useEffect, useImperativeHandle, useRef, useState, type ReactNode, type Ref } from 'react';
import { DetailTab } from '@/components/site/wedding/DetailTab';
import { EntourageTab } from '@/components/site/wedding/EntourageTab';
import { FaqTab } from '@/components/site/wedding/FaqTab';
import { MotifTab } from '@/components/site/wedding/MotifTab';
import { TimelineTab } from '@/components/site/wedding/TimelineTab';
import type { WeddingTab } from '@/components/site/wedding/TabBar';
import { sceneAssets as a } from '@/config/scene-layers.generated';
import { easings } from './ease';
import { useScene } from './SceneProvider';
import { Stage, StageFill, boxStyle } from './Stage';
import { playToEnd, prefersReducedMotion, sleep } from './timing';

// Screen 05 (prototype-v3 "05 · new chapter"): the river, a "new chapter"
// folder, and a frosted window with five icon tabs. The tab bodies are the
// existing wedding components (countdown, map, timeline, motif, entourage,
// FAQ); each scrolls inside the window when it is taller than it.

export type WeddingHandle = {
  parts: () => {
    stage: HTMLElement | null;
    window: HTMLElement | null;
    folder: HTMLElement | null;
    cursor: HTMLElement | null;
  };
  /** The pointer glides in and rests by the folder. */
  cursorIn: () => Promise<void>;
  /** Back to the folder on the riverbank, window closed. */
  reset: () => void;
};

const ANIMATED = 'transform,opacity,filter,visibility,transformOrigin';

// the window, as % of the stage (the prototype's measurement)
const W5 = { x: 15, y: 24.4, w: 68.8, h: 55.6 };

const icon = (paths: ReactNode) => (
  <svg viewBox="0 0 16 16" aria-hidden="true">
    {paths}
  </svg>
);

const TABS: { id: WeddingTab; label: string; icon: ReactNode }[] = [
  {
    id: 'detail',
    label: 'DETAIL',
    icon: icon(
      <>
        <path d="M8 14s4.5-4.2 4.5-7.5a4.5 4.5 0 0 0-9 0C3.5 9.8 8 14 8 14z" />
        <circle cx="8" cy="6.5" r="1.6" />
      </>,
    ),
  },
  {
    id: 'timeline',
    label: 'TIMELINE',
    icon: icon(
      <>
        <rect x="2.5" y="3.5" width="11" height="10" rx="1.5" />
        <path d="M2.5 7h11M5.5 2v3M10.5 2v3" />
      </>,
    ),
  },
  {
    id: 'motif',
    label: 'MOTIF',
    icon: icon(
      <path d="M6 2.5 3 4.5l1.3 2.3L5.5 6v7.5h5V6l1.2.8L13 4.5l-3-2a2 2 0 0 1-4 0z" />,
    ),
  },
  {
    id: 'entourage',
    label: 'ENTOURAGE',
    icon: icon(
      <>
        <circle cx="6" cy="5.5" r="2" />
        <circle cx="11.5" cy="6.5" r="1.6" />
        <path d="M2.5 13c0-2.2 1.6-3.8 3.5-3.8s3.5 1.6 3.5 3.8M10 9.6c1.6 0 3 1.2 3 3.2" />
      </>,
    ),
  },
  {
    id: 'faq',
    label: 'FAQ',
    icon: icon(
      <>
        <circle cx="8" cy="8" r="5.5" />
        <path d="M6.3 6.4a1.8 1.8 0 1 1 2.4 1.7c-.5.2-.7.6-.7 1.1M8 11.2v.1" />
      </>,
    ),
  },
];

export function WeddingScene({ ref }: { ref?: Ref<WeddingHandle> }) {
  const { state, registerPlayer, setWindowOpen } = useScene();
  const [tab, setTab] = useState<WeddingTab>('detail');
  const stageRef = useRef<HTMLDivElement>(null);
  const windowRef = useRef<HTMLDivElement>(null);
  const folderRef = useRef<HTMLButtonElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);

  const open = state.scene === 'wedding' && state.weddingOpen;

  function folderOrigin() {
    const f = a.j05_folder;
    return `${((f.x + f.w / 2 - W5.x) / W5.w) * 100}% ${((f.y + f.h / 2 - W5.y) / W5.h) * 100}%`;
  }

  function reset() {
    gsap.set(windowRef.current, { clearProps: ANIMATED });
    gsap.set(windowRef.current, { visibility: 'hidden' });
    gsap.set(cursorRef.current, { opacity: 0 });
    gsap.set(folderRef.current, { clearProps: 'opacity' });
    folderRef.current?.classList.remove('is-selected');
  }

  async function cursorIn() {
    const cursor = cursorRef.current;
    if (!cursor) return;
    if (prefersReducedMotion()) {
      gsap.set(cursor, { opacity: 1 });
      return;
    }
    gsap.set(cursor, { transformOrigin: '10% 5%' });
    const tl = gsap.timeline();
    tl.fromTo(
      cursor,
      { opacity: 0, xPercent: 480, yPercent: 300 },
      {
        keyframes: {
          '45%': { opacity: 1, xPercent: 160, yPercent: 80 },
          '100%': { opacity: 1, xPercent: 0, yPercent: 0 },
        },
        easeEach: easings.cursor,
        duration: 1.3,
      },
    );
    await playToEnd(tl);
  }

  async function openWindow() {
    const w = windowRef.current;
    if (!w) return;
    gsap.to(cursorRef.current, { opacity: 0, duration: 0.3 });
    folderRef.current?.classList.add('is-selected');
    await sleep(160);
    gsap.set(w, { visibility: 'visible', transformOrigin: folderOrigin() });
    if (!prefersReducedMotion()) {
      const tl = gsap.timeline();
      tl.fromTo(
        w,
        { scale: 0.2, opacity: 0, filter: 'blur(6px)' },
        {
          keyframes: {
            '35%': { scale: 0.55, opacity: 0.75, filter: 'blur(3px)' },
            '100%': { scale: 1, opacity: 1, filter: 'blur(0px)' },
          },
          easeEach: easings.grow,
          duration: 0.8,
          // a leftover filter would switch off the frosted glass
          clearProps: 'filter,transform',
        },
      );
      await playToEnd(tl);
    } else {
      gsap.set(w, { opacity: 1 });
    }
    folderRef.current?.classList.remove('is-selected');
  }

  async function closeWindow() {
    const w = windowRef.current;
    if (!w) return;
    gsap.set(w, { transformOrigin: folderOrigin() });
    if (!prefersReducedMotion()) {
      const tl = gsap.timeline();
      tl.fromTo(w, { scale: 1, opacity: 1 }, { scale: 0.06, opacity: 0, duration: 0.52, ease: easings.shrink });
      await playToEnd(tl);
    }
    gsap.set(w, { visibility: 'hidden', clearProps: 'transform,opacity' });
  }

  useEffect(() => {
    const offs = [
      registerPlayer('wedding-open', openWindow),
      registerPlayer('wedding-close', closeWindow),
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
      cursor: cursorRef.current,
    }),
    cursorIn,
    reset,
  }));

  const panel = (id: WeddingTab, children: ReactNode) => (
    <div
      id={`w5-panel-${id}`}
      role="tabpanel"
      className={`wedding-tab-panel ${tab === id ? 'is-active' : ''}`}
      data-scene-scroll=""
      hidden={tab !== id}
    >
      {children}
    </div>
  );

  return (
    <Stage>
      <div ref={stageRef} className="absolute inset-0">
        <StageFill asset={a.j05_bg} />

        <button
          ref={folderRef}
          type="button"
          aria-label="Open the new chapter folder"
          aria-expanded={open}
          onClick={() => setWindowOpen(true)}
          className="stage-folder absolute cursor-pointer"
          style={boxStyle(a.j05_folder)}
        >
          <Image
            src={a.j05_folder.src}
            alt=""
            width={a.j05_folder.px[0]}
            height={a.j05_folder.px[1]}
            unoptimized
            draggable={false}
            className="block h-full w-full max-w-none"
          />
        </button>

        <div
          ref={windowRef}
          role="dialog"
          aria-label="The wedding"
          className="w5"
        >
          <div className="w5-bar" role="tablist">
            <button
              type="button"
              aria-label="Close window"
              className="w5-dot w5-dot--close"
              onClick={() => setWindowOpen(false)}
            />
            <i className="w5-dot w5-dot--mid" />
            <i className="w5-dot w5-dot--end" />
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                aria-controls={`w5-panel-${t.id}`}
                onClick={() => setTab(t.id)}
                className="w5-tab"
              >
                {t.icon}
                {t.label}
              </button>
            ))}
            <span className="w5-rest" />
          </div>
          <div className="w5-body">
            {panel('detail', <DetailTab active={open && tab === 'detail'} />)}
            {panel('timeline', <TimelineTab />)}
            {panel('motif', <MotifTab />)}
            {panel('entourage', <EntourageTab />)}
            {panel('faq', <FaqTab />)}
          </div>
        </div>

        <div
          ref={cursorRef}
          className="pointer-events-none absolute opacity-0"
          style={{
            left: `${a.j05_cursor.x}%`,
            top: `${a.j05_cursor.y}%`,
            width: `${a.cursor.w}%`,
            height: `${a.cursor.h}%`,
            transformOrigin: '10% 5%',
          }}
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
