/*
 * Kliff & Chao, phone prototype. Plain HTML/CSS/JS, no build step.
 * Same story as prototype-v3, framed for a portrait phone:
 *   01 gate     →(Enter: dive into the monitor)→ 02 terminal
 *   02 terminal →(types, loads, glitches)→       03 intro (the film on the whole screen)
 *   03 intro    →(swipe up / JOURNEY)→           04 journey (folder → glass card, 5 chapters)
 *   04 journey  →(swipe past the last chapter)→  05 wedding (folder → glass sheet)
 * The meadow and the river are depth layers (assets/world.js): moving between them is a camera
 * travelling forward, each layer scaled about its vanishing point, the nearer ones faster.
 * Swipe up = further in, swipe down = back. A scrolling card keeps the swipe until
 * it reaches its end. The password is not checked here (any word works).
 */
(() => {
  const M = window.MANIFEST;
  const C = window.CONTENT;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const rand = (a, b) => a + Math.random() * (b - a);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const phone = $('#phone');
  const site = p => 'site' + p;

  // ---------------------------------------------------------------- layout from the manifest
  // 02: no monitor on the phone, the terminal is the whole screen
  M.p02_screen = { x: 0, y: 0, w: 100, h: 100, src: M.p02_screen.src };
  // 01: the picture is scaled up from the bottom edge so the monitor sits in the middle of the
  // screen (not low on it), with the heading and the password pill under it
  const GATE_SCALE = 1.32;
  Object.keys(M).filter(k => /^p01_(sky|fg|monitor|screen|bubble\d+)$/.test(k)).forEach(k => {
    const a = M[k];
    a.x = 50 + (a.x - 50) * GATE_SCALE;
    a.y = 100 + (a.y - 100) * GATE_SCALE;
    a.w *= GATE_SCALE;
    a.h *= GATE_SCALE;
  });
  const gateBottom = M.p01_monitor.y + M.p01_monitor.h;
  M.p01_heading.cy = gateBottom + 7.6;
  M.p01_subtitle.cy = gateBottom + 10.6;
  M.p01_input.y = gateBottom + 12.8;
  $$('[data-asset]').forEach(el => {
    const a = M[el.dataset.asset];
    if (!a) return;
    Object.assign(el.style, { left: a.x + '%', top: a.y + '%', width: a.w + '%', height: a.h + '%' });
    if (el.tagName === 'IMG' && a.src) el.src = a.src;
    if (el.hasAttribute('data-bg')) el.style.backgroundImage = `url(${a.src})`;
  });
  $$('[data-src]').forEach(el => { el.src = M[el.dataset.src].src; });
  $$('.monitor__ghost').forEach(g => { g.style.backgroundImage = `url(${M.p01_screen.src})`; });
  const heading = $('.s01-h');
  heading.style.top = M.p01_heading.cy + '%';
  $('.s01-sub').style.top = M.p01_subtitle.cy + '%';
  $('.s01-err').style.top = (M.p01_input.y + M.p01_input.h + 1.4) + '%';
  const c5 = $('#cursor5');
  Object.assign(c5.style, { left: M.p05_cursor.x + '%', top: M.p05_cursor.y + '%' });

  // ---------------------------------------------------------------- animation helpers
  // every animation commits its end state as inline style, so scenes stay put after a move
  function play(el, frames, opts = {}) {
    if (!el) return Promise.resolve();
    const d = reduced ? Math.min(opts.duration || 600, 200) : (opts.duration || 600);
    const a = el.animate(frames, { easing: 'ease', fill: 'both', ...opts, duration: d, delay: reduced ? 0 : (opts.delay || 0) });
    // a background tab can freeze animation frames; never let a move hang
    const guard = wait(d + (reduced ? 0 : (opts.delay || 0)) + 400);
    return Promise.race([a.finished, guard]).then(() => {
      try { a.finish(); a.commitStyles(); } catch (e) { /* not rendered */ }
      a.cancel();
    }, () => {});
  }
  const ANIMATED = ['transform', 'opacity', 'filter'];
  const resetStyles = (...els) => els.flat().forEach(el => ANIMATED.forEach(p => el.style.removeProperty(p)));
  const subtree = root => [root, ...$$('*', root)];
  // a leftover filter (even blur(0)) switches off the frosted glass inside an element
  const settleGlass = el => el.style.removeProperty('filter');

  // ---------------------------------------------------------------- scenes
  const scenes = { 1: $('#s01'), 2: $('#s02'), 3: $('#s03'), 4: $('#s04'), 5: $('#s05') };
  const stageOf = n => $('.stage', scenes[n]);
  const show = n => scenes[n].classList.add('is-active');
  const hide = n => scenes[n].classList.remove('is-active');
  let current = 1;
  let busy = false;
  const chrome = on => phone.classList.toggle('chrome-on', on);

  // ---------------------------------------------------------------- music: the real song
  // The Enter tap starts it muted (iOS only lets audio start inside a gesture) and it stays
  // silent through the dive and the terminal; the intro brings it in from the top. The button
  // shows bars while it plays and a crossed speaker while it is off or muted; if the browser
  // refuses to start it, one tap on the button does.
  const Music = (() => {
    const el = new Audio(site(C.siteConfig.audioSrc));
    el.loop = true;
    el.preload = 'none';
    let muted = false;
    let playing = false;
    let fade = 0;
    const ui = () => {
      const on = playing && !muted;
      phone.classList.toggle('music-on', on);
      const b = $('#mute');
      b.setAttribute('aria-pressed', String(!on));
      b.setAttribute('aria-label', on ? 'Mute the music' : 'Turn the music on');
    };
    const fadeIn = () => {
      clearInterval(fade);
      el.volume = 0;
      let v = 0;
      fade = setInterval(() => { v = Math.min(0.55, v + 0.03); el.volume = v; if (v >= 0.55) clearInterval(fade); }, 100);
    };
    return {
      playMutedSync() { el.muted = true; el.play().catch(() => {}); },
      begin() {
        el.currentTime = 0;
        el.muted = muted;
        el.volume = 0;
        el.play().then(() => { playing = true; if (!muted) fadeIn(); ui(); }, () => { playing = false; ui(); });
      },
      stop() { el.pause(); playing = false; ui(); },
      toggle() {
        if (!playing) {
          muted = false;
          el.muted = false;
          el.volume = 0;
          el.play().then(() => { playing = true; fadeIn(); ui(); }, () => {});
          return;
        }
        muted = !muted;
        el.muted = muted;
        if (!muted) fadeIn();
        ui();
      },
    };
  })();
  $('#mute').addEventListener('click', e => { e.stopPropagation(); Music.toggle(); });

  // ================================================================ 01 · gate
  const pw = $('#pw');
  const go = $('#go');
  const pill = $('.pill');
  const err = $('.s01-err');
  pw.addEventListener('input', () => { go.hidden = !pw.value.trim(); err.textContent = ''; });
  pw.addEventListener('keydown', e => { if (e.key === 'Enter') enter(); });
  go.addEventListener('click', enter);
  function enter() {
    if (busy || current !== 1) return;
    Music.playMutedSync();  // inside the gesture, before anything async
    if (!pw.value.trim()) {
      Music.stop();
      pill.classList.remove('is-wrong');
      void pill.offsetWidth;
      pill.classList.add('is-wrong');
      err.textContent = 'Type the password from your invitation';
      return;
    }
    pw.blur();
    go12();
  }

  // the on-screen keyboard covers the bottom of the screen: lift the scene so the pill stays visible
  if (window.visualViewport) {
    const lift = () => {
      const vv = window.visualViewport;
      const st = stageOf(1);
      if (document.activeElement !== pw) { st.style.removeProperty('translate'); return; }
      const r = pill.getBoundingClientRect();
      const over = r.bottom + 24 - (vv.height + vv.offsetTop);
      st.style.translate = over > 0 ? `0 ${-over}px` : '';
    };
    visualViewport.addEventListener('resize', lift);
    pw.addEventListener('focus', () => setTimeout(lift, 300));
    pw.addEventListener('blur', () => stageOf(1).style.removeProperty('translate'));
  }

  // one camera move into the monitor: the meadow falls out of focus, the screen goes dark,
  // and the terminal's (tall) screen grows out of it
  async function go12() {
    busy = true;
    const st1 = stageOf(1);
    const st2 = stageOf(2);
    st1.style.removeProperty('translate');
    const scr = M.p01_screen;
    const to = M.p02_screen;
    const O = [scr.x + scr.w / 2, scr.y + scr.h / 2];
    const Cc = [to.x + to.w / 2, to.y + to.h / 2];
    // the terminal screen is tall, the monitor's is wide: fit it inside, so the
    // monitor's dark screen fills the phone by the end
    const A = Math.min(scr.w / to.w, scr.h / to.h);
    const S = 1 / A;
    st1.style.transformOrigin = st2.style.transformOrigin = '0 0';
    const f1 = [];
    const f2 = [];
    const dof = [];
    for (let i = 0; i <= 30; i++) {
      const t = i / 30;
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      const s = Math.pow(S, e);
      const k = (s - 1) / (S - 1);
      const T1 = O.map((o, j) => o * (1 - s) + k * (Cc[j] - o));
      const T2 = O.map((o, j) => o * (1 - s) + (o - Cc[j] * A) * s + k * (Cc[j] - o));
      f1.push({ offset: t, transform: `translate(${T1[0]}%, ${T1[1]}%) scale(${s})` });
      f2.push({ offset: t, transform: `translate(${T2[0]}%, ${T2[1]}%) scale(${A * s})` });
      dof.push({ offset: t, filter: `blur(${(12 * Math.min(1, Math.max(0, (e - 0.1) / 0.45)) / s).toFixed(3)}px)` });
    }
    const D = reduced ? 400 : 3200;
    const lin = { duration: D, easing: 'linear' };
    play($('.s01-form', st1), [{ opacity: 1 }, { opacity: 0 }], { duration: 300 });
    if (!reduced) {
      play($('.s01-bg', st1), dof, lin);
      play($('.monitor__dark', st1), [{ opacity: 0 }, { opacity: 0, offset: 0.22 }, { opacity: 1, offset: 0.36 }, { opacity: 1 }], lin);
    }
    reset02();
    scenes[2].style.background = 'transparent';
    show(2);
    const zoom = reduced ? Promise.resolve() : play(st1, f1, lin);
    if (!reduced) play(st2, f2, lin);
    play(scenes[2], [{ opacity: 0 }, { opacity: 0, offset: 0.34 }, { opacity: 1, offset: 0.4 }, { opacity: 1 }], lin);
    play($('.full', st2), [{ opacity: 0 }, { opacity: 0, offset: 0.78 }, { opacity: 1 }], lin);
    setTimeout(() => { current = 2; run02(500); }, D * 0.9);
    await zoom;
    await wait(reduced ? 400 : 0);
    scenes[2].style.background = '';
    resetStyles(st2);
    st2.style.transformOrigin = '';
    hide(1);
  }

  // ================================================================ 02 · terminal
  const s2 = scenes[2];
  const caret = document.createElement('span');
  caret.className = 'caret';
  const bootP = $$('.t-boot p', s2);
  const helloP = $$('.t-hello p', s2);
  $('.t-login', s2).textContent = C.terminalCopy.login;

  async function type(p, text, speed) {
    const tn = document.createTextNode('');
    p.textContent = '';
    p.append(tn, caret);
    for (const ch of text) {
      tn.data += ch;
      await wait(reduced ? 0 : speed * rand(0.55, 1.45) + (ch === ' ' ? 18 : 0));
    }
  }

  const video3 = $('.intro-video');
  const videoReady = () => new Promise(res => {
    if (video3.readyState >= 3) return res();
    video3.addEventListener('canplaythrough', res, { once: true });
    video3.addEventListener('error', res, { once: true });
  });

  // monotonic with a few stalls; holds at 90% until the film can play (never more than 4 s)
  async function loadBar(ms) {
    const fill = $('.t-bar i', s2);
    const pct = $('.t-pct', s2);
    const set = v => { fill.style.width = v + '%'; pct.textContent = v + '%'; };
    const ramp = async (dur, f) => {
      const t0 = performance.now();
      for (;;) {
        const t = Math.min(1, (performance.now() - t0) / dur);
        set(f(t));
        if (t >= 1) return;
        await wait(33);
      }
    };
    await ramp(ms, t => Math.round((t - Math.sin(t * Math.PI * 6) / (Math.PI * 6)) * 90));
    await Promise.race([videoReady(), wait(4000)]);
    await ramp(400, t => Math.round(90 + 10 * t));
  }

  const DINO = [
    '..........########..', '.........##.#######.', '.........##########.', '.........##########.',
    '.........##########.', '.........#####......', '.........########...', '#.......#####.......',
    '#......#######......', '##....##########....', '###..#########.#....', '##############......',
    '##############......', '.############.......', '..##########........', '...########.........',
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
  const dinoSvg = $('.dino', s2);
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
    resetStyles(subtree(s2));
    [...bootP, ...helloP].forEach(p => { p.textContent = ''; });
    $('.t-bar i', s2).style.width = '0%';
    $('.t-pct', s2).textContent = '0%';
    clearInterval(dinoTimer);
  }

  async function run02(delay = 600) {
    await wait(delay);
    for (const [i, p] of bootP.entries()) { await type(p, C.terminalCopy.boot[i], 36); await wait(220); }
    await wait(360);
    await play($('.t-login', s2), [{ opacity: 0 }, { opacity: 1 }, { opacity: 0.15 }, { opacity: 1 }], { duration: 420, easing: 'linear' });
    await wait(240);
    const prog = $('.t-progress', s2);
    await play(prog, [{ opacity: 0 }, { opacity: 1 }], { duration: 220 });
    prog.classList.add('is-loading');
    await loadBar(2800);
    prog.classList.remove('is-loading');
    await wait(420);
    for (const [i, p] of helloP.entries()) { await type(p, C.terminalCopy.hello[i], 30); await wait(200); }
    await wait(320);
    startDino();
    await play($('.t-dino', s2), [{ opacity: 0, transform: 'translateY(12%)' }, { opacity: 1, transform: 'none' }], { duration: 480, easing: 'steps(6, end)' });
    await wait(2200);
    go23();
  }

  // analog-TV breakup: torn bands, rgb split, vertical-hold slips and snow
  async function glitch02(dur, k0, k1) {
    const crt = $('.crt', s2);
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
    const tick = () => {
      const p = Math.min(1, (performance.now() - t0) / dur);
      const k = k0 + (k1 - k0) * p;
      noise(cv, 0.75 - 0.5 * p);
      cv.style.opacity = (0.08 + Math.random() * 0.3 * k + (Math.random() < 0.07 ? 0.4 : 0)).toFixed(2);
      const slip = Math.random() < 0.12 * k ? rand(-4, 4) : 0;
      term.style.transform = `translate(${rand(-1, 1) * k}cqw, ${slip}cqh) skewX(${rand(-3, 3) * k}deg)`;
      term.style.opacity = Math.random() < 0.06 ? 0.25 : 1;
      tears.forEach(t => {
        const top = rand(0, 95);
        const h = rand(1, 6) * k;
        t.style.clipPath = `inset(${top}% 0 ${Math.max(0, 100 - top - h)}% 0)`;
        t.style.transform = `translateX(${rand(-8, 8) * k}cqw)`;
        t.style.opacity = Math.random() < 0.75 ? 1 : 0;
      });
      crt.style.filter = Math.random() < 0.1 * k ? `brightness(${rand(1.4, 2.2)}) contrast(1.4)` : '';
    };
    const iv = setInterval(tick, 33);  // a timer, so a background tab can't freeze it
    await wait(reduced ? 200 : dur);
    clearInterval(iv);
    tears.forEach(t => t.remove());
    term.style.transform = term.style.opacity = crt.style.filter = '';
    crt.classList.remove('is-glitching');
    return cv;
  }

  async function erase02() {
    caret.remove();
    const nodes = $$('.term p', s2).map(p => p.firstChild).filter(Boolean);
    const blinkOut = [{ opacity: 1 }, { opacity: 0 }, { opacity: 0.7 }, { opacity: 0 }];
    ['.t-login', '.t-progress', '.t-dino'].forEach(q => play($(q, s2), blinkOut, { duration: 420, easing: 'linear' }));
    while (nodes.some(n => n.data.length)) {
      nodes.forEach(n => { n.data = n.data.slice(0, -2); });
      await wait(16);
    }
  }

  // the terminal breaks up into scanlines and teal static (the screen washes to the colour
  // the film starts from), then the film tunes in on the same screen
  async function go23() {
    busy = true;
    play($('.crt__wash', s2), [
      { opacity: 0, backgroundColor: 'rgb(28,52,34)' },
      { opacity: 0.85, backgroundColor: 'rgb(28,52,34)', offset: 0.35 },
      { opacity: 0.9, backgroundColor: 'rgb(92,122,120)', offset: 0.85 },
      { opacity: 0.92, backgroundColor: 'rgb(118,146,158)' },
    ], { duration: 2600, delay: 350, easing: 'ease-in' });
    const cv = await glitch02(2900, 0.15, 0.85);
    clearInterval(dinoTimer);
    await erase02();
    await play(cv, [{ opacity: 0.4 }, { opacity: 0 }], { duration: 300 });
    show(3);
    hide(2);
    await surface03(0);
  }

  // ================================================================ 03 · intro
  let verseIndex = 0;
  const verse = $('#verse');
  function renderVerse() {
    $('.verse__t', verse).textContent = C.verses[verseIndex].text;
    $('cite', verse).textContent = C.verses[verseIndex].ref;
  }
  renderVerse();
  let verseBusy = false;
  verse.addEventListener('click', async () => {
    if (verseBusy) return;
    verseBusy = true;
    await play(verse, [{ opacity: 1, filter: 'blur(0)' }, { opacity: 0, filter: 'blur(4px)' }], { duration: 300, easing: 'ease-in' });
    verseIndex = (verseIndex + 1) % C.verses.length;
    renderVerse();
    await play(verse, [{ opacity: 0, filter: 'blur(4px)' }, { opacity: 1, filter: 'blur(0)' }], { duration: 450, easing: 'ease-out' });
    verseBusy = false;
  });

  // the film tunes in (bright and soft, then settling), then the verse; the song comes in with it
  function surface03(delay = 0, fast = 1) {
    const T = ms => ms * fast;
    const st = stageOf(3);
    chrome(true);
    Music.begin();
    video3.play().catch(() => {});
    play(video3, [{ opacity: 0, filter: 'brightness(2.2) contrast(.7) blur(10px)' }, { opacity: 1, filter: 'none' }],
      { duration: T(1500), delay, easing: 'cubic-bezier(.2,.7,.2,1)' });
    play($('.s03-ui', st), [{ opacity: 0 }, { opacity: 1 }], { duration: T(800), delay: delay + T(1400) });
    return wait(delay + T(2300)).then(() => { current = 3; busy = false; });
  }

  // the highlight slides along the bottom nav (0 intro, 1 journey, 2 wedding)
  const navPill = $('.chrome-nav__pill');
  function slideNav(i) {
    $$('.chrome-nav button').forEach((b, j) => (j === i ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current')));
    return play(navPill, [{ transform: getComputedStyle(navPill).transform }, { transform: `translateX(${i * 100}%)` }],
      { duration: 480, easing: 'cubic-bezier(.6,0,.2,1)' });
  }

  // ---------------------------------------------------------------- the world: the meadow and the river as depth layers
  // Same camera as the website (lib/scene/world.ts): a layer's scale is 1 / (1 - nearness x camera)
  // about its scene's vanishing point, so the nearer layers rush past and the far ones barely move.
  const WORLD = window.WORLD;
  const NEAR = { sky: 0, far: 0.1, mid: 0.66, near: 0.8, fore: 0.9, glint: 0.5 };
  const ARRIVAL_BACK = -0.22;
  const RIVER_LAG = 0.55;
  const clamp01 = n => Math.min(1, Math.max(0, n));
  const sstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const pscale = (n, c) => 1 / Math.max(0.04, 1 - n * c);
  const easeOut3 = p => 1 - Math.pow(1 - p, 3);
  const easeIn2 = p => p * p;
  const easeInOut2 = p => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
  const SWAY = { mid: { deg: 0.12, x: 1, t: 12 }, near: { deg: 0.22, x: 2, t: 9 }, fore: { deg: 0.34, x: 3, t: 7.5 } };
  // back to front: the river's sky and hills sit under the meadow's, which give way to them
  const ORDER = [['wedding', 'sky'], ['wedding', 'far'], ['journey', 'sky'], ['journey', 'far'], ['wedding', 'mid'],
    ['wedding', 'near'], ['wedding', 'fore'], ['wedding', 'glint'], ['journey', 'mid'], ['journey', 'near'], ['journey', 'fore']];
  const layerEls = {};
  ORDER.forEach(([scene, kind]) => {
    const w = WORLD[scene];
    const l = w.layers.find(x => x.kind === kind);
    if (!l) return;
    const wrap = document.createElement('div');
    wrap.className = 'wlayer';
    Object.assign(wrap.style, { transformOrigin: `${w.vp.x}% ${w.vp.y}%`, visibility: 'hidden' });
    const image = () => {
      const img = new Image();
      img.alt = '';
      img.decoding = 'async';
      img.src = l.src;
      Object.assign(img.style, { left: l.x + '%', top: l.y + '%', width: l.w + '%', height: l.h + '%' });
      return img;
    };
    const box = cls => { const d = document.createElement('div'); d.className = cls; d.append(image()); return d; };
    if (kind === 'glint') {
      wrap.append(box('wglint wglint--a'), box('wglint wglint--b'));
    } else if (SWAY[kind]) {
      const d = box('wsway');
      const sw = SWAY[kind];
      d.style.setProperty('--sway', sw.deg + 'deg');
      d.style.setProperty('--sway-x', sw.x + 'px');
      d.style.setProperty('--sway-t', sw.t + 's');
      d.style.setProperty('--sway-d', -(scene === 'journey' ? 2.5 : 6) - sw.t / 3 + 's');
      wrap.append(d);
    } else {
      wrap.append(image());
    }
    $('#worldStage').append(wrap);
    layerEls[scene + '-' + kind] = wrap;
  });
  function pose({ camera, on, backdrop = 1, front = 1 }) {
    ORDER.forEach(([scene, kind]) => {
      const el = layerEls[scene + '-' + kind];
      if (!el) return;
      const sc = pscale(NEAR[kind], camera[scene]);
      let o = 1;
      if (scene === 'journey' && (kind === 'sky' || kind === 'far')) o = backdrop;
      if (scene === 'wedding' && kind !== 'sky' && kind !== 'far') o = front;
      const vis = on.includes(scene) && o > 0.002 && sc < 14;
      el.style.visibility = vis ? 'visible' : 'hidden';
      if (!vis) return;
      el.style.transform = `scale(${sc.toFixed(4)})`;
      el.style.opacity = o >= 0.998 ? '' : o.toFixed(3);
    });
  }
  const restWorld = scene => pose({ camera: { journey: 0, wedding: 0 }, on: scene ? [scene] : [] });
  const poseArrival = p => pose({ camera: { journey: ARRIVAL_BACK * (1 - clamp01(p)), wedding: 0 }, on: ['journey'] });
  const poseCross = q => pose({
    camera: { journey: q, wedding: (q - 1) * RIVER_LAG }, on: ['journey', 'wedding'],
    backdrop: 1 - sstep(0.12, 0.55, q), front: sstep(0.22, 0.62, q),
  });
  // runs fn(eased progress) over ms; a timer finishes it if frames stop (a background tab)
  function tween(ms, ease, fn) {
    return new Promise(res => {
      const t0 = performance.now();
      let done = false;
      const finish = () => { if (done) return; done = true; fn(1); res(); };
      const step = now => {
        if (done) return;
        const p = Math.min(1, (now - t0) / ms);
        fn(ease(p));
        if (p < 1) requestAnimationFrame(step); else finish();
      };
      requestAnimationFrame(step);
      setTimeout(finish, ms + 400);
    });
  }
  // a short burst of analog-TV static over the cut between the film and the meadow
  const burstEl = $('#burst');
  const burstCv = $('canvas', burstEl);
  const bars = Array.from({ length: 5 }, () => { const i = document.createElement('i'); burstEl.append(i); return i; });
  async function burst(ms = 560) {
    if (reduced) { await wait(150); return; }
    const ctx = burstCv.getContext('2d');
    const t0 = performance.now();
    burstEl.style.opacity = 1;
    const tick = () => {
      const k = Math.sin(Math.min(1, (performance.now() - t0) / ms) * Math.PI);
      const img = ctx.createImageData(burstCv.width, burstCv.height);
      const hot = 0.04 + 0.2 * k;
      for (let i = 0; i < img.data.length; i += 4) {
        const v = Math.random() < hot ? 255 : Math.random() * 120;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      burstCv.style.opacity = (0.15 + 0.7 * k * rand(0.5, 1)).toFixed(2);
      bars.forEach(b => {
        b.style.top = rand(0, 95) + '%';
        b.style.height = rand(1.5, 9) * (0.4 + k) + '%';
        b.style.transform = `translateX(${rand(-6, 6) * k}%)`;
        b.style.opacity = Math.random() < 0.8 ? (0.35 + 0.5 * k).toFixed(2) : 0;
      });
    };
    const iv = setInterval(tick, 33);
    await wait(ms);
    clearInterval(iv);
    burstEl.style.opacity = 0;
  }

  // 03 -> 04: the camera pushes into the screen until the film fills the view, a burst of static
  // covers the cut, and the camera travels on into the meadow (its layers come up from a little
  // way back, the nearer ones moving faster)
  async function go34(target = 4) {
    busy = true;
    const st3 = stageOf(3);
    await slideNav(target === 5 ? 2 : 1);
    reset04();
    poseArrival(0);
    folder4.style.opacity = 0;
    play($('.s03-ui', st3), [{ opacity: 1 }, { opacity: 0 }], { duration: 300 });
    await play(st3, [{ transform: 'none' }, { transform: 'scale(1.6)' }], { duration: 1300, easing: 'cubic-bezier(.45,0,.9,.6)' });
    const cover = burst(560);
    await wait(230);
    hide(3);
    resetStyles(st3, $('.s03-ui', st3));
    video3.pause();
    show(4);
    await Promise.all([
      cover,
      tween(reduced ? 200 : 2100, easeOut3, poseArrival),
      play(folder4, [{ opacity: 0 }, { opacity: 1 }], { duration: 700, delay: 1500 }),
    ]);
    restWorld('journey');
    current = 4;
    if (target === 4) await autoOpenFolder();
    busy = false;
  }

  // 04 -> 03: the camera backs out of the meadow, static covers the cut, the film pulls back
  async function go43() {
    busy = true;
    const st3 = stageOf(3);
    slideNav(0);
    if (winOpen) play(win4, [{ opacity: 1 }, { opacity: 0 }], { duration: 400 });
    play(folder4, [{ opacity: 1 }, { opacity: 0 }], { duration: 400 });
    await tween(reduced ? 200 : 1200, easeIn2, q => poseArrival(1 - q));
    const cover = burst(560);
    await wait(230);
    st3.style.transform = 'scale(1.6)';
    $('.s03-ui', st3).style.opacity = 0;
    show(3);
    video3.style.opacity = 1;  // the film may never have tuned in (a ?scene= jump)
    video3.play().catch(() => {});
    hide(4);
    reset04();
    restWorld(null);
    await Promise.all([
      cover,
      play(st3, [{ transform: 'scale(1.6)' }, { transform: 'none' }], { duration: 1600, easing: 'cubic-bezier(.2,.75,.2,1)' }),
      play($('.s03-ui', st3), [{ opacity: 0 }, { opacity: 1 }], { duration: 700, delay: 1000 }),
    ]);
    current = 3;
    busy = false;
  }

  // ================================================================ 04 · journey
  const s4 = scenes[4];
  const win4 = $('#win4');
  const folder4 = $('#folder4');
  const cursor4 = $('#cursor4');
  const chips = $('#chips');
  const panes4 = $('#panes4');
  let tab = 0;
  let winOpen = false;

  C.journeyChapters.forEach((ch, i) => {
    const b = document.createElement('button');
    b.className = 'chip';
    b.setAttribute('role', 'tab');
    b.textContent = ch.title;
    b.addEventListener('click', e => { e.stopPropagation(); if (!busy && winOpen) setTab(i + 1); });
    chips.append(b);
    const pane = document.createElement('article');
    pane.className = 'pane';
    const photos = (C.photos[String(i + 1)] || []).slice(0, 5)
      .map(p => `<img src="${site(p.src)}" alt="" loading="lazy">`).join('');
    pane.innerHTML = `<h2>${ch.title}</h2>
      ${ch.video ? `<video class="film" src="${site(ch.video)}" muted loop playsinline autoplay></video>` : '<div class="film">Film coming soon</div>'}
      ${ch.paragraphs.map(p => `<p>${p}</p>`).join('')}
      <div class="photos">${photos}</div>`;
    panes4.append(pane);
  });
  const chipEls = $$('.chip', chips);
  const paneEls = $$('.pane', panes4);

  function setTab(n) {
    tab = n;
    chipEls.forEach((c, i) => c.setAttribute('aria-selected', String(i + 1 === n)));
    paneEls.forEach((p, i) => { p.classList.toggle('is-on', i + 1 === n); if (i + 1 === n) p.scrollTop = 0; });
    const c = chipEls[n - 1];
    if (c) chips.scrollTo({ left: c.offsetLeft - chips.offsetLeft - 24, behavior: reduced ? 'auto' : 'smooth' });
  }
  function stepTab(n) {
    busy = true;
    setTab(n);
    setTimeout(() => { busy = false; }, 600);
  }

  function reset04() {
    resetStyles(subtree(s4));
    win4.classList.remove('is-open');
    folder4.classList.remove('is-selected');
    winOpen = false;
    tab = 0;
    paneEls.forEach(p => p.classList.remove('is-on'));
    chipEls.forEach(c => c.setAttribute('aria-selected', 'false'));
  }

  // the window grows out of its folder as a faint pane, settles, then its words come into focus
  const growFrom = [
    { transform: 'scale(.2)', opacity: 0, filter: 'blur(6px)' },
    { transform: 'scale(.55)', opacity: 0.75, filter: 'blur(3px)', offset: 0.35 },
    { transform: 'none', opacity: 1, filter: 'blur(0)' },
  ];
  const shrinkTo = [{ transform: 'none', opacity: 1 }, { transform: 'scale(.06)', opacity: 0 }];
  function originAt(win, folder) {
    const w = win.getBoundingClientRect();
    const f = folder.getBoundingClientRect();
    return `${((f.left + f.width / 2 - w.left) / w.width) * 100}% ${((f.top + f.height / 2 - w.top) / w.height) * 100}%`;
  }
  async function openWindow4() {
    win4.classList.add('is-open');
    win4.style.transformOrigin = originAt(win4, folder4);
    setTimeout(() => folder4.classList.remove('is-selected'), 200);
    await play(win4, growFrom, { duration: 800, easing: 'cubic-bezier(.25,.8,.25,1)' });
    settleGlass(win4);
    winOpen = true;
    await wait(150);
    setTab(1);
    await wait(450);
  }
  async function closeWindow4() {
    busy = true;
    win4.style.transformOrigin = originAt(win4, folder4);
    await play(win4, shrinkTo, { duration: 520, easing: 'cubic-bezier(.5,0,.75,0)' });
    win4.classList.remove('is-open');
    resetStyles(win4);
    winOpen = false;
    busy = false;
  }

  // the pointer glides in, lands on the folder and double-clicks it
  async function autoOpenFolder() {
    if (reduced) return openWindow4();
    await play(cursor4, [
      { opacity: 0, transform: 'translate(320%, 380%)' },
      { opacity: 1, transform: 'translate(120%, 110%)', offset: 0.45 },
      { opacity: 1, transform: 'none' },
    ], { duration: 1300, easing: 'cubic-bezier(.45,0,.2,1)' });
    await wait(300);
    const onFolder = 'translate(-58%, -16%)';
    await play(cursor4, [{ transform: 'none' }, { transform: onFolder }], { duration: 360, easing: 'ease-in-out' });
    for (let i = 0; i < 2; i++) {
      folder4.classList.add('is-selected');
      await play(cursor4, [{ transform: onFolder }, { transform: `${onFolder} scale(.84)` }, { transform: onFolder }], { duration: 150 });
      await wait(60);
    }
    play(cursor4, [{ opacity: 1 }, { opacity: 0 }], { duration: 500, delay: 150 });
    await openWindow4();
  }

  $('[data-close]', win4).addEventListener('click', e => { e.stopPropagation(); if (!busy && winOpen) closeWindow4(); });
  folder4.addEventListener('click', async () => {
    if (busy || winOpen || current !== 4) return;
    busy = true;
    folder4.classList.add('is-selected');
    await wait(160);
    await openWindow4();
    busy = false;
  });

  // ================================================================ 05 · wedding
  const s5 = scenes[5];

  async function cursorTo5() {
    if (reduced) { c5.style.opacity = 1; return; }
    await play(c5, [
      { opacity: 0, transform: 'translate(300%, 360%)' },
      { opacity: 1, transform: 'translate(110%, 120%)', offset: 0.45 },
      { opacity: 1, transform: 'none' },
    ], { duration: 1300, easing: 'cubic-bezier(.45,0,.2,1)' });
  }

  // 04 -> 05: the camera travels on through the meadow. Its plants rush past the lens, its ground
  // slides away underneath, and the river's valley, water and banks come up behind them; the
  // meadow's sky and hills give way to the river's while the plants are passing. The header
  // stays where it is.
  async function go45() {
    busy = true;
    await slideNav(2);
    resetStyles(subtree(s5));
    folder5.style.opacity = 0;
    poseCross(0);
    if (winOpen) {
      win4.style.transformOrigin = '50% 50%';
      play(win4, [{ transform: 'none', opacity: 1 }, { transform: 'scale(.95)', opacity: 0 }], { duration: 600, easing: 'ease-in' });
    }
    play(folder4, [{ opacity: 1 }, { opacity: 0 }], { duration: 450 });
    let river = false;
    await tween(reduced ? 300 : 3800, easeInOut2, q => {
      poseCross(q);
      if (!river && q > 0.84) {
        river = true;
        show(5);
        play(folder5, [{ opacity: 0 }, { opacity: 1 }], { duration: 800 });
      }
    });
    show(5);
    hide(4);
    restWorld('wedding');
    current = 5;
    await wait(reduced ? 0 : 900);
    await cursorTo5();
    busy = false;
  }

  // 05 -> 04: back the way we came
  async function go54() {
    busy = true;
    slideNav(1);
    if (win5Open) play(win5, [{ opacity: 1 }, { opacity: 0 }], { duration: 400 });
    play(folder5, [{ opacity: 1 }, { opacity: 0 }], { duration: 400 });
    play(c5, [{ opacity: 1 }, { opacity: 0 }], { duration: 300 });
    folder4.style.opacity = 0;
    if (winOpen) win4.style.opacity = 0;
    show(4);
    poseCross(1);
    let meadow = false;
    await tween(reduced ? 300 : 3400, easeInOut2, q => {
      poseCross(1 - q);
      if (!meadow && q > 0.55) {
        meadow = true;
        hide(5);
        play(folder4, [{ opacity: 0 }, { opacity: 1 }], { duration: 700 });
        if (winOpen) {
          play(win4, [{ transform: 'scale(.95)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 900, easing: 'cubic-bezier(.2,.8,.2,1)' })
            .then(() => settleGlass(win4));
        }
      }
    });
    restWorld('journey');
    win5.classList.remove('is-open');
    resetStyles(win5, c5, folder5);
    win5Open = false;
    current = 4;
    await wait(reduced ? 0 : 400);
    busy = false;
  }

  // --- the wedding sheet: the site's own content
  const win5 = $('#win5');
  const folder5 = $('#folder5');
  const tabs5 = $('#tabs5');
  const panes5 = $('#panes5');
  let win5Open = false;
  const icon = d => `<svg viewBox="0 0 16 16" aria-hidden="true">${d}</svg>`;
  const TABS5 = [
    ['DETAILS', icon('<path d="M8 14s4.5-4.2 4.5-7.5a4.5 4.5 0 0 0-9 0C3.5 9.8 8 14 8 14z"/><circle cx="8" cy="6.5" r="1.6"/>')],
    ['TIMELINE', icon('<rect x="2.5" y="3.5" width="11" height="10" rx="1.5"/><path d="M2.5 7h11M5.5 2v3M10.5 2v3"/>')],
    ['MOTIF', icon('<path d="M6 2.5 3 4.5l1.3 2.3L5.5 6v7.5h5V6l1.2.8L13 4.5l-3-2a2 2 0 0 1-4 0z"/>')],
    ['ENTOURAGE', icon('<circle cx="6" cy="5.5" r="2"/><circle cx="11.5" cy="6.5" r="1.6"/><path d="M2.5 13c0-2.2 1.6-3.8 3.5-3.8s3.5 1.6 3.5 3.8M10 9.6c1.6 0 3 1.2 3 3.2"/>')],
    ['FAQ', icon('<circle cx="8" cy="8" r="5.5"/><path d="M6.3 6.4a1.8 1.8 0 1 1 2.4 1.7c-.5.2-.7.6-.7 1.1M8 11.2v.1"/>')],
  ];
  const sc = C.siteConfig;
  const content5 = [
    `<div class="pane--center">
      <div class="big-date">${sc.weddingDateDisplay.toUpperCase()}</div>
      <div class="count" id="count"></div>
      <a class="map" href="https://www.google.com/maps/search/?api=1&query=${sc.venueCoordinates.lat},${sc.venueCoordinates.lng}" target="_blank" rel="noopener">MAP · TAP TO OPEN</a>
      <div class="addr">${C.venueAddressLines.join('<br>')}</div>
      <a class="btn" href="https://www.google.com/maps/dir/?api=1&destination=Jpark+Island+Resort+and+Waterpark+Mactan+Cebu" target="_blank" rel="noopener">GET DIRECTIONS →</a>
    </div>`,
    `<p>${C.timelineIntroLines.join('<br>')}</p>
     <ul class="tl">${C.daySchedule.map(s => `<li><time>${s.time}</time><span>${s.label}</span></li>`).join('')}</ul>`,
    C.motifGroups.map(g => `<div class="motif"><h3>${g.name}</h3><p>${g.note || ''}</p>
      <div class="swatches">${g.swatches.map(s => `<i style="background:${s.hex}" title="${s.name}"></i>`).join('')}</div></div>`).join(''),
    C.entourageGroups.map(g => `<div class="ent"><h3>${g.role}</h3>${g.names.map(n => `<p>${n}</p>`).join('')}</div>`).join(''),
    C.faqEntries.map(f => `<details><summary>${f.question}</summary><p>${f.isDesignCredit
      ? `The invitation and this site were designed by <a href="${sc.chaodesignUrl}" target="_blank" rel="noopener">chaodesign</a>.`
      : f.answer}</p></details>`).join(''),
  ];
  TABS5.forEach(([label, svg], i) => {
    const b = document.createElement('button');
    b.className = 'itab';
    b.setAttribute('role', 'tab');
    b.innerHTML = svg + label;
    b.addEventListener('click', e => { e.stopPropagation(); setTab5(i); });
    tabs5.append(b);
    const p = document.createElement('article');
    p.className = 'pane';
    p.innerHTML = content5[i];
    panes5.append(p);
  });
  const tab5Els = $$('.itab', tabs5);
  const pane5Els = $$('.pane', panes5);
  function setTab5(i) {
    tab5Els.forEach((t, j) => t.setAttribute('aria-selected', String(i === j)));
    pane5Els.forEach((p, j) => p.classList.toggle('is-on', i === j));
  }
  setTab5(0);
  function countdown() {
    const ms = new Date(sc.weddingDateTime) - Date.now();
    const d = Math.max(0, ms);
    const days = Math.floor(d / 864e5);
    const parts = [['MONTHS', Math.floor(days / 30.44)], ['DAYS', Math.floor(days % 30.44)],
      ['HOURS', Math.floor(d / 36e5) % 24], ['MINS', Math.floor(d / 6e4) % 60]];
    $('#count').innerHTML = parts.map(([l, v]) => `<div><b>${String(v).padStart(2, '0')}</b><span>${l}</span></div>`).join('');
  }
  countdown();
  setInterval(countdown, 30000);

  folder5.addEventListener('click', async () => {
    if (busy || current !== 5 || win5Open) return;
    busy = true;
    folder5.classList.add('is-selected');
    play(c5, [{ opacity: 1 }, { opacity: 0 }], { duration: 300 });
    await wait(160);
    win5.classList.add('is-open');
    win5.style.transformOrigin = originAt(win5, folder5);
    setTimeout(() => folder5.classList.remove('is-selected'), 200);
    await play(win5, growFrom, { duration: 800, easing: 'cubic-bezier(.25,.8,.25,1)' });
    settleGlass(win5);
    win5Open = true;
    busy = false;
  });
  $('[data-close]', win5).addEventListener('click', async e => {
    e.stopPropagation();
    if (busy || !win5Open) return;
    busy = true;
    win5.style.transformOrigin = originAt(win5, folder5);
    await play(win5, shrinkTo, { duration: 520, easing: 'cubic-bezier(.5,0,.75,0)' });
    win5.classList.remove('is-open');
    resetStyles(win5);
    win5Open = false;
    busy = false;
  });

  // ================================================================ navigation
  function onStep(dir) {
    if (busy) return;
    if (current === 3 && dir > 0) go34();
    else if (current === 4) {
      if (dir > 0) winOpen && tab < 5 ? stepTab(tab + 1) : go45();
      else winOpen && tab > 1 ? stepTab(tab - 1) : go43();
    } else if (current === 5 && dir < 0 && !win5Open) go54();  // with the sheet open, back is the nav or the close dot
  }
  async function goTo(n) {
    if (busy || n === current || current < 3) return;
    if (current === 3) { await go34(n); if (n === 5) await go45(); }
    else if (current === 4) await (n === 5 ? go45() : go43());
    else if (current === 5) { await go54(); if (n === 3) await go43(); }
  }
  $$('[data-go]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); goTo(+b.dataset.go); }));
  $$('[data-rsvp]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); toast('RSVP opens the real form on the site'); }));

  let toastTimer = 0;
  function toast(msg) {
    const t = $('.toast');
    t.textContent = msg;
    t.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('is-on'), 2200);
  }

  // a card that can still scroll in this direction keeps the gesture
  const openPane = () => {
    if (current === 4 && winOpen) return paneEls[tab - 1];
    if (current === 5 && win5Open) return pane5Els.find(p => p.classList.contains('is-on'));
    return null;
  };
  const canScroll = (el, dir) => !!el && el.scrollHeight > el.clientHeight + 1 &&
    (dir > 0 ? el.scrollTop + el.clientHeight < el.scrollHeight - 4 : el.scrollTop > 0);  // 4px: phones round fractional heights

  // touch: one swipe = one step
  let touch = null;
  addEventListener('touchstart', e => {
    const pane = e.target.closest && e.target.closest('.pane');
    touch = { y: e.touches[0].clientY, x: e.touches[0].clientX, pane,
      up: canScroll(pane, 1), down: canScroll(pane, -1), chips: !!(e.target.closest && e.target.closest('.chips, .icontabs')) };
  }, { passive: true });
  // Decided on the move, not on the lift: on a phone the browser takes over a swipe that starts on a
  // scrolling card (it may cancel the touch, and then there is no touchend at all).
  function swipeDone(y, x) {
    const t = touch;
    if (!t || t.done) return;
    const dy = t.y - y;
    const dx = t.x - x;
    if (t.chips || Math.abs(dy) < 45 || Math.abs(dx) > Math.abs(dy)) return;
    t.done = true;
    const dir = Math.sign(dy);
    if (t.pane && (dir > 0 ? t.up : t.down)) return;  // the card scrolled instead
    onStep(dir);
  }
  addEventListener('touchmove', e => swipeDone(e.touches[0].clientY, e.touches[0].clientX), { passive: true });
  addEventListener('touchend', e => { swipeDone(e.changedTouches[0].clientY, e.changedTouches[0].clientX); touch = null; }, { passive: true });
  addEventListener('touchcancel', () => { touch = null; }, { passive: true });

  // wheel (testing on a PC): one step per gesture, trackpad inertia swallowed
  let acc = 0;
  let lastWheel = 0;
  let gated = false;
  addEventListener('wheel', e => {
    const pane = e.target.closest && e.target.closest('.pane');
    if (pane && canScroll(pane, Math.sign(e.deltaY))) return;  // let the card scroll
    e.preventDefault();
    const now = performance.now();
    const gap = now - lastWheel;
    lastWheel = now;
    if (gated) { if (gap < 220) return; gated = false; }
    if (busy || current < 3) { acc = 0; return; }
    acc += e.deltaY;
    if (Math.abs(acc) > 40) {
      const dir = Math.sign(acc);
      acc = 0;
      gated = true;
      onStep(dir);
    }
  }, { passive: false });

  addEventListener('keydown', e => {
    if (e.target === pw) return;
    if (['ArrowDown', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); if (!canScroll(openPane(), 1)) onStep(1); }
    if (['ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); if (!canScroll(openPane(), -1)) onStep(-1); }
  });

  // ================================================================ dev shortcut: ?scene=N
  const jump = +new URLSearchParams(location.search).get('scene');
  if (jump >= 2 && jump <= 5) {
    hide(1);
    if (jump === 2) { reset02(); show(2); current = 2; run02(); }
    if (jump === 3) { busy = true; show(3); surface03(200); }
    if (jump === 4) { chrome(true); slideNav(1); restWorld('journey'); show(4); current = 4; busy = true; autoOpenFolder().then(() => { busy = false; }); }
    if (jump === 5) { chrome(true); slideNav(2); restWorld('wedding'); show(5); current = 5; cursorTo5(); }
  }
})();
