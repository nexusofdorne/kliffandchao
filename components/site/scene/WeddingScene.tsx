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
import { plateBox, stageBox, weddingWindow } from '@/config/glass-windows';
import { sceneAssets as a } from '@/config/scene-layers.generated';
import { easings } from './ease';
import { GlassWindow } from './GlassWindow';
import { useScene } from './SceneProvider';
import { Stage, boxStyle } from './Stage';
import { playToEnd, sleep } from './timing';

// Screen 05 (prototype-v3 "05 · new chapter"): the river, a "new chapter"
// folder, and a frosted glass window (GlassWindow) with five tabs. The tab bodies are the
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

// the window fades with --win-o (see GlassWindow), never opacity or filter
const ANIMATED = 'transform,--win-o,visibility,transformOrigin';

// the window, as % of the stage
const W5 = stageBox(weddingWindow);
const PLATE = plateBox(weddingWindow);

const TABS: { id: WeddingTab; label: string }[] = [
  { id: 'detail', label: 'DETAILS' },
  { id: 'timeline', label: 'TIMELINE' },
  { id: 'motif', label: 'MOTIF' },
  { id: 'entourage', label: 'ENTOURAGE' },
  { id: 'faq', label: 'FAQ' },
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
    gsap.set(cursor, { transformOrigin: '10% 5%' });
    const tl = gsap.timeline();
    tl.fromTo(
      cursor,
      { opacity: 0, xPercent: 480, yPercent: 300 },
      {
        keyframes: {
          '45%': { opacity: 1, xPercent: 160, yPercent: 80 },
          '100%': { opacity: 1, xPercent: 0, yPercent: 0 },
          easeEach: easings.cursor,
        },
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
    // inherit, not visible: a hidden scene must hide (and stop the clicks of) its window too
    gsap.set(w, { visibility: 'inherit', transformOrigin: folderOrigin() });
    const tl = gsap.timeline();
    tl.fromTo(
      w,
      { scale: 0.2, '--win-o': 0 },
      {
        keyframes: {
          '35%': { scale: 0.55, '--win-o': 0.75 },
          '100%': { scale: 1, '--win-o': 1 },
          // the ease between keyframes belongs inside the keyframes object
          easeEach: easings.grow,
        },
        duration: 0.8,
        clearProps: 'transform',
      },
    );
    await playToEnd(tl);
    folderRef.current?.classList.remove('is-selected');
  }

  async function closeWindow() {
    const w = windowRef.current;
    if (!w) return;
    gsap.set(w, { transformOrigin: folderOrigin() });
    const tl = gsap.timeline();
    tl.fromTo(w, { scale: 1, '--win-o': 1 }, { scale: 0.06, '--win-o': 0, duration: 0.52, ease: easings.shrink });
    await playToEnd(tl);
    gsap.set(w, { visibility: 'hidden', clearProps: 'transform,--win-o' });
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
          <span className="stage-folder__label">and now, our new chapter begins</span>
        </button>

        <GlassWindow
          ref={windowRef}
          spec={weddingWindow}
          label="The wedding"
          tabs={TABS.map((t) => ({ ...t, controls: `w5-panel-${t.id}` }))}
          selected={TABS.findIndex((t) => t.id === tab)}
          onSelect={(i) => setTab(TABS[i].id)}
          onClose={() => setWindowOpen(false)}
        >
          <div
            className="gw-pane"
            style={{
              left: `${PLATE.x}%`,
              top: `${PLATE.y}%`,
              width: `${PLATE.w}%`,
              height: `${PLATE.h}%`,
            }}
          >
            {panel('detail', <DetailTab active={open && tab === 'detail'} layout="split" />)}
            {panel('timeline', <TimelineTab />)}
            {panel('motif', <MotifTab />)}
            {panel('entourage', <EntourageTab />)}
            {panel('faq', <FaqTab />)}
          </div>
        </GlassWindow>

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
