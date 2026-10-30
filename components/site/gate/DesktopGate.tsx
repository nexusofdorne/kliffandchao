'use client';

import gsap from 'gsap';
import Image from 'next/image';
import { useEffect, useRef, type CSSProperties } from 'react';
import {
  Stage,
  StageFill,
  StageLayer,
  boxStyle,
} from '@/components/site/scene/Stage';
import { calmMotion, playToEnd } from '@/components/site/scene/timing';
import { Monogram, Wordmark } from '@/components/site/chrome/Wordmark';
import { sceneAssets as a } from '@/config/scene-layers.generated';
import { frameTransform, ridingFrame, zoomFrame } from '@/lib/scene/camera';
import type { GateFormProps } from './MobileGate';

const DIVE_SECONDS = 3.2;
/** The monitor's screen in the 3.0 photo, as % of its box (scripts/design/prepare_assets.py): a
 *  tilted quad with softened corners. The screen's layers (the photo, its glitch, the dark the
 *  dive goes through) are clipped to it, so they never spill onto the bezel. */
const SCREEN_OUTLINE =
  'polygon(7.2% 9%, 10.3% 6%, 97.4% 0%, 100% 1.5%, 96.1% 90.2%, 93.1% 93.2%, 2.6% 99.7%, 0% 97.2%)';
/** How far (% of the stage) the sky and the bubbles drift against the hill as the pointer moves. */
const PARALLAX = { sky: 0.6, bubbles: 1.4 };
const REDUCED_FADE_SECONDS = 0.4;

const centre = (box: { x: number; y: number; w: number; h: number }) => ({
  x: box.x + box.w / 2,
  y: box.y + box.h / 2,
});

const bubbles = [a.s01_bubble0, a.s01_bubble1, a.s01_bubble2, a.s01_bubble3];
const fgUrl: CSSProperties = { backgroundImage: `url(${a.s01_fg.src})` };

// Screen 01 (prototype-v3, "01 · password"): the hill with the monitor, grass
// and bubbles swaying, clouds drifting, the screen glitching. The password
// pill is the real field. On a correct password GateScreen sets `diving`, and
// the camera dives into the monitor: the meadow falls out of focus, the screen
// goes dark and the empty terminal screen grows to fill the stage. The dive
// ends on that black screen and calls `onDived`, where GateScreen navigates.
export function DesktopGate({
  password,
  onPasswordChange,
  error,
  onEnter,
  diving,
  onDived,
}: GateFormProps & { diving: boolean; onDived: () => void }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const darkRef = useRef<HTMLDivElement>(null);
  const rideRef = useRef<HTMLDivElement>(null);
  const rideStageRef = useRef<HTMLDivElement>(null);
  const rideFillRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const skyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const bubblesRef = useRef<HTMLDivElement>(null);
  const onDivedRef = useRef(onDived);

  // parallax: the sky and the bubbles drift against the hill with the pointer, the nearer
  // bubbles more, so the scene has depth before the camera ever moves
  useEffect(() => {
    if (calmMotion()) return;
    const sky = skyRef.current;
    const floaters = bubblesRef.current;
    if (!sky || !floaters) return;
    const toSky = {
      x: gsap.quickTo(sky, 'xPercent', { duration: 1.4, ease: 'power3' }),
      y: gsap.quickTo(sky, 'yPercent', { duration: 1.4, ease: 'power3' }),
    };
    const toBubbles = {
      x: gsap.quickTo(floaters, 'xPercent', { duration: 1.1, ease: 'power3' }),
      y: gsap.quickTo(floaters, 'yPercent', { duration: 1.1, ease: 'power3' }),
    };
    const move = (event: PointerEvent) => {
      const nx = event.clientX / window.innerWidth - 0.5;
      const ny = event.clientY / window.innerHeight - 0.5;
      toSky.x(-nx * PARALLAX.sky);
      toSky.y(-ny * PARALLAX.sky * 0.5);
      toBubbles.x(-nx * PARALLAX.bubbles);
      toBubbles.y(-ny * PARALLAX.bubbles * 0.6);
    };
    window.addEventListener('pointermove', move);
    return () => window.removeEventListener('pointermove', move);
  }, []);

  useEffect(() => {
    onDivedRef.current = onDived;
  }, [onDived]);

  useEffect(() => {
    if (!diving) return;
    const stage = stageRef.current;
    const world = worldRef.current;
    const dark = darkRef.current;
    const ride = rideRef.current;
    const rideStage = rideStageRef.current;
    const rideFill = rideFillRef.current;
    const form = formRef.current;
    if (
      !stage ||
      !world ||
      !dark ||
      !ride ||
      !rideStage ||
      !rideFill ||
      !form
    ) {
      return;
    }

    const timeline = gsap.timeline();
    if (calmMotion()) {
      // no camera move: the scene just goes to the terminal's black screen
      timeline
        .set(ride, { opacity: 1 }, 0)
        .set(rideFill, { opacity: 0 }, 0)
        .to(rideFill, { opacity: 1, duration: REDUCED_FADE_SECONDS }, 0)
        .to(form, { opacity: 0, duration: REDUCED_FADE_SECONDS / 2 }, 0);
    } else {
      const from = centre(a.s01_screen);
      const to = centre(a.s02_screen);
      const ratio = a.s01_screen.w / a.s02_screen.w;
      const D = DIVE_SECONDS;
      const proxy = { t: 0 };
      const frame = () => {
        const outer = zoomFrame(proxy.t, from, to, 1 / ratio);
        const inner = ridingFrame(proxy.t, from, to, ratio);
        stage.style.transform = frameTransform(outer);
        world.style.filter =
          outer.blur > 0.01 ? `blur(${outer.blur}px)` : 'none';
        rideStage.style.transform = frameTransform(inner);
      };
      frame();
      timeline
        .to(form, { opacity: 0, duration: 0.3, ease: 'none' }, 0)
        .to(proxy, { t: 1, duration: D, ease: 'none', onUpdate: frame }, 0)
        // the monitor's screen goes dark, then the terminal rides in on it
        .fromTo(
          dark,
          { opacity: 0 },
          { opacity: 1, duration: D * 0.14, ease: 'none' },
          D * 0.22,
        )
        .fromTo(
          ride,
          { opacity: 0 },
          { opacity: 1, duration: D * 0.06, ease: 'none' },
          D * 0.34,
        )
        // the bezel image takes over once the camera is nearly there
        .fromTo(
          rideFill,
          { opacity: 0 },
          { opacity: 1, duration: D * 0.22, ease: 'none' },
          D * 0.78,
        );
    }

    let cancelled = false;
    void playToEnd(timeline).then(() => {
      if (!cancelled) onDivedRef.current();
    });
    return () => {
      cancelled = true;
      timeline.kill();
    };
  }, [diving]);

  return (
    <div className="scene-root">
      {/* tall screens: the sky above the stage and the hill's grass below it */}
      <div
        aria-hidden
        className="scene-ambient"
        style={
          { '--amb-top': '#83a6b3', '--amb-bottom': '#5e5d29' } as CSSProperties
        }
      />
      <Stage>
        {/* the stage itself is what the camera moves; transform-origin 0 0 */}
        <div
          ref={stageRef}
          className="absolute inset-0"
          style={{ transformOrigin: '0 0' }}
        >
          {/* everything but the monitor: this is what goes out of focus */}
          <div
            ref={worldRef}
            className="absolute inset-0"
            // sky colours, so the first paint isn't black while the big sky image decodes
            style={{
              background: 'linear-gradient(to bottom, #79aed2, #d3e6ee 60%)',
            }}
          >
            <div
              ref={skyRef}
              className="absolute inset-0 will-change-transform"
            >
              <StageLayer asset={a.s01_sky} className="amb-cloud" />
            </div>
            <StageLayer asset={a.s01_fg} />
            <div className="gate-sway gate-sway--far" style={fgUrl} />
            <div className="gate-sway gate-sway--near-l" style={fgUrl} />
            <div className="gate-sway gate-sway--near-r" style={fgUrl} />
            <div
              ref={bubblesRef}
              className="absolute inset-0 will-change-transform"
            >
              {bubbles.map((bubble) => (
                <StageLayer
                  key={bubble.src}
                  asset={bubble}
                  className="amb-bob"
                />
              ))}
            </div>
          </div>
          <StageLayer asset={a.s01_monitor} />

          <div
            className="gate-monitor"
            style={{ ...boxStyle(a.s01_screen), clipPath: SCREEN_OUTLINE }}
          >
            <Image
              src={a.s01_screen.src}
              alt=""
              width={a.s01_screen.px[0]}
              height={a.s01_screen.px[1]}
              unoptimized
              draggable={false}
            />
            <div
              className="gate-monitor__ghost gate-monitor__ghost--r"
              style={{ backgroundImage: `url(${a.s01_screen.src})` }}
            />
            <div
              className="gate-monitor__ghost gate-monitor__ghost--b"
              style={{ backgroundImage: `url(${a.s01_screen.src})` }}
            />
            <div className="gate-monitor__scan" />
            <div ref={darkRef} className="gate-monitor__dark" />
          </div>

          <div ref={formRef} className="absolute inset-0">
            {/* a soft shade behind the text, so it reads over bright cloud and grass */}
            <div
              aria-hidden="true"
              className="gate-scrim pointer-events-none absolute"
            />
            <h1
              className="absolute m-0 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap font-medium leading-none text-white [text-shadow:0_0.06cqw_0.2cqw_rgba(0,0,0,.4),0_0.15cqw_1.4cqw_rgba(0,0,0,.4)]"
              style={{
                left: `${a.s01_heading.cx}%`,
                top: `${a.s01_heading.cy}%`,
                fontSize: `${a.s01_heading.size}cqw`,
              }}
            >
              You are <em className="font-normal">invited</em>!
            </h1>
            <p
              className="absolute m-0 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap tracking-[.14em] font-normal text-white [text-shadow:0_0_0.3cqw_rgba(0,0,0,.6),0_0.1cqw_0.9cqw_rgba(0,0,0,.55)]"
              style={{
                left: `${a.s01_subtitle.cx}%`,
                top: `${a.s01_subtitle.cy}%`,
                fontSize: `${a.s01_subtitle.size}cqw`,
              }}
            >
              Please enter the password from your invitation
            </p>

            {/* Deliberately not a <form>: a submit reloads the document and
                destroys the <audio> element along with the ENTER gesture it
                needs — docs/PLAN.md "Background music". */}
            <div
              className={`gate-pill ${error ? 'is-wrong' : ''}`}
              style={boxStyle(a.s01_input)}
            >
              <input
                ref={inputRef}
                type="password"
                value={password}
                onChange={(event) => onPasswordChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') onEnter();
                }}
                onClick={() => {
                  if (password.trim()) onEnter();
                }}
                placeholder="ENTER"
                aria-label="Password from your invitation"
                aria-invalid={error}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoComplete="current-password"
              />
              {/* always there, as in the 3.0 design; with nothing typed it just focuses the field */}
              <button
                type="button"
                className="gate-go"
                aria-label="Enter"
                onClick={() =>
                  password.trim() ? onEnter() : inputRef.current?.focus()
                }
              >
                <svg
                  viewBox="0 0 24 24"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  stroke="currentColor"
                  fill="none"
                  strokeWidth={2.1}
                  aria-hidden="true"
                >
                  <path d="M10 6.5 15.5 12 10 17.5" />
                </svg>
              </button>
            </div>
            <p
              role="alert"
              className="absolute m-0 -translate-x-1/2 whitespace-nowrap tracking-[.14em] text-[#ffc2b6] [text-shadow:0_0.1cqw_0.8cqw_rgba(0,0,0,.5)]"
              style={{
                left: `${a.s01_input.x + a.s01_input.w / 2}%`,
                top: `${a.s01_input.y + a.s01_input.h + 1.6}%`,
                fontSize: '0.7cqw',
              }}
            >
              {error ? "That's not quite it. Try again." : null}
            </p>
          </div>
        </div>

        {/* the terminal's screen, which rides inside the monitor and grows to fill the stage */}
        <div
          ref={rideRef}
          className="pointer-events-none absolute inset-0 opacity-0"
        >
          <div
            ref={rideStageRef}
            className="absolute inset-0"
            style={{ transformOrigin: '0 0' }}
          >
            <div ref={rideFillRef} className="absolute inset-0 opacity-0">
              <StageFill asset={a.s02_bg} />
            </div>
          </div>
        </div>
      </Stage>
      {/* The couple's marks (3.0): the wordmark over the hill, the monogram in the corner. Placed
          from the window's edges, not on the 16:9 picture: a window wider than 16:9 crops the
          picture's top and bottom, which pushed them against the edge. They leave with the form
          when the camera dives into the monitor. */}
      <div
        className="pointer-events-none absolute inset-0 z-[2] transition-opacity duration-300"
        style={{ opacity: diving ? 0 : 1 }}
      >
        <Wordmark
          decorative={false}
          className="absolute left-1/2 top-[max(6.5vh,44px)] w-[clamp(110px,7.6vw,180px)] -translate-x-1/2 text-white drop-shadow-[0_2px_10px_rgba(0,0,0,.18)]"
        />
        <Monogram className="absolute bottom-[max(4.5vh,30px)] right-[max(3.2vw,28px)] w-[clamp(84px,6.2vw,150px)] text-white drop-shadow-[0_2px_10px_rgba(0,0,0,.25)]" />
      </div>
    </div>
  );
}
