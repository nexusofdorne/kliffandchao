'use client';

import gsap from 'gsap';
import { useEffect, useImperativeHandle, useRef, type Ref } from 'react';
import { sceneAssets as a } from '@/config/scene-layers.generated';
import { terminalCopy } from '@/content/terminal';
import { siteConfig } from '@/config/site';
import {
  loadTerminalSounds,
  startTerminalSound,
  stopTerminalSound,
  typingTick,
} from '@/lib/audio/typing';
import { finishPercent, rampPercent } from '@/lib/scene/terminal';
import { Stage, StageFill, boxStyle } from './Stage';
import { calmMotion, rand, sleep } from './timing';

// Screen 02 (prototype-v3 "02 · terminal"): the monitor's screen types its
// boot lines, fills a progress bar, which gives way to "LOGIN SUCCESSFUL" at 100%,
// then types a greeting and a running dinosaur; then the picture tears like a dying analog TV and is wiped, which
// is where the intro scene takes over (breakUp).

export type TerminalHandle = {
  /** Types the whole sequence. `ready` gates the last 10% of the bar. */
  run: (ready: Promise<unknown>, signal: AbortSignal) => Promise<void>;
  /** The glitch, then erasing the text. Resolves with the screen blank. */
  breakUp: (signal: AbortSignal) => Promise<void>;
  /** Back to a blank screen. */
  reset: () => void;
  /** The whole stage, for the camera-like settle in the hand-over. */
  stage: () => HTMLElement | null;
  /** The washed-out screen, which the hand-over fades in. */
  wash: () => HTMLElement | null;
};

// pixel dinosaur (two leg frames), drawn as one path per frame
const DINO = [
  '..........########..',
  '.........##.#######.',
  '.........##########.',
  '.........##########.',
  '.........##########.',
  '.........#####......',
  '.........########...',
  '#.......#####.......',
  '#......#######......',
  '##....##########....',
  '###..#########.#....',
  '##############......',
  '##############......',
  '.############.......',
  '..##########........',
  '...########.........',
];
const LEGS = [
  [
    '....###..##.........',
    '....##....#.........',
    '....#.....##........',
    '....##..............',
  ],
  [
    '....###..##.........',
    '....#....##.........',
    '....##....#.........',
    '..........##........',
  ],
];
const dinoPath = (rows: string[]) =>
  rows
    .map((row, y) => {
      let d = '';
      for (const run of row.matchAll(/#+/g)) {
        d += `M${run.index} ${y}h${run[0].length}v1h-${run[0].length}z`;
      }
      return d;
    })
    .join('');
const DINO_FRAMES = LEGS.map((legs) => dinoPath(DINO.concat(legs)));

function drawNoise(canvas: HTMLCanvasElement, streak: number) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  const img = ctx.createImageData(w, canvas.height);
  const d = img.data;
  let row = 0;
  for (let i = 0; i < d.length; i += 4) {
    if ((i / 4) % w === 0)
      row = Math.random() < 0.3 ? Math.random() * 255 : row * 0.6;
    const v = (Math.random() * 255 * (1 - streak) + row * streak) | 0;
    d[i] = d[i + 1] = d[i + 2] = v;
    d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

export function Terminal({ ref }: { ref?: Ref<TerminalHandle> }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const crtRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<HTMLDivElement>(null);
  const noiseRef = useRef<HTMLCanvasElement>(null);
  const washRef = useRef<HTMLDivElement>(null);
  const bootRef = useRef<HTMLDivElement>(null);
  const loginRef = useRef<HTMLHeadingElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLElement>(null);
  const pctRef = useRef<HTMLSpanElement>(null);
  const helloRef = useRef<HTMLDivElement>(null);
  const dinoRef = useRef<HTMLDivElement>(null);
  const dinoPathRef = useRef<SVGPathElement>(null);
  const dinoTimer = useRef(0);
  const caret = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const el = document.createElement('span');
    el.className = 'crt-caret';
    caret.current = el;
    return () => {
      el.remove();
      clearInterval(dinoTimer.current);
    };
  }, []);

  const lines = (box: HTMLElement | null) =>
    Array.from(box?.querySelectorAll('p') ?? []);

  function reset() {
    clearInterval(dinoTimer.current);
    caret.current?.remove();
    [...lines(bootRef.current), ...lines(helloRef.current)].forEach((p) => {
      p.textContent = '';
    });
    gsap.set([loginRef.current, progressRef.current, dinoRef.current], {
      clearProps: 'all',
    });
    gsap.set(washRef.current, { clearProps: 'all' });
    if (barRef.current) barRef.current.style.width = '0%';
    if (pctRef.current) pctRef.current.textContent = '0%';
    progressRef.current?.classList.remove('is-loading');
    termRef.current?.style.removeProperty('transform');
    termRef.current?.style.removeProperty('opacity');
    if (noiseRef.current) noiseRef.current.style.opacity = '0';
  }

  async function type(
    p: HTMLElement,
    text: string,
    speed: number,
    signal: AbortSignal,
  ) {
    const node = document.createTextNode('');
    p.textContent = '';
    p.append(node);
    if (caret.current) p.append(caret.current);
    startTerminalSound('keys');
    try {
      for (const ch of text) {
        node.data += ch;
        typingTick(ch);
        await sleep(speed * rand(0.55, 1.45) + (ch === ' ' ? 18 : 0), signal);
      }
    } finally {
      stopTerminalSound('keys');
    }
  }

  async function loadBar(ready: Promise<unknown>, signal: AbortSignal) {
    const set = (v: number) => {
      if (barRef.current) barRef.current.style.width = `${v}%`;
      if (pctRef.current) pctRef.current.textContent = `${v}%`;
    };
    const ramp = async (ms: number, at: (t: number) => number) => {
      const t0 = performance.now();
      for (;;) {
        const t = Math.min(1, (performance.now() - t0) / ms);
        set(at(t));
        if (t >= 1) return;
        await sleep(33, signal);
      }
    };
    await ramp(2800, rampPercent);
    // hold near the end until the intro video can play, but never forever
    await Promise.race([ready.catch(() => {}), sleep(4000, signal)]);
    await ramp(400, finishPercent);
  }

  function startDino() {
    let f = 0;
    clearInterval(dinoTimer.current);
    dinoTimer.current = window.setInterval(() => {
      f ^= 1;
      dinoPathRef.current?.setAttribute('d', DINO_FRAMES[f]);
      const svg = dinoPathRef.current?.ownerSVGElement;
      if (svg) svg.style.transform = `translateY(${f ? -2.5 : 0}%)`;
    }, 170);
  }

  const fade = (
    target: Element | null,
    frames: gsap.TweenVars[],
    duration: number,
    signal: AbortSignal,
  ) =>
    new Promise<void>((resolve, reject) => {
      if (!target) return resolve();
      const tl = gsap.timeline();
      frames.forEach((vars, i) =>
        tl.to(
          target,
          { ...vars, duration: duration / frames.length, ease: 'none' },
          i ? '>' : 0,
        ),
      );
      const timer = setTimeout(() => tl.progress(1), duration + 300);
      tl.eventCallback('onComplete', () => {
        clearTimeout(timer);
        resolve();
      });
      signal.addEventListener('abort', () => {
        clearTimeout(timer);
        tl.kill();
        reject(new DOMException('aborted', 'AbortError'));
      });
    });

  async function run(ready: Promise<unknown>, signal: AbortSignal) {
    reset();
    void loadTerminalSounds(siteConfig.terminalSounds);
    await sleep(700, signal);
    const boot = lines(bootRef.current);
    for (const [i, p] of boot.entries()) {
      await type(p, terminalCopy.boot[i], 36, signal);
      await sleep(240, signal);
    }
    await sleep(380, signal);
    await fade(progressRef.current, [{ opacity: 1 }], 220, signal);
    progressRef.current?.classList.add('is-loading');
    startTerminalSound('progress');
    try {
      await loadBar(ready, signal);
    } finally {
      stopTerminalSound('progress');
      progressRef.current?.classList.remove('is-loading');
    }
    await sleep(350, signal);
    // the bar gives way to the login line in the same place
    await fade(progressRef.current, [{ opacity: 0 }], 220, signal);
    await fade(
      loginRef.current,
      [{ opacity: 1 }, { opacity: 0.15 }, { opacity: 1 }],
      420,
      signal,
    );
    await sleep(450, signal);
    const hello = lines(helloRef.current);
    for (const [i, p] of hello.entries()) {
      await type(p, terminalCopy.hello[i], 30, signal);
      await sleep(200, signal);
    }
    await sleep(350, signal);
    startDino();
    gsap.fromTo(
      dinoRef.current,
      { opacity: 0, yPercent: 12 },
      { opacity: 1, yPercent: 0, duration: 0.48, ease: 'steps(6)' },
    );
    await sleep(2800, signal);
  }

  // analog-TV breakup: torn bands, rgb split, vertical-hold slips and snow
  async function glitch(
    dur: number,
    k0: number,
    k1: number,
    signal: AbortSignal,
  ) {
    const crt = crtRef.current;
    const term = termRef.current;
    const cv = noiseRef.current;
    if (!crt || !term || !cv) return;
    crt.classList.add('is-glitching');
    const tears = [0, 1, 2].map(() => {
      const t = term.cloneNode(true) as HTMLElement;
      t.className = 'crt-term crt-tear';
      t.setAttribute('aria-hidden', 'true');
      crt.insertBefore(t, cv);
      return t;
    });
    const t0 = performance.now();
    const frame = () => {
      const p = Math.min(1, (performance.now() - t0) / dur);
      const k = k0 + (k1 - k0) * p;
      drawNoise(cv, 0.75 - 0.5 * p);
      cv.style.opacity = (
        0.08 +
        Math.random() * 0.3 * k +
        (Math.random() < 0.07 ? 0.4 : 0)
      ).toFixed(2);
      const slip = Math.random() < 0.12 * k ? rand(-7, 7) : 0;
      term.style.transform = `translate(${rand(-0.5, 0.5) * k}cqw, ${slip}cqh) skewX(${rand(-3, 3) * k}deg)`;
      term.style.opacity = Math.random() < 0.06 ? '0.25' : '1';
      tears.forEach((t) => {
        const top = rand(0, 92);
        const h = rand(2, 11) * k;
        t.style.clipPath = `inset(${top}% 0 ${Math.max(0, 100 - top - h)}% 0)`;
        t.style.transform = `translateX(${rand(-4, 4) * k}cqw)`;
        t.style.opacity = Math.random() < 0.75 ? '1' : '0';
      });
      crt.style.filter =
        Math.random() < 0.1 * k
          ? `brightness(${rand(1.4, 2.2)}) contrast(1.4)`
          : '';
    };
    gsap.ticker.add(frame);
    const cleanup = () => {
      gsap.ticker.remove(frame);
      tears.forEach((t) => t.remove());
      term.style.transform = '';
      term.style.opacity = '';
      crt.style.filter = '';
      crt.classList.remove('is-glitching');
    };
    try {
      // a timer ends it too: a background tab freezes the ticker
      await sleep(dur, signal);
    } finally {
      cleanup();
    }
  }

  async function erase(signal: AbortSignal) {
    caret.current?.remove();
    clearInterval(dinoTimer.current);
    const nodes = [...lines(bootRef.current), ...lines(helloRef.current)]
      .map((p) => p.firstChild as Text | null)
      .filter((n): n is Text => !!n);
    [loginRef.current, progressRef.current, dinoRef.current].forEach((el) =>
      gsap.to(el, {
        keyframes: [{ opacity: 0 }, { opacity: 0.7 }, { opacity: 0 }],
        duration: 0.42,
        ease: 'none',
      }),
    );
    while (nodes.some((n) => n.data.length)) {
      nodes.forEach((n) => {
        n.data = n.data.slice(0, -2);
      });
      await sleep(16, signal);
    }
  }

  async function breakUp(signal: AbortSignal) {
    // the calm version skips the screen tearing apart
    if (calmMotion()) {
      await sleep(300, signal);
      return;
    }
    gsap.to(washRef.current, {
      keyframes: [
        { opacity: 0.85, backgroundColor: 'rgb(28,52,34)', duration: 0.45 },
        { opacity: 0.9, backgroundColor: 'rgb(92,122,120)', duration: 0.65 },
        { opacity: 0.92, backgroundColor: 'rgb(118,146,158)', duration: 0.2 },
      ],
      delay: 0.18,
      ease: 'power1.in',
    });
    startTerminalSound('glitch');
    try {
      await glitch(1450, 0.15, 0.85, signal);
    } finally {
      stopTerminalSound('glitch');
    }
    await erase(signal);
    if (noiseRef.current) {
      gsap.to(noiseRef.current, { opacity: 0, duration: 0.3 });
    }
    await sleep(300, signal);
  }

  useImperativeHandle(ref, () => ({
    run,
    breakUp,
    reset,
    stage: () => stageRef.current,
    wash: () => washRef.current,
  }));

  return (
    <Stage>
      <div ref={stageRef} className="absolute inset-0">
        <StageFill asset={a.s02_bg} priority />
        <div ref={crtRef} className="crt" style={boxStyle(a.s02_screen)}>
          <div ref={washRef} className="crt-wash" />
          <div ref={termRef} className="crt-term" aria-hidden="true">
            <div ref={bootRef} className="crt-boot">
              {terminalCopy.boot.map((line) => (
                <p key={line} />
              ))}
            </div>
            <div ref={progressRef} className="crt-progress">
              <div className="crt-bar">
                <i ref={barRef} />
              </div>
              <span ref={pctRef} className="crt-pct">
                0%
              </span>
              <svg className="crt-hourglass" viewBox="0 0 9 12">
                <path d="M0 0h9v1.5H0zM0 10.5h9V12H0zM1 1.5h7v1l-2.5 3 2.5 3v2H1v-2l2.5-3L1 2.5z" />
              </svg>
            </div>
            <h1 ref={loginRef} className="crt-login">
              {terminalCopy.login}
            </h1>
            <div ref={helloRef} className="crt-hello">
              {terminalCopy.hello.map((line) => (
                <p key={line} />
              ))}
            </div>
            <div ref={dinoRef} className="crt-dino">
              <svg viewBox="0 0 20 20">
                <path ref={dinoPathRef} d={DINO_FRAMES[0]} />
              </svg>
              <i className="crt-ground" />
            </div>
          </div>
          <canvas
            ref={noiseRef}
            className="crt-noise"
            width={192}
            height={108}
          />
          <div className="crt-roll" />
          <div className="crt-scan" />
        </div>
      </div>
    </Stage>
  );
}
