'use client';

import type { CSSProperties, ReactNode } from 'react';
import { sceneAssets as a } from '@/config/scene-layers.generated';
import { JOURNEY_TABS, type SceneId } from '@/lib/scene/machine';
import { SceneProvider, useScene } from './SceneProvider';
import { Stage, StageFill, StageLayer, boxStyle } from './Stage';

// Scaffold for the redesigned desktop story (docs/REDESIGN_PLAN.md step 2):
// the real Stage, assets, state machine and input, with placeholder scenes.
// Reachable at /story?scenes=1 while the real scenes (steps 3-6) are built;
// each one replaces its placeholder here.

const HIDDEN: CSSProperties = { visibility: 'hidden', opacity: 0 };

function SceneRoot({
  id,
  visible = false,
  children,
}: {
  id: SceneId;
  visible?: boolean;
  children: ReactNode;
}) {
  const { registerScene } = useScene();
  return (
    <section
      ref={(el) => registerScene(id, el)}
      data-scene={id}
      aria-label={id}
      className="scene-root"
      style={visible ? undefined : HIDDEN}
    >
      {children}
    </section>
  );
}

// tab labels and where they sit in the 1920px mockup (see prepare_assets.py)
const TABS = [
  { label: 'It started with a wedding', x0: 325, x1: 515 },
  { label: "It shouldn't have happened", x0: 520, x1: 725 },
  { label: 'But it did', x0: 730, x1: 935 },
  { label: 'Meet family & friends', x0: 940, x1: 1145 },
  { label: "We're engaged!", x0: 1150, x1: 1345 },
];
const px = (v: number) => `${(100 * v) / 1920}%`;

const frames = [a.frame0, a.frame1, a.frame2, a.frame3, a.frame4, a.frame5];

function JourneyScaffold() {
  const { state, setWindowOpen, goToTab } = useScene();
  const frame = frames[state.journeyOpen ? state.journeyTab : 0];
  const frameBox = a.frame0;
  return (
    <Stage>
      <StageFill asset={a.j00_bg} />
      {!state.journeyOpen && (
        <button
          type="button"
          aria-label="Open the journey folder"
          onClick={() => setWindowOpen(true)}
          className="absolute cursor-pointer"
          style={boxStyle(a.j00_folder)}
        >
          <StageLayer
            asset={a.j00_folder}
            style={{ left: 0, top: 0, width: '100%', height: '100%' }}
          />
        </button>
      )}
      {state.journeyOpen && (
        <>
          <StageLayer asset={frame} />
          <button
            type="button"
            aria-label="Close window"
            onClick={() => setWindowOpen(false)}
            className="absolute cursor-pointer rounded-full"
            style={{
              left: px(216),
              top: `${(100 * 292) / 1080}%`,
              width: px(24),
              height: `${(100 * 24) / 1080}%`,
            }}
          />
          {TABS.map((tab, i) => (
            <button
              key={tab.label}
              type="button"
              aria-current={state.journeyTab === i + 1 ? 'true' : undefined}
              onClick={() => goToTab(i + 1)}
              className="absolute cursor-pointer text-left text-[0.62cqw] font-semibold uppercase leading-tight tracking-wide text-black/80"
              style={{
                left: px(tab.x0 + 40),
                top: `${(100 * 280) / 1080}%`,
                width: px(tab.x1 - tab.x0 - 50),
                height: `${(100 * 40) / 1080}%`,
              }}
            >
              {tab.label}
            </button>
          ))}
          <p
            className="absolute m-0 text-[1.1cqw] text-black/70"
            style={{
              left: `${frameBox.x + 4}%`,
              top: `${frameBox.y + 20}%`,
            }}
          >
            Chapter {state.journeyTab} of {JOURNEY_TABS}: placeholder
          </p>
        </>
      )}
    </Stage>
  );
}

function WeddingScaffold() {
  const { state, setWindowOpen } = useScene();
  return (
    <Stage>
      <StageFill asset={a.j05_bg} />
      {!state.weddingOpen ? (
        <button
          type="button"
          aria-label="Open the new chapter folder"
          onClick={() => setWindowOpen(true)}
          className="absolute cursor-pointer"
          style={boxStyle(a.j05_folder)}
        >
          <StageLayer
            asset={a.j05_folder}
            style={{ left: 0, top: 0, width: '100%', height: '100%' }}
          />
        </button>
      ) : (
        <div
          className="absolute grid place-items-center rounded-[2cqw] border border-white/60 bg-white/40 text-[1.2cqw] text-black/70 backdrop-blur-xl"
          style={{ left: '15%', top: '24.4%', width: '68.8%', height: '55.6%' }}
        >
          <button
            type="button"
            onClick={() => setWindowOpen(false)}
            className="cursor-pointer underline"
          >
            Wedding window (placeholder), close
          </button>
        </div>
      )}
    </Stage>
  );
}

function Scenes() {
  return (
    <>
      <SceneRoot id="intro" visible>
        <Stage>
          <StageFill asset={a.s02_bg} priority />
          <p className="absolute left-1/2 top-1/2 m-0 -translate-x-1/2 -translate-y-1/2 text-[1.6cqw] text-white/80">
            Intro (placeholder). Scroll, swipe, press an arrow key or use the nav.
          </p>
        </Stage>
      </SceneRoot>
      <SceneRoot id="journey">
        <JourneyScaffold />
      </SceneRoot>
      <SceneRoot id="wedding">
        <WeddingScaffold />
      </SceneRoot>
    </>
  );
}

export function ScenePlayground() {
  return (
    <SceneProvider>
      <Scenes />
    </SceneProvider>
  );
}
