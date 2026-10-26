/* Kliff & Chao — clickable prototype. Plain JS, no frameworks.
 *
 * Scenes follow transitions.txt:
 *   01 password  →(Enter: zoom into the monitor)→  02 terminal
 *   02 terminal  →(glitch, erase, border surfaces)→ 03 intro video
 *   03 intro     →(scroll / JOURNEY: dive into the monitor, folder opens)→ 04 journey
 *   04 journey   →(scroll past the last tab: cinematic scroll)→ 05 new chapter
 *
 * Dev shortcut: index.html?scene=2 … ?scene=5 jumps straight to a scene.
 */
(() => {
  'use strict';

  const M = window.MANIFEST;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const rand = (a, b) => a + Math.random() * (b - a);

  // ---------------------------------------------------------------- layout
  $$('[data-asset]').forEach(el => {
    const a = M[el.dataset.asset];
    if (!a) return;
    if (a.x !== undefined) {
      Object.assign(el.style, { left: a.x + '%', top: a.y + '%', width: a.w + '%', height: a.h + '%' });
    }
    if (el.tagName === 'IMG' && a.src) el.src = a.src;
  });
  $$('[data-src]').forEach(el => { el.src = M[el.dataset.src].src; });
  const cursor5 = $('#s05 .cursor');
  cursor5.style.left = M.j05_cursor.x + '%';
  cursor5.style.top = M.j05_cursor.y + '%';

  // real footage slots: shown only if the file exists
  $$('video[data-optional-src]').forEach(v => {
    v.addEventListener('loadeddata', () => v.classList.add('is-ready'), { once: true });
    v.addEventListener('error', () => v.remove(), { once: true });
    v.src = v.dataset.optionalSrc;
  });

  // ---------------------------------------------------------------- animation helpers
  // Every animation commits its end state as inline style, so scenes stay put after a transition.
  function play(el, frames, opts = {}) {
    const a = el.animate(frames, { duration: 600, easing: 'ease', fill: 'both', ...opts });
    return a.finished.then(() => {
      try { a.commitStyles(); } catch (e) { /* element not rendered */ }
      a.cancel();
    }, () => {});
  }
  const ANIMATED = ['transform', 'opacity', 'filter'];
  function resetStyles(...els) {
    els.flat().forEach(el => ANIMATED.forEach(p => el.style.removeProperty(p)));
  }
  const subtree = root => [root, ...$$('*', root)];

  // ---------------------------------------------------------------- scenes
  const scenes = { 1: $('#s01'), 2: $('#s02'), 3: $('#s03'), 4: $('#s04'), 5: $('#s05') };
  const stageOf = n => $('.stage', scenes[n]);
  const show = n => scenes[n].classList.add('is-active');
  const hide = n => scenes[n].classList.remove('is-active');
  let current = 1;
  let busy = false;

  // ---------------------------------------------------------------- music
  const Music = (() => {
    let ctx, master, el, mode = null, muted = false;

    function unlock() {
      try {
        ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
        if (ctx.state === 'suspended') ctx.resume();
      } catch (e) { /* no web audio */ }
    }

    function start() {
      if (mode) return;
      mode = 'pending';
      el = new Audio('assets/music.mp3');
      el.loop = true;
      el.volume = 0.55;
      el.muted = muted;
      el.play().then(() => { mode = 'file'; }, err => {
        if (err && err.name === 'NotAllowedError') { mode = 'file-blocked'; return; }
        el = null;
        synth();
      });
    }

    // placeholder soundtrack (used until assets/music.mp3 is added): a soft music-box loop
    function synth() {
      unlock();
      if (!ctx) return;
      mode = 'synth';
      master = ctx.createGain();
      master.gain.value = 0;
      master.gain.setTargetAtTime(muted ? 0 : 0.9, ctx.currentTime, 1.2);
      const bus = ctx.createGain();
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 2400;
      const delay = ctx.createDelay();
      delay.delayTime.value = 0.42;
      const fb = ctx.createGain();
      fb.gain.value = 0.36;
      const wet = ctx.createGain();
      wet.gain.value = 0.32;
      bus.connect(lp).connect(master).connect(ctx.destination);
      lp.connect(delay).connect(fb).connect(delay);
      delay.connect(wet).connect(master);

      const chords = [[60, 64, 67, 71], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 67]];
      const arp = [0, 2, 1, 3, 2, 1, 3, 2];
      const eighth = 60 / 70 / 2;
      let next = ctx.currentTime + 0.15;
      let step = 0;
      const note = (midi, t, dur, vol, type) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = type;
        o.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(vol, t + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g).connect(bus);
        o.start(t);
        o.stop(t + dur + 0.05);
      };
      setInterval(() => {
        while (next < ctx.currentTime + 0.7) {
          const bar = Math.floor(step / 8) % chords.length;
          const chord = chords[bar];
          const m = chord[arp[step % 8]] + 12;
          note(m, next, 1.8, 0.06, 'sine');
          note(m + 12, next, 0.9, 0.012, 'triangle');
          if (step % 8 === 0) note(chord[0] - 12, next, 3.4, 0.05, 'sine');
          next += eighth;
          step++;
        }
      }, 120);
    }

    function resume() {
      unlock();
      if (mode === 'file-blocked' && el) el.play().then(() => { mode = 'file'; }, () => {});
    }

    function setMuted(m) {
      muted = m;
      if (el) el.muted = m;
      if (master && ctx) {
        master.gain.cancelScheduledValues(ctx.currentTime);
        master.gain.setTargetAtTime(m ? 0 : 0.9, ctx.currentTime, 0.12);
      }
    }

    return { unlock, start, resume, setMuted };
  })();
  addEventListener('pointerdown', () => { if (current >= 3) Music.resume(); });

  // ================================================================ 01 · password
  const pw = $('#pw');
  $('#pwForm').addEventListener('submit', e => {
    e.preventDefault();
    if (busy || current !== 1) return;
    if (!pw.value.trim()) {
      pw.classList.remove('is-wrong');
      void pw.offsetWidth;
      pw.classList.add('is-wrong');
      return;
    }
    Music.unlock();  // the Enter key press lets the soundtrack autoplay later
    go12();
  });
  // the pill doubles as the ENTER button once something is typed
  pw.addEventListener('click', () => { if (pw.value.trim()) $('#pwForm').requestSubmit(); });

  // one continuous camera move into the monitor: the meadow falls out of focus, the screen goes dark
  // and the terminal starts typing on it while we are still flying in
  async function go12() {
    busy = true;
    const st1 = stageOf(1);
    const st2 = stageOf(2);
    const scr = M.s01_screen;
    const to = M.s02_screen;
    const O = [scr.x + scr.w / 2, scr.y + scr.h / 2];   // monitor screen centre in 01
    const C = [to.x + to.w / 2, to.y + to.h / 2];       // terminal screen centre in 02
    const A = scr.w / to.w;                             // 02 drawn inside the small monitor
    const S = 1 / A;
    st1.style.transformOrigin = st2.style.transformOrigin = '0 0';

    // geometric steps so the dolly feels constant-speed, eased in and out;
    // 02 rides along inside the monitor's screen, so both scenes move as one camera
    const f1 = [];
    const f2 = [];
    const dof = [];
    for (let i = 0; i <= 30; i++) {
      const t = i / 30;
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      const s = Math.pow(S, e);
      const k = (s - 1) / (S - 1);
      const T1 = O.map((o, j) => o * (1 - s) + k * (C[j] - o));
      const T2 = O.map((o, j) => o * (1 - s) + (o - C[j] * A) * s + k * (C[j] - o));
      f1.push({ offset: t, transform: `translate(${T1[0]}%, ${T1[1]}%) scale(${s})` });
      f2.push({ offset: t, transform: `translate(${T2[0]}%, ${T2[1]}%) scale(${A * s})` });
      const blurPx = 16 * Math.min(1, Math.max(0, (e - 0.1) / 0.45));  // on screen; the layer is scaled by s
      dof.push({ offset: t, filter: `blur(${(blurPx / s).toFixed(3)}px)` });
    }
    const D = 3200;
    const lin = { duration: D, easing: 'linear' };
    pw.blur();
    play(pw, [{ opacity: 1 }, { opacity: 0 }], { duration: 300 });
    play($('.s01-bg', st1), dof, lin);
    play($('.monitor__dark', st1), [{ opacity: 0 }, { opacity: 0, offset: 0.22 }, { opacity: 1, offset: 0.36 }, { opacity: 1 }], lin);

    reset02();
    scenes[2].style.background = 'transparent';
    show(2);
    const zoom = play(st1, f1, lin);
    play(st2, f2, lin);
    play(scenes[2], [{ opacity: 0 }, { opacity: 0, offset: 0.34 }, { opacity: 1, offset: 0.4 }, { opacity: 1 }], lin);
    play($('.full', st2), [{ opacity: 0 }, { opacity: 0, offset: 0.78 }, { opacity: 1 }], lin);
    setTimeout(() => { current = 2; run02(150); }, D * 0.38);

    await zoom;
    scenes[2].style.background = '';
    resetStyles(st2);
    st2.style.transformOrigin = '';
    hide(1);
  }

  // ================================================================ 02 · terminal
  const caret = document.createElement('span');
  caret.className = 'caret';

  async function type(p, speed) {
    const text = p.dataset.text;
    const tn = document.createTextNode('');
    p.textContent = '';
    p.append(tn, caret);
    for (const ch of text) {
      tn.data += ch;
      await wait(speed * rand(0.55, 1.45) + (ch === ' ' ? 18 : 0));
    }
  }

  function loadBar(ms) {
    const fill = $('#s02 .t-bar i');
    const pct = $('#s02 .t-pct');
    const t0 = performance.now();
    return new Promise(res => {
      (function frame(now) {
        const t = Math.min(1, (now - t0) / ms);
        // monotonic with a few stalls, like a real loader
        const v = Math.round((t - Math.sin(t * Math.PI * 6) / (Math.PI * 6)) * 100);
        fill.style.width = v + '%';
        pct.textContent = v + '%';
        t < 1 ? requestAnimationFrame(frame) : res();
      })(t0);
    });
  }

  // pixel dinosaur (two leg frames)
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
    ['....###..##.........', '....##....#.........', '....#.....##........', '....##..............'],
    ['....###..##.........', '....#....##.........', '....##....#.........', '..........##........'],
  ];
  const dinoPath = rows => rows.map((row, y) => {
    let d = '';
    row.replace(/#+/g, (run, x) => { d += `M${x} ${y}h${run.length}v1h-${run.length}z`; return run; });
    return d;
  }).join('');
  const dinoFrames = LEGS.map(legs => dinoPath(DINO.concat(legs)));
  const dinoSvg = $('#s02 .dino');
  dinoSvg.innerHTML = `<path d="${dinoFrames[0]}"/>`;
  let dinoTimer = 0;
  function startDino() {
    let f = 0;
    const path = $('path', dinoSvg);
    clearInterval(dinoTimer);
    dinoTimer = setInterval(() => {
      f ^= 1;
      path.setAttribute('d', dinoFrames[f]);
      dinoSvg.style.transform = `translateY(${f ? -2.5 : 0}%)`;
    }, 170);
  }
  const stopDino = () => clearInterval(dinoTimer);

  // snow; `streak` blends in per-row brightness for the horizontal scanline smear of a losing signal
  function noise(canvas, streak = 0) {
    const c = canvas.getContext('2d');
    const w = canvas.width;
    const img = c.createImageData(w, canvas.height);
    const d = img.data;
    let row = 0;
    for (let i = 0; i < d.length; i += 4) {
      if ((i / 4) % w === 0) row = Math.random() < 0.3 ? Math.random() * 255 : row * 0.6;
      const v = (Math.random() * 255 * (1 - streak) + row * streak) | 0;
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = 255;
    }
    c.putImageData(img, 0, 0);
  }

  function reset02() {
    const s = scenes[2];
    resetStyles(subtree(s));
    $$('.term p', s).forEach(p => { p.textContent = ''; });
    $('.t-bar i', s).style.width = '0%';
    $('.t-pct', s).textContent = '0%';
    stopDino();
  }

  async function run02(delay = 800) {
    const s = scenes[2];
    await wait(delay);
    for (const p of $$('.t-boot p', s)) { await type(p, 36); await wait(240); }
    await wait(380);
    await play($('.t-login', s), [{ opacity: 0 }, { opacity: 1 }, { opacity: 0.15 }, { opacity: 1 }], { duration: 420, easing: 'linear' });
    await wait(250);
    const prog = $('.t-progress', s);
    await play(prog, [{ opacity: 0 }, { opacity: 1 }], { duration: 220 });
    prog.classList.add('is-loading');
    await loadBar(2800);
    prog.classList.remove('is-loading');
    await wait(450);
    for (const p of $$('.t-hello p', s)) { await type(p, 30); await wait(200); }
    await wait(350);
    startDino();
    await play($('.t-dino', s), [{ opacity: 0, transform: 'translateY(12%)' }, { opacity: 1, transform: 'none' }], { duration: 480, easing: 'steps(6, end)' });
    await wait(2400);
    go23();
  }

  // analog-TV breakup: torn bands, rgb split, vertical-hold slips and snow, ramping from k0 to k1
  async function glitch02(dur, k0, k1) {
    const crt = $('#s02 .crt');
    const term = $('.term', crt);
    const cv = $('.crt__noise', crt);
    crt.classList.add('is-glitching');
    const tears = [0, 1, 2].map(() => {
      const t = term.cloneNode(true);
      t.classList.add('tear');
      t.setAttribute('aria-hidden', 'true');
      crt.insertBefore(t, cv);
      return t;
    });
    const t0 = performance.now();
    await new Promise(res => {
      (function frame(now) {
        const p = Math.min(1, (now - t0) / dur);
        const k = k0 + (k1 - k0) * p;
        noise(cv, 0.75 - 0.5 * p);
        cv.style.opacity = (0.08 + Math.random() * 0.3 * k + (Math.random() < 0.07 ? 0.4 : 0)).toFixed(2);
        const slip = Math.random() < 0.12 * k ? rand(-7, 7) : 0;
        term.style.transform = `translate(${rand(-0.5, 0.5) * k}cqw, ${slip}cqh) skewX(${rand(-3, 3) * k}deg)`;
        term.style.opacity = Math.random() < 0.06 ? 0.25 : 1;
        tears.forEach(t => {
          const top = rand(0, 92);
          const h = rand(2, 11) * k;
          t.style.clipPath = `inset(${top}% 0 ${Math.max(0, 100 - top - h)}% 0)`;
          t.style.transform = `translateX(${rand(-4, 4) * k}cqw)`;
          t.style.opacity = Math.random() < 0.75 ? 1 : 0;
        });
        crt.style.filter = Math.random() < 0.1 * k ? `brightness(${rand(1.4, 2.2)}) contrast(1.4)` : '';
        p < 1 ? requestAnimationFrame(frame) : res();
      })(t0);
    });
    tears.forEach(t => t.remove());
    term.style.transform = '';
    term.style.opacity = '';
    crt.style.filter = '';
    crt.classList.remove('is-glitching');
    return cv;
  }

  async function erase02() {
    const s = scenes[2];
    caret.remove();
    const nodes = $$('.term p', s).map(p => p.firstChild).filter(Boolean);
    const blinkOut = [{ opacity: 1 }, { opacity: 0 }, { opacity: 0.7 }, { opacity: 0 }];
    ['.t-login', '.t-progress', '.t-dino'].forEach(q => play($(q, s), blinkOut, { duration: 420, easing: 'linear' }));
    while (nodes.some(n => n.data.length)) {
      nodes.forEach(n => { n.data = n.data.slice(0, -2); });
      await wait(16);
    }
  }

  // the border grows in over the terminal while its text is still up; the picture breaks into green
  // scanlines, washes out to teal static, and the sky (the video) takes the screen
  async function go23() {
    busy = true;
    const s2 = scenes[2];
    const s3 = scenes[3];
    const st3 = stageOf(3);
    const crt = $('.crt', s2);
    s3.style.background = 'transparent';
    $('.s03-black', st3).style.opacity = 0;
    show(3);
    const done = surface03(0, ['bottom', 'right', 'left', 'top']);
    const settle = { duration: 1700, easing: 'cubic-bezier(.5,0,.2,1)' };
    play(stageOf(2), [{ transform: 'scale(1)' }, { transform: 'scale(1.055)' }], settle);
    // 03's bezel takes over at once (scaled to sit on 02's), so the grass slides in underneath it
    play(st3, [{ transform: 'scale(.948)' }, { transform: 'none' }], settle);
    play($('.crt__wash', crt), [
      { opacity: 0, backgroundColor: 'rgb(28,52,34)' },
      { opacity: 0.85, backgroundColor: 'rgb(28,52,34)', offset: 0.35 },
      { opacity: 0.9, backgroundColor: 'rgb(92,122,120)', offset: 0.85 },
      { opacity: 0.92, backgroundColor: 'rgb(118,146,158)' },
    ], { duration: 2600, delay: 350, easing: 'ease-in' });
    const cv = await glitch02(2900, 0.15, 0.85);
    stopDino();
    await erase02();
    await play(cv, [{ opacity: 0.4 }, { opacity: 0 }], { duration: 300 });
    await done;
    hide(2);
    s3.style.background = '';
    $('.s03-black', st3).style.removeProperty('opacity');
  }

  // ================================================================ 03 · intro
  const VERSES = [
    ['“For I know the plans I have for you,” declares the Lord, “plans to prosper you and not to harm you, plans to give you hope and a future.”', 'Jeremiah 29:11'],
    ['Love is patient, love is kind. It does not envy, it does not boast, it is not proud.', '1 Corinthians 13:4'],
    ['A cord of three strands is not quickly broken.', 'Ecclesiastes 4:12'],
    ['Many waters cannot quench love; rivers cannot sweep it away.', 'Song of Songs 8:7'],
    ['Where you go I will go, and where you stay I will stay. Your people will be my people and your God my God.', 'Ruth 1:16'],
    ['And over all these virtues put on love, which binds them all together in perfect unity.', 'Colossians 3:14'],
    ['We love because he first loved us.', '1 John 4:19'],
  ];
  let verseIndex = 0;
  const verse = $('#verse');
  function renderVerse() {
    $('p', verse).textContent = VERSES[verseIndex][0];
    $('cite', verse).textContent = VERSES[verseIndex][1];
  }
  renderVerse();
  let verseBusy = false;
  async function nextVerse() {
    if (verseBusy) return;
    verseBusy = true;
    await play(verse, [{ opacity: 1, filter: 'blur(0)' }, { opacity: 0, filter: 'blur(4px)' }], { duration: 300, easing: 'ease-in' });
    verseIndex = (verseIndex + 1) % VERSES.length;
    renderVerse();
    await play(verse, [{ opacity: 0, filter: 'blur(4px)' }, { opacity: 1, filter: 'blur(0)' }], { duration: 450, easing: 'ease-out' });
    verseBusy = false;
  }

  // grass, flowers and bubbles surface one layer after another, then the video, then the UI
  function surface03(delay, order = ['left', 'top', 'right', 'bottom']) {
    const st = stageOf(3);
    const from = {
      left: 'translateX(-75%) scale(1.1)',
      top: 'translateY(-80%) scale(1.1)',
      right: 'translateX(70%) scale(1.1)',
      bottom: 'translateY(70%) scale(1.12)',
    };
    const out = 'cubic-bezier(.16,1,.3,1)';
    order.forEach((side, i) => {
      play($(`.grass[data-from="${side}"]`, st),
        [{ transform: from[side], opacity: 0, filter: 'blur(6px)' }, { transform: 'none', opacity: 1, filter: 'blur(0)' }],
        { duration: 1700, delay: delay + i * 300, easing: out });
    });
    play($('.flowers', st),
      [{ transform: 'translateY(4%) scale(1.04)', opacity: 0, filter: 'blur(5px)' }, { transform: 'none', opacity: 1, filter: 'blur(0)' }],
      { duration: 1500, delay: delay + 1250, easing: out });
    const bubbles = $$('.bub', st).sort(() => Math.random() - 0.5);
    bubbles.forEach((b, i) => {
      play(b, [{ transform: 'translateY(30%) scale(.2)', opacity: 0 }, { transform: 'scale(1.08)', opacity: 1, offset: 0.7 }, { transform: 'none', opacity: 1 }],
        { duration: 950, delay: delay + 1350 + i * 90, easing: 'ease-out' });
    });
    play($('.s03-video', st), [{ opacity: 0, filter: 'brightness(1.5) blur(8px)' }, { opacity: 1, filter: 'none' }],
      { duration: 1500, delay: delay + 2700, easing: 'ease-out' });
    const ui = $$('.s03-ui > *', st);
    ui.forEach((el, i) => play(el, [{ opacity: 0 }, { opacity: 1 }], { duration: 700, delay: delay + 3200 + i * 110 }));

    setTimeout(() => {
      Music.start();
      const v = $('.intro-video', st);
      if (v) v.play().catch(() => {});
    }, delay + 2700);
    return wait(delay + 4200).then(() => { current = 3; busy = false; });
  }

  scenes[3].addEventListener('click', e => {
    if (current !== 3 || busy || e.target.closest('button')) return;
    nextVerse();
  });

  const mute = $('#mute');
  mute.addEventListener('click', () => {
    const m = mute.getAttribute('aria-pressed') !== 'true';
    mute.setAttribute('aria-pressed', String(m));
    mute.setAttribute('aria-label', m ? 'Play music' : 'Mute music');
    Music.setMuted(m);
  });

  // the active highlight slides along the nav (0 intro, 1 journey, 2 wedding)
  const navPill = $('.nav3__pill');
  function slideNav(i) {
    $$('.nav3 button').forEach((b, j) => (j === i ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current')));
    return play(navPill, [{ transform: getComputedStyle(navPill).transform }, { transform: `translateX(calc(${i} * (100% - .12cqw)))` }],
      { duration: 480, easing: 'cubic-bezier(.6,0,.2,1)' });
  }

  // the next scene appears inside the blob, then the grass border rushes past the camera:
  // we go through the screen instead of cutting to a new page.
  // 03 stays on top with its screen emptied; 04 waits underneath.
  const THROUGH = { world: 2.9, bubbles: 4, bezel: 1.3, behind: 1.12 };
  function openScreen(on) {
    scenes[3].style.zIndex = on ? 2 : '';
    scenes[3].style.background = on ? 'transparent' : '';
    if (on) $('.s03-black', stageOf(3)).style.opacity = 0;
    else $('.s03-black', stageOf(3)).style.removeProperty('opacity');
  }

  async function go34(target = 4) {
    busy = true;
    const st = stageOf(3);
    await slideNav(target === 5 ? 2 : 1);
    await wait(120);
    reset04();
    openScreen(true);
    show(4);
    const D = 1800;
    const dive = 'cubic-bezier(.5,0,.8,.3)';
    play(stageOf(4), [{ transform: `scale(${THROUGH.behind})` }, { transform: 'none' }], { duration: D + 500, easing: 'cubic-bezier(.3,.1,.2,1)' });
    play($('.s03-ui', st), [{ opacity: 1 }, { opacity: 0 }], { duration: 350 });
    play($('.s03-video', st), [{ opacity: 1 }, { opacity: 0 }], { duration: 650, easing: 'ease-in-out' });
    play($('.bezel', st), [{ transform: 'none', opacity: 1 }, { transform: `scale(${THROUGH.bezel})`, opacity: 0 }], { duration: 700, easing: 'ease-in' });
    play($('.s03-bubbles', st), [{ transform: 'none', opacity: 1 }, { transform: `scale(${THROUGH.bubbles})`, opacity: 0 }], { duration: D, delay: 250, easing: dive });
    await play($('.s03-world', st), [
      { transform: 'none', filter: 'blur(0)', opacity: 1 },
      { transform: 'scale(1.12)', filter: 'blur(0)', opacity: 1, offset: 0.3 },
      { transform: `scale(${THROUGH.world})`, filter: 'blur(4px)', opacity: 1, offset: 0.85 },
      { transform: `scale(${THROUGH.world * 1.08})`, filter: 'blur(5px)', opacity: 0 },
    ], { duration: D, delay: 250, easing: dive });
    hide(3);
    openScreen(false);
    current = 4;
    await autoOpenFolder();
    busy = false;
  }

  // climb back out through the screen
  async function go43() {
    busy = true;
    const st = stageOf(3);
    openScreen(true);
    show(3);
    const out = 'cubic-bezier(.2,.75,.2,1)';
    play(stageOf(4), [{ transform: 'none' }, { transform: `scale(${THROUGH.behind})` }], { duration: 1600, easing: out });
    play($('.s03-world', st), [
      { transform: `scale(${THROUGH.world * 1.08})`, filter: 'blur(5px)', opacity: 0 },
      { transform: `scale(${THROUGH.world})`, filter: 'blur(4px)', opacity: 1, offset: 0.15 },
      { transform: 'none', filter: 'blur(0)', opacity: 1 },
    ], { duration: 1600, easing: out });
    play($('.s03-bubbles', st), [{ transform: `scale(${THROUGH.bubbles})`, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 1600, easing: out });
    play($('.bezel', st), [{ transform: `scale(${THROUGH.bezel})`, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 700, delay: 900, easing: 'ease-out' });
    play($('.s03-ui', st), [{ opacity: 0 }, { opacity: 1 }], { duration: 600, delay: 1200 });
    await play($('.s03-video', st), [{ opacity: 0 }, { opacity: 1 }], { duration: 700, delay: 1000, easing: 'ease-in-out' });
    hide(4);
    reset04();
    openScreen(false);
    current = 3;
    await slideNav(0);
    busy = false;
  }

  // ================================================================ 04 · journey
  const s4 = scenes[4];
  const win = $('.window', s4);
  const wins = $$('.win', s4);
  const folder4 = $('.folder', s4);
  const cursor4 = $('.cursor', s4);
  let tab = 0;
  let winOpen = false;

  // the new tab fades in on top of the old one, so the glass never turns see-through mid-swap
  function setTab(n, instant) {
    const prev = wins[tab];
    const next = wins[n];
    tab = n;
    if (instant) {
      wins.forEach((w, i) => {
        w.getAnimations().forEach(a => a.cancel());
        w.style.opacity = i === n ? 1 : 0;
        w.style.zIndex = i === n ? 2 : 1;
      });
      return;
    }
    if (prev === next) return;
    wins.forEach(w => {
      if (w !== prev && w !== next) { w.style.opacity = 0; w.style.zIndex = 1; }
    });
    prev.style.zIndex = 2;
    next.style.zIndex = 3;
    play(next, [{ opacity: 0, filter: 'blur(5px)' }, { opacity: 1, filter: 'blur(0)' }], { duration: 480 }).then(() => {
      if (wins[tab] !== prev) prev.style.opacity = 0;
    });
  }

  function reset04() {
    resetStyles(subtree(s4));
    win.classList.remove('is-open');
    folder4.classList.remove('is-selected');
    winOpen = false;
    setTab(0, true);
  }

  // the glass grows out of the folder as a faint pane, settles over the meadow, then its content comes into focus
  const growFrom = [
    { transform: 'scale(.2)', opacity: 0, filter: 'blur(6px)' },
    { transform: 'scale(.55)', opacity: 0.75, filter: 'blur(3px)', offset: 0.35 },
    { transform: 'none', opacity: 1, filter: 'blur(0)' },
  ];
  // a leftover filter (even blur(0)) would switch off the frosted-glass blur inside the window
  const settleGlass = el => el.style.removeProperty('filter');
  const shrinkTo = [{ transform: 'none', opacity: 1 }, { transform: 'scale(.06)', opacity: 0 }];
  const originAt = (box, F) => `${((F.x + F.w / 2) - box.x) / box.w * 100}% ${((F.y + F.h / 2) - box.y) / box.h * 100}%`;

  async function openWindow() {
    win.style.transformOrigin = originAt(M.win0, M.j00_folder);
    setTab(0, true);
    win.classList.add('is-open');
    setTimeout(() => folder4.classList.remove('is-selected'), 200);
    await play(win, growFrom, { duration: 800, easing: 'cubic-bezier(.25,.8,.25,1)' });
    settleGlass(win);
    winOpen = true;
    await wait(150);
    setTab(1);
    await wait(500);
  }

  async function closeWindow() {
    busy = true;
    win.style.transformOrigin = originAt(M.win0, M.j00_folder);
    await play(win, shrinkTo, { duration: 520, easing: 'cubic-bezier(.5,0,.75,0)' });
    win.classList.remove('is-open');
    winOpen = false;
    busy = false;
  }

  // the pointer from the mockup glides in, lands on the folder and double-clicks it
  async function autoOpenFolder() {
    await play(cursor4, [
      { opacity: 0, transform: 'translate(520%, 280%)' },
      { opacity: 1, transform: 'translate(180%, 70%)', offset: 0.45 },
      { opacity: 1, transform: 'none' },
    ], { duration: 1300, easing: 'cubic-bezier(.45,0,.2,1)' });
    await wait(380);
    const onFolder = 'translate(-58%, -16%)';
    await play(cursor4, [{ transform: 'none' }, { transform: onFolder }], { duration: 360, easing: 'ease-in-out' });
    for (let i = 0; i < 2; i++) {
      folder4.classList.add('is-selected');
      await play(cursor4, [{ transform: onFolder }, { transform: `${onFolder} scale(.84)` }, { transform: onFolder }], { duration: 150 });
      await wait(60);
    }
    play(cursor4, [{ opacity: 1 }, { opacity: 0 }], { duration: 500, delay: 150 });
    await openWindow();
  }

  $$('.tab', s4).forEach(b => b.addEventListener('click', () => {
    if (!busy && winOpen) setTab(+b.dataset.tab);
  }));
  $('.dot--close', s4).addEventListener('click', () => { if (!busy && winOpen) closeWindow(); });
  folder4.addEventListener('click', async () => {
    if (busy || winOpen || current !== 4) return;
    busy = true;
    folder4.classList.add('is-selected');
    await wait(160);
    await openWindow();
    busy = false;
  });

  // ================================================================ 05 · new chapter
  const s5 = scenes[5];
  const haze = $('.haze');

  const fly = $('.fly', s4);
  const FLY_CUT = 4.9;  // seconds into the clip: deep in the motion blur, where the river takes over
  let flyReady = false;
  fly.addEventListener('loadeddata', () => { flyReady = true; }, { once: true });
  const until = test => new Promise(res => { (function poll() { test() ? res() : setTimeout(poll, 30); })(); });

  async function cursorTo5() {
    await play(cursor5, [
      { opacity: 0, transform: 'translate(480%, 300%)' },
      { opacity: 1, transform: 'translate(160%, 80%)', offset: 0.45 },
      { opacity: 1, transform: 'none' },
    ], { duration: 1300, easing: 'cubic-bezier(.45,0,.2,1)' });
  }

  // cinematic scroll: the camera dashes forward low through the meadow grass (fly.mp4)
  // and comes out of the motion blur at the river
  async function go45() {
    busy = true;
    if (!flyReady) return go45Css();
    const st5 = stageOf(5);
    if (winOpen) {
      win.style.transformOrigin = '50% 50%';
      play(win, [{ transform: 'none', opacity: 1, filter: 'blur(0)' }, { transform: 'scale(.95)', opacity: 0, filter: 'blur(6px)' }],
        { duration: 600, easing: 'ease-in' });
    }
    play(folder4, [{ opacity: 1 }, { opacity: 0 }], { duration: 400 });
    fly.currentTime = 0;
    await until(() => !fly.seeking);
    await wait(550);
    fly.style.opacity = 1;  // the clip opens on this exact meadow, so the swap is invisible
    fly.playbackRate = 1.3;
    await fly.play().catch(() => {});
    await until(() => fly.currentTime >= FLY_CUT || fly.ended || fly.paused);
    resetStyles(subtree(s5));
    show(5);
    play(st5, [{ transform: 'scale(1.2)', filter: 'blur(14px)' }, { transform: 'none', filter: 'blur(0)' }],
      { duration: 1600, easing: 'cubic-bezier(.2,.7,.2,1)' });
    await play(s5, [{ opacity: 0 }, { opacity: 1 }], { duration: 750, easing: 'ease-in-out' });
    fly.pause();
    fly.style.opacity = 0;
    hide(4);
    current = 5;
    await wait(1000);
    await cursorTo5();
    busy = false;
  }

  // fallback when the clip can't play: push up and forward through a haze
  async function go45Css() {
    const st4 = stageOf(4);
    const st5 = stageOf(5);
    if (winOpen) {
      win.style.transformOrigin = '50% 50%';
      play(win, [{ transform: 'none', opacity: 1, filter: 'blur(0)' }, { transform: 'translateY(-16%) scale(.9)', opacity: 0, filter: 'blur(6px)' }],
        { duration: 850, easing: 'cubic-bezier(.5,0,.75,0)' });
    }
    play(folder4, [{ opacity: 1 }, { opacity: 0 }], { duration: 500 });
    play(st4, [{ transform: 'none', filter: 'blur(0)' }, { transform: 'translateY(-7%) scale(1.6)', filter: 'blur(10px)' }],
      { duration: 2100, delay: 250, easing: 'cubic-bezier(.55,0,.6,.4)' });
    play(haze, [{ opacity: 0 }, { opacity: 0.88, offset: 0.5 }, { opacity: 0 }], { duration: 2700, delay: 450, easing: 'ease-in-out' });
    await wait(1450);
    resetStyles(subtree(s5));
    show(5);
    play(st5, [{ transform: 'translateY(9%) scale(1.3)', filter: 'blur(10px)' }, { transform: 'none', filter: 'blur(0)' }],
      { duration: 2100, easing: 'cubic-bezier(.15,.6,.2,1)' });
    await play(s5, [{ opacity: 0 }, { opacity: 1 }], { duration: 900, easing: 'ease-out' });
    hide(4);
    current = 5;
    await wait(1300);
    await cursorTo5();
    busy = false;
  }

  async function go54() {
    busy = true;
    const st4 = stageOf(4);
    const st5 = stageOf(5);
    resetStyles(st4);
    fly.style.opacity = 0;
    show(4);
    play(st4, [{ transform: 'scale(1.25)', filter: 'blur(10px)' }, { transform: 'none', filter: 'blur(0)' }],
      { duration: 1800, easing: 'cubic-bezier(.2,.7,.2,1)' });
    if (winOpen) {
      play(win, [{ transform: 'scale(.95)', opacity: 0, filter: 'blur(6px)' }, { transform: 'none', opacity: 1, filter: 'blur(0)' }],
        { duration: 900, delay: 800, easing: 'cubic-bezier(.2,.8,.2,1)' });
    }
    play(folder4, [{ opacity: 0 }, { opacity: 1 }], { duration: 600, delay: 600 });
    play(haze, [{ opacity: 0 }, { opacity: 0.7, offset: 0.45 }, { opacity: 0 }], { duration: 1900, easing: 'ease-in-out' });
    play(st5, [{ transform: 'none', filter: 'blur(0)' }, { transform: 'translateY(9%) scale(1.3)', filter: 'blur(10px)' }],
      { duration: 1500, easing: 'cubic-bezier(.5,0,.75,0)' });
    await play(s5, [{ opacity: 1 }, { opacity: 0 }], { duration: 1100, delay: 300 });
    hide(5);
    win5.classList.remove('is-open');
    resetStyles(win5);
    win5Open = false;
    current = 4;
    await wait(800);
    busy = false;
  }

  // "new chapter" opens its own glass window (empty until that chapter is designed)
  const win5 = $('.window5', s5);
  const folder5 = $('#chapterFolder');
  const W5 = { x: 15, y: 24.4, w: 68.8, h: 55.6 };
  let win5Open = false;
  folder5.addEventListener('click', async () => {
    if (busy || current !== 5 || win5Open) return;
    busy = true;
    folder5.classList.add('is-selected');
    play(cursor5, [{ opacity: 1 }, { opacity: 0 }], { duration: 300 });
    win5.style.transformOrigin = originAt(W5, M.j05_folder);
    await wait(160);
    win5.classList.add('is-open');
    setTimeout(() => folder5.classList.remove('is-selected'), 200);
    await play(win5, growFrom, { duration: 800, easing: 'cubic-bezier(.25,.8,.25,1)' });
    settleGlass(win5);
    win5Open = true;
    busy = false;
  });
  $('.w5-dot--close', win5).addEventListener('click', async () => {
    if (busy || !win5Open) return;
    busy = true;
    await play(win5, shrinkTo, { duration: 520, easing: 'cubic-bezier(.5,0,.75,0)' });
    win5.classList.remove('is-open');
    win5Open = false;
    busy = false;
  });
  $$('.w5-tab[title]', win5).forEach(t => t.addEventListener('click', () => {
    $$('.w5-tab', win5).forEach(x => x.classList.toggle('is-on', x === t));
  }));

  // ================================================================ navigation
  function onScroll(dir) {
    if (busy) return;
    if (current === 3 && dir > 0) go34();
    else if (current === 4) {
      if (dir > 0) winOpen && tab < 5 ? stepTab(tab + 1) : go45();
      else winOpen && tab > 1 ? stepTab(tab - 1) : go43();
    } else if (current === 5 && dir < 0) go54();
  }
  function stepTab(n) {
    busy = true;
    setTab(n);
    setTimeout(() => { busy = false; }, 650);
  }

  async function goTo(n) {
    if (busy || n === current || current < 3) return;
    if (current === 3) {
      await go34(n);
      if (n === 5) await go45();
    } else if (current === 4) {
      await (n === 5 ? go45() : go43());
    } else if (current === 5) {
      await go54();
      if (n === 3) await go43();
    }
  }
  $$('[data-go]').forEach(b => b.addEventListener('click', () => goTo(+b.dataset.go)));
  $$('[data-rsvp]').forEach(b => b.addEventListener('click', () => toast('RSVP — coming soon')));

  let toastTimer = 0;
  function toast(msg) {
    const t = $('.toast');
    t.textContent = msg;
    t.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('is-on'), 2200);
  }

  // wheel: one step per gesture (trackpad inertia is swallowed until the stream pauses)
  let acc = 0;
  let lastWheel = 0;
  let gated = false;
  addEventListener('wheel', e => {
    e.preventDefault();
    const now = performance.now();
    const gap = now - lastWheel;
    lastWheel = now;
    if (gated) {
      if (gap < 220) return;
      gated = false;
    }
    if (busy || current < 3) { acc = 0; return; }
    acc += e.deltaY;
    if (Math.abs(acc) > 40) {
      const dir = Math.sign(acc);
      acc = 0;
      gated = true;
      onScroll(dir);
    }
  }, { passive: false });

  let touchY = null;
  addEventListener('touchstart', e => { touchY = e.touches[0].clientY; }, { passive: true });
  addEventListener('touchend', e => {
    if (touchY === null) return;
    const dy = touchY - e.changedTouches[0].clientY;
    touchY = null;
    if (Math.abs(dy) > 45) onScroll(Math.sign(dy));
  }, { passive: true });

  addEventListener('keydown', e => {
    if (e.target === pw) return;
    if (['ArrowDown', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); onScroll(1); }
    if (['ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); onScroll(-1); }
  });

  // ================================================================ dev shortcut: ?scene=N
  const jump = +new URLSearchParams(location.search).get('scene');
  if (jump) window.proto = { go12, go23, go34, go43, go45, go54, run02 };  // for poking at transitions in devtools
  if (jump >= 2 && jump <= 5) {
    hide(1);
    if (jump === 2) { reset02(); show(2); current = 2; run02(); }
    if (jump === 3) { busy = true; show(3); surface03(200); }
    if (jump === 4) { show(4); current = 4; busy = true; autoOpenFolder().then(() => { busy = false; }); }
    if (jump === 5) { show(5); current = 5; play(cursor5, [{ opacity: 0 }, { opacity: 1 }], { duration: 400 }); }
  }
})();
