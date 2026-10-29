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
 * it reaches its end.
 *
 * Two homes: here, as the prototype (assets/content.js holds all the words, any password
 * works), and on the site at /m/ (copied by scripts/design/publish-phone.ts), where the page
 * only carries the public words and the rest comes from /api/phone-content once the real
 * password check (/api/gate) has passed.
 */
(() => {
  const M = window.MANIFEST;
  const LIVE = !window.CONTENT;
  const C = window.CONTENT || window.PUBLIC_CONTENT;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const rand = (a, b) => a + Math.random() * (b - a);
  // "Reduce motion" on: the calm version rather than a frozen one. The camera stays put and the
  // scenes dissolve through the mist and light (no zooms, flights or screen tearing), the scenery
  // moves at half speed; cards, the cursor, tabs and typing play as usual. As the site's calmMotion().
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ZOOM = calm ? 'none' : 'scale(1.6)';
  const phone = $('#phone');
  const site = p => (LIVE ? p : 'site' + p);  // the prototype's server maps /site/ to public/

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
    const d = opts.duration || 600;
    const a = el.animate(frames, { easing: 'ease', fill: 'both', ...opts, duration: d, delay: opts.delay || 0 });
    // a background tab can freeze animation frames; never let a move hang
    const guard = wait(d + (opts.delay || 0) + 400);
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
      isMuted: () => muted,
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

  // ---------------------------------------------------------------- the terminal's key clicks
  // The terminal's sounds, as the site's lib/audio/typing.ts: the recorded ones (siteConfig.
  // terminalSounds) loop while something happens (keys while a line types, progress while the
  // bar fills, glitch while the screen tears); with no keys recording, each character gets a few
  // milliseconds of filtered noise. The audio context is made inside the Enter tap; the music
  // button's mute silences it too.
  const Typing = (() => {
    let ctx = null;
    let noise = null;
    const samples = {};
    const voices = {};
    return {
      unlock() {
        try { ctx = ctx || new AudioContext(); ctx.resume(); } catch (e) { ctx = null; return; }
        Object.entries((C.siteConfig && C.siteConfig.terminalSounds) || {}).forEach(([name, url]) => {
          if (!url || samples[name]) return;
          fetch(site(url)).then(r => r.arrayBuffer()).then(b => ctx.decodeAudioData(b))
            .then(buf => { samples[name] = buf; }).catch(() => {});
        });
      },
      start(name) {
        if (!ctx || ctx.state !== 'running' || Music.isMuted() || !samples[name] || voices[name]) return;
        const src = ctx.createBufferSource();
        src.buffer = samples[name];
        src.loop = true;
        const g = ctx.createGain();
        g.gain.value = 0.5;
        src.connect(g).connect(ctx.destination);
        src.start();
        voices[name] = { src, g };
      },
      stop(name) {
        const v = voices[name];
        if (!ctx || !v) return;
        delete voices[name];
        const t = ctx.currentTime;
        v.g.gain.setValueAtTime(v.g.gain.value, t);
        v.g.gain.linearRampToValueAtTime(0, t + 0.12);
        v.src.stop(t + 0.14);
      },
      // a sharp tick over a short low thock, as the site's lib/audio/typing.ts (peaks near -10 dBFS)
      tick(ch) {
        if (!ctx || ctx.state !== 'running' || Music.isMuted() || samples.keys) return;
        const space = ch === ' ';
        const vary = 0.85 + Math.random() * 0.3;
        const LEVEL = 0.5;
        if (!noise) {
          noise = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.04), ctx.sampleRate);
          const d = noise.getChannelData(0);
          for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        }
        const t = ctx.currentTime + 0.001;
        const src = ctx.createBufferSource();
        src.buffer = noise;
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = (space ? 900 : 1700) * vary;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime((space ? 0.35 : 0.5) * LEVEL * vary, t + 0.0008);
        g.gain.exponentialRampToValueAtTime(0.0005, t + (space ? 0.03 : 0.016));
        src.connect(hp).connect(g).connect(ctx.destination);
        src.start(t);
        src.stop(t + 0.04);
        const o = ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.setValueAtTime((space ? 120 : 200) * vary, t);
        o.frequency.exponentialRampToValueAtTime((space ? 80 : 140) * vary, t + 0.04);
        const og = ctx.createGain();
        og.gain.setValueAtTime(0, t);
        og.gain.linearRampToValueAtTime((space ? 0.4 : 0.28) * LEVEL, t + 0.002);
        og.gain.exponentialRampToValueAtTime(0.0005, t + (space ? 0.06 : 0.04));
        o.connect(og).connect(ctx.destination);
        o.start(t);
        o.stop(t + 0.07);
      },
    };
  })();

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
    Typing.unlock();
    if (!pw.value.trim()) {
      Music.stop();
      pill.classList.remove('is-wrong');
      void pill.offsetWidth;
      pill.classList.add('is-wrong');
      err.textContent = 'Type the password from your invitation';
      return;
    }
    pw.blur();
    if (!LIVE) { loadContent(); go12(); return; }
    busy = true;
    fetch('/api/gate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw.value }) })
      .then(async r => {
        if (!r.ok) throw new Error('wrong');
        // signed in on the way to another page (the RSVP form): go there
        const next = new URLSearchParams(location.search).get('next');
        if (next && next.startsWith('/') && !next.startsWith('//') && next !== '/story') { location.href = next; return; }
        if (!(await loadContent())) throw new Error('content');
        busy = false;
        go12();
      })
      .catch(() => {
        busy = false;
        Music.stop();
        pw.value = '';
        go.hidden = true;
        pill.classList.remove('is-wrong');
        void pill.offsetWidth;
        pill.classList.add('is-wrong');
        err.textContent = "That password didn't work. Try again?";
      });
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
    const D = calm ? 400 : 3200;
    const lin = { duration: D, easing: 'linear' };
    play($('.s01-form', st1), [{ opacity: 1 }, { opacity: 0 }], { duration: 300 });
    if (!calm) {
      play($('.s01-bg', st1), dof, lin);
      play($('.monitor__dark', st1), [{ opacity: 0 }, { opacity: 0, offset: 0.22 }, { opacity: 1, offset: 0.36 }, { opacity: 1 }], lin);
    }
    reset02();
    scenes[2].style.background = 'transparent';
    show(2);
    const zoom = calm ? Promise.resolve() : play(st1, f1, lin);
    if (!calm) play(st2, f2, lin);
    play(scenes[2], [{ opacity: 0 }, { opacity: 0, offset: 0.34 }, { opacity: 1, offset: 0.4 }, { opacity: 1 }], lin);
    play($('.full', st2), [{ opacity: 0 }, { opacity: 0, offset: 0.78 }, { opacity: 1 }], lin);
    setTimeout(() => { current = 2; run02(500); }, D * 0.9);
    await zoom;
    await wait(calm ? 400 : 0);
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
    Typing.start('keys');
    for (const ch of text) {
      tn.data += ch;
      Typing.tick(ch);
      await wait(speed * rand(0.55, 1.45) + (ch === ' ' ? 18 : 0));
    }
    Typing.stop('keys');
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
    const prog = $('.t-progress', s2);
    await play(prog, [{ opacity: 0 }, { opacity: 1 }], { duration: 220 });
    prog.classList.add('is-loading');
    Typing.start('progress');
    await loadBar(2800);
    Typing.stop('progress');
    prog.classList.remove('is-loading');
    await wait(350);
    // the bar gives way to the login line in the same place
    await play(prog, [{ opacity: 1 }, { opacity: 0 }], { duration: 220 });
    await play($('.t-login', s2), [{ opacity: 0 }, { opacity: 1 }, { opacity: 0.15 }, { opacity: 1 }], { duration: 420, easing: 'linear' });
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
    await wait(calm ? 200 : dur);
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
    Typing.start('glitch');
    const cv = await glitch02(2900, 0.15, 0.85);
    Typing.stop('glitch');
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
  function domPose({ camera, on, backdrop = 1, front = 1, meadow = 1 }) {
    ORDER.forEach(([scene, kind]) => {
      const el = layerEls[scene + '-' + kind];
      if (!el) return;
      const sc = pscale(NEAR[kind], camera[scene]);
      let o = 1;
      if (scene === 'journey' && (kind === 'sky' || kind === 'far')) o = backdrop;
      if (scene === 'wedding' && kind !== 'sky' && kind !== 'far') o = front;
      if (scene === 'journey' && kind !== 'sky' && kind !== 'far') o = meadow;
      const vis = on.includes(scene) && o > 0.002 && sc < 14;
      el.style.visibility = vis ? 'visible' : 'hidden';
      if (!vis) return;
      el.style.transform = `scale(${sc.toFixed(4)})`;
      el.style.opacity = o >= 0.998 ? '' : o.toFixed(3);
    });
  }
  // Drawn with WebGL where it can be (assets/world-gl.js, the site's lib/world-gl): wind in the
  // plants, the river moving, mist the camera travels through, light for the cut from the film.
  // The DOM layers above stay as the fallback and show until the GPU has the pictures.
  const G = window.WorldGL;
  let gl = null;
  let lastPose = { camera: { journey: 0, wedding: 0 }, on: [] };
  const toGL = p => ({ ...p, show: p.on });
  function pose(p) {
    if (calm) p = { ...p, camera: { journey: 0, wedding: 0 }, mistLag: 0 };
    lastPose = p;
    if (gl) gl.pose(toGL(p)); else domPose(p);
  }
  if (G) {
    const canvas = document.createElement('canvas');
    canvas.className = 'world-gl';
    canvas.style.visibility = 'hidden';
    $('.world').append(canvas);
    const stageEl = $('#worldStage');
    const nearJ = WORLD.journey.layers.find(l => l.kind === 'near');
    // the phone's stage is a crop of the painting: its real width is the near layer's (no padding)
    const paint = nearJ ? { x: nearJ.x, y: 0, w: nearJ.w, h: 100 } : undefined;
    const r = G.createWorldGL(canvas, {
      scenes: {
        journey: { vp: WORLD.journey.vp, layers: WORLD.journey.layers, paint, water: 'assets/world/j_water-v4.png' },
        wedding: { vp: WORLD.wedding.vp, layers: WORLD.wedding.layers, paint, water: 'assets/world/w_water-v4.png' },
      },
      stageRect: () => {
        const s = stageEl.getBoundingClientRect();
        const c = canvas.getBoundingClientRect();
        return { left: s.left - c.left, top: s.top - c.top, width: s.width, height: s.height };
      },
      maxDpr: 1.25,
      lite: true,
      calm,
      onLost: () => { gl = null; canvas.style.visibility = 'hidden'; domPose(lastPose); },
    });
    if (r) {
      r.ready.then(ok => {
        if (!ok) { r.destroy(); return; }
        gl = r;
        r.pose(toGL(lastPose));
        canvas.style.visibility = 'visible';
        domPose({ ...lastPose, on: [] });
      });
    }
  }
  const restWorld = scene => pose({ camera: { journey: 0, wedding: 0 }, on: scene ? [scene] : [] });
  // arriving from the film: the camera eases in (p) while the light fades and the mist clears on time (t)
  const poseArrival = (p, t = p) => pose({
    camera: G ? G.arrivalCamera(p) : { journey: ARRIVAL_BACK * (1 - clamp01(p)), wedding: 0 }, on: ['journey'],
    fog: G ? G.arrivalFog(t) : 0, light: G ? G.arrivalLight(t) : 0, mistLag: G ? G.MIST_TRAVEL * (1 - p) : 0,
  });
  const poseCross = q => pose({
    camera: { journey: q, wedding: (q - 1) * RIVER_LAG }, on: ['journey', 'wedding'],
    backdrop: 1 - sstep(0.12, 0.55, q), front: sstep(0.22, 0.62, q),
    meadow: G ? G.crossingMeadow(q) : 1 - sstep(0.5, 0.88, q),
    fog: G ? G.crossingFog(q) : 0, light: G ? 0.1 * G.crossingFog(q) : 0,
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

  // 03 -> 04: the camera pushes into the film until it flares to white (no static: there is
  // no monitor on the phone), and the meadow comes up out of the light: the camera drifts
  // forward through mist that streams past and clears.
  const veil = $('#veil');
  async function go34(target = 4) {
    busy = true;
    const st3 = stageOf(3);
    await slideNav(target === 5 ? 2 : 1);
    reset04();
    poseArrival(0, 0);
    folder4.style.opacity = 0;
    play($('.s03-ui', st3), [{ opacity: 1 }, { opacity: 0 }], { duration: 300 });
    await Promise.all([
      play(st3, [{ transform: 'none' }, { transform: ZOOM }], { duration: 1300, easing: 'cubic-bezier(.45,0,.9,.6)' }),
      play(veil, [{ opacity: 0 }, { opacity: 1 }], { duration: 600, delay: 750, easing: 'ease-in' }),
    ]);
    show(4);
    hide(3);
    resetStyles(st3, $('.s03-ui', st3));
    video3.pause();
    await Promise.all([
      play(veil, [{ opacity: 1 }, { opacity: 0 }], { duration: 800, easing: 'ease-out' }),
      tween(3200, p => p, t => poseArrival(easeOut3(t), t)),
      play(folder4, [{ opacity: 0 }, { opacity: 1 }], { duration: 800, delay: 2000 }),
    ]);
    restWorld('journey');
    current = 4;
    if (target === 4) await autoOpenFolder();
    busy = false;
  }

  // 04 -> 03: the camera backs out of the meadow into the mist and the light, and the film
  // pulls back from it (no static)
  async function go43() {
    busy = true;
    const st3 = stageOf(3);
    slideNav(0);
    if (winOpen) play(win4, [{ opacity: 1 }, { opacity: 0 }], { duration: 400 });
    play(folder4, [{ opacity: 1 }, { opacity: 0 }], { duration: 400 });
    await Promise.all([
      tween(1600, p => p, s => { const t = 1 - s; poseArrival(t * t, t); }),
      play(veil, [{ opacity: 0 }, { opacity: 1 }], { duration: 600, delay: 1000, easing: 'ease-in' }),
    ]);
    st3.style.transform = ZOOM;
    $('.s03-ui', st3).style.opacity = 0;
    show(3);
    video3.style.opacity = 1;  // the film may never have tuned in (a ?scene= jump)
    video3.play().catch(() => {});
    hide(4);
    reset04();
    restWorld(null);
    await Promise.all([
      play(veil, [{ opacity: 1 }, { opacity: 0 }], { duration: 800, easing: 'ease-out' }),
      play(st3, [{ transform: ZOOM }, { transform: 'none' }], { duration: 1600, easing: 'cubic-bezier(.2,.75,.2,1)' }),
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

  let chipEls = [];
  let paneEls = [];
  function buildJourney() {
  C.journeyChapters.forEach((ch, i) => {
    const b = document.createElement('button');
    b.className = 'chip';
    b.setAttribute('role', 'tab');
    b.textContent = ch.title;
    b.addEventListener('click', e => { e.stopPropagation(); if (!busy && winOpen) setTab(i + 1); });
    chips.append(b);
    const pane = document.createElement('article');
    pane.className = 'pane';
    // the chapter's files in order: its film, then its photos in justified rows (each photo
    // keeps its shape; see lib/journey/gallery.ts), then the words
    const media = C.journeyMedia[i] || { film: null, photos: [] };
    const photos = media.photos.map(p => {
      const ar = p.px[0] / p.px[1];
      return `<img src="${site(p.src)}" alt="" loading="lazy" style="flex:${ar} 1 ${(ar * 26).toFixed(2)}cqw;aspect-ratio:${ar}">`;
    }).join('');
    const film = media.film
      ? `<video class="film" src="${site(media.film.src)}" muted loop playsinline preload="metadata" style="aspect-ratio:${media.film.px[0]} / ${media.film.px[1]}"></video>`
      : '';
    pane.innerHTML = `<h2>${ch.title}</h2>
      ${film}
      <div class="photos">${photos}</div>
      ${ch.paragraphs.map(p => `<p>${p}</p>`).join('')}`;
    panes4.append(pane);
  });
  chipEls = $$('.chip', chips);
  paneEls = $$('.pane', panes4);
  }

  function setTab(n) {
    tab = n;
    chipEls.forEach((c, i) => c.setAttribute('aria-selected', String(i + 1 === n)));
    paneEls.forEach((p, i) => {
      const on = i + 1 === n;
      p.classList.toggle('is-on', on);
      if (on) p.scrollTop = 0;
      // only the open chapter's film plays
      const film = p.querySelector('video');
      if (film) { if (on) film.play().catch(() => {}); else film.pause(); }
    });
    const c = chipEls[n - 1];
    if (c) chips.scrollTo({ left: c.offsetLeft - chips.offsetLeft - 24, behavior: 'smooth' });
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
    // no fade here: a pane fading out stays visible (its transition holds visibility) even
    // inside the hidden scene, and would show over the film
    paneEls.forEach(p => {
      p.style.transition = 'none';
      p.classList.remove('is-on');
      void p.offsetWidth;
      p.style.removeProperty('transition');
    });
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
    await play(c5, [
      { opacity: 0, transform: 'translate(300%, 360%)' },
      { opacity: 1, transform: 'translate(110%, 120%)', offset: 0.45 },
      { opacity: 1, transform: 'none' },
    ], { duration: 1300, easing: 'cubic-bezier(.45,0,.2,1)' });
  }
  // the cursor finds the folder and opens it, as on the journey
  async function autoOpen5() {
    await cursorTo5();
    await wait(350);
    busy = false;
    if (current === 5 && !win5Open) folder5.click();
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
    await tween(3800, easeInOut2, q => {
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
    await wait(900);
    await autoOpen5();
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
    await tween(3400, easeInOut2, q => {
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
    await wait(400);
    if (!winOpen) await autoOpenFolder();
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
    ['NOTE', icon('<rect x="2.5" y="3.5" width="11" height="9" rx="1.5"/><path d="m3 4.5 5 4 5-4"/>')],
  ];
  let tab5Els = [];
  let pane5Els = [];
  function buildWedding() {
  const sc = C.siteConfig;
  const content5 = [
    `<div class="pane--center">
      <div class="big-date">${sc.weddingDateDisplay.toUpperCase()}</div>
      <div class="count" id="count"></div>
      <a class="map" href="https://www.google.com/maps/search/?api=1&query=${sc.venueCoordinates.lat},${sc.venueCoordinates.lng}" target="_blank" rel="noopener">MAP · TAP TO OPEN</a>
      <div class="addr">${C.venueAddressLines.join('<br>')}</div>
      <a class="btn" href="https://www.google.com/maps/dir/?api=1&destination=${sc.venueCoordinates.lat},${sc.venueCoordinates.lng}" target="_blank" rel="noopener">GET DIRECTIONS →</a>
    </div>`,
    `<p>${C.timelineIntroLines.join('<br>')}</p>
     <ul class="tl">${C.daySchedule.map(s => `<li><time>${s.time}</time><span>${s.label}</span></li>`).join('')}</ul>`,
    `${C.sponsorGroups.map(g => `<div class="motif"><h3>${g.title}</h3>
      <div class="swatches">${g.fabrics.map(f => `<img src="${site(f.src)}" alt="${f.name}" title="${f.name}">`).join('')}</div>
      ${g.attire.map(a => `<p><b>${a.who}:</b> ${a.note}</p>`).join('')}</div>`).join('')}
      <div class="motif"><h3>${C.guestMotif.title}</h3>
      <div class="figures">${C.guestMotif.figures.map(f => `<img src="${site(f.src)}" alt="${f.alt}" loading="lazy">`).join('')}</div>
      <div class="swatches">${C.guestMotif.fabrics.map(f => `<img src="${site(f.src)}" alt="${f.name}" title="${f.name}">`).join('')}</div>
      <p><b>${C.guestMotif.note}</b></p><p>${C.guestMotif.request}</p></div>`,
    C.entourageGroups.map(g => `<div class="ent"><h3>${g.role}</h3>${g.names.map(n => `<p>${n}</p>`).join('')}</div>`).join(''),
    C.faqEntries.map((f, i) => `<details${i ? '' : ' open'}><summary>${String(i + 1).padStart(2, '0')}. ${f.question}</summary>${f.answer
      .map(p => `<p>${p.replace(/\n/g, '<br>').split(C.chaodesignHandle)
        .join(`<a href="${sc.chaodesignUrl}" target="_blank" rel="noopener">${C.chaodesignHandle}</a>`)}</p>`).join('')}</details>`).join(''),
    `<div class="note"><h3>${C.finalNote.title}</h3>${C.finalNote.paragraphs.map(p => `<p>${p}</p>`).join('')}
      <p><b>${C.finalNote.thanks}</b></p><p>${C.finalNote.closing}</p>
      <p>${C.finalNote.signOff}<br><b>${C.finalNote.signature}</b></p></div>`,
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
  tab5Els = $$('.itab', tabs5);
  pane5Els = $$('.pane', panes5);
  setTab5(0);
  countdown();
  setInterval(countdown, 30000);
  }
  function setTab5(i) {
    tab5Els.forEach((t, j) => t.setAttribute('aria-selected', String(i === j)));
    pane5Els.forEach((p, j) => p.classList.toggle('is-on', i === j));
  }
  function countdown() {
    const ms = new Date(C.siteConfig.weddingDateTime) - Date.now();
    const d = Math.max(0, ms);
    const days = Math.floor(d / 864e5);
    const parts = [['MONTHS', Math.floor(days / 30.44)], ['DAYS', Math.floor(days % 30.44)],
      ['HOURS', Math.floor(d / 36e5) % 24], ['MINS', Math.floor(d / 6e4) % 60]];
    $('#count').innerHTML = parts.map(([l, v]) => `<div><b>${String(v).padStart(2, '0')}</b><span>${l}</span></div>`).join('');
  }

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

  // ================================================================ the words behind the password
  let contentReady = false;
  async function loadContent() {
    if (contentReady) return true;
    if (LIVE) {
      const r = await fetch('/api/phone-content', { credentials: 'same-origin', cache: 'no-store' }).catch(() => null);
      if (!r || !r.ok) return false;
      Object.assign(C, await r.json());
    }
    buildJourney();
    buildWedding();
    contentReady = true;
    return true;
  }

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
    if (current === 3) await (n === 5 ? go35() : go34());
    else if (current === 4) await (n === 5 ? go45() : go43());
    else if (current === 5) await (n === 3 ? go53() : go54());
  }

  // The intro and the wedding straight to each other (a nav tap): one camera move from just
  // through the film all the way to the river, u = time 0..1. The meadow passes without a stop
  // (no folder, no card, Journey never highlighted). As the site's transitions.ts throughMeadow.
  const DIRECT_MS = 5200;
  const DIRECT_ARRIVAL = 0.28;
  function poseDirect(u) {
    const back = G ? G.ARRIVAL_BACK : ARRIVAL_BACK;
    const c = back + (1 - back) * easeInOut2(u);
    const q = Math.max(0, c);
    const a = Math.min(1, u / DIRECT_ARRIVAL);
    pose({
      camera: { journey: c, wedding: (q - 1) * RIVER_LAG }, on: ['journey', 'wedding'],
      backdrop: 1 - sstep(0.12, 0.55, q), front: sstep(0.22, 0.62, q),
      meadow: G ? G.crossingMeadow(q) : 1 - sstep(0.5, 0.88, q),
      fog: G ? Math.max(G.arrivalFog(a), G.crossingFog(q)) : 0,
      light: G ? Math.max(G.arrivalLight(a), 0.1 * G.crossingFog(q)) : 0,
      mistLag: G ? G.MIST_TRAVEL * (1 - a) : 0,
    });
  }

  // 03 -> 05: the film flares to light and the camera comes out into the meadow and keeps going
  async function go35() {
    busy = true;
    const st3 = stageOf(3);
    slideNav(2);
    reset04();
    resetStyles(subtree(s5));
    folder5.style.opacity = 0;
    poseDirect(0);
    play($('.s03-ui', st3), [{ opacity: 1 }, { opacity: 0 }], { duration: 300 });
    await Promise.all([
      play(st3, [{ transform: 'none' }, { transform: ZOOM }], { duration: 1300, easing: 'cubic-bezier(.45,0,.9,.6)' }),
      play(veil, [{ opacity: 0 }, { opacity: 1 }], { duration: 600, delay: 750, easing: 'ease-in' }),
    ]);
    hide(3);
    resetStyles(st3, $('.s03-ui', st3));
    video3.pause();
    let river = false;
    await Promise.all([
      play(veil, [{ opacity: 1 }, { opacity: 0 }], { duration: 800, easing: 'ease-out' }),
      tween(DIRECT_MS, p => p, u => {
        poseDirect(u);
        if (!river && u > 0.84) {
          river = true;
          show(5);
          play(folder5, [{ opacity: 0 }, { opacity: 1 }], { duration: 800 });
        }
      }),
    ]);
    show(5);
    restWorld('wedding');
    current = 5;
    await wait(700);
    await autoOpen5();
  }

  // 05 -> 03: back the same way without stopping in the meadow, into the light, and the film
  async function go53() {
    busy = true;
    const st3 = stageOf(3);
    slideNav(0);
    if (win5Open) play(win5, [{ opacity: 1 }, { opacity: 0 }], { duration: 400 });
    play(folder5, [{ opacity: 1 }, { opacity: 0 }], { duration: 400 });
    play(c5, [{ opacity: 1 }, { opacity: 0 }], { duration: 300 });
    setTimeout(() => hide(5), 500);
    await Promise.all([
      tween(DIRECT_MS, p => p, u => poseDirect(1 - u)),
      play(veil, [{ opacity: 0 }, { opacity: 1 }], { duration: 600, delay: DIRECT_MS - 450, easing: 'ease-in' }),
    ]);
    hide(5);
    win5.classList.remove('is-open');
    resetStyles(win5, c5, folder5);
    win5Open = false;
    reset04();
    st3.style.transform = ZOOM;
    $('.s03-ui', st3).style.opacity = 0;
    show(3);
    video3.style.opacity = 1;
    video3.play().catch(() => {});
    restWorld(null);
    await Promise.all([
      play(veil, [{ opacity: 1 }, { opacity: 0 }], { duration: 800, easing: 'ease-out' }),
      play(st3, [{ transform: ZOOM }, { transform: 'none' }], { duration: 1600, easing: 'cubic-bezier(.2,.75,.2,1)' }),
      play($('.s03-ui', st3), [{ opacity: 0 }, { opacity: 1 }], { duration: 700, delay: 1000 }),
    ]);
    resetStyles(st3, $('.s03-ui', st3));
    current = 3;
    busy = false;
  }
  $$('[data-go]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); goTo(+b.dataset.go); }));
  $$('[data-rsvp]').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation();
    if (LIVE) location.href = '/rsvp';
    else toast('RSVP opens the real form on the site');
  }));

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

  // a chapter's photo, big: tap a photo in the journey card; swipe sideways (or the arrows, or
  // ← →) for the chapter's other photos; tap outside or × to close. While it is open the story
  // ignores swipes, the wheel and keys.
  let lightbox = null;
  function openLightbox(srcs, index) {
    closeLightbox();
    let i = index;
    const el = document.createElement('div');
    el.className = 'lightbox';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.innerHTML = `<img alt=""><button class="lb-close" type="button" aria-label="Close photo">×</button>
      <button class="lb-prev" type="button" aria-label="Previous photo">‹</button>
      <button class="lb-next" type="button" aria-label="Next photo">›</button><p class="lb-count"></p>`;
    const img = $('img', el);
    const show = n => {
      i = (n + srcs.length) % srcs.length;
      img.src = srcs[i];
      $('.lb-count', el).textContent = `${i + 1} / ${srcs.length}`;
    };
    const many = srcs.length > 1;
    $('.lb-prev', el).hidden = !many;
    $('.lb-next', el).hidden = !many;
    $('.lb-prev', el).addEventListener('click', e => { e.stopPropagation(); show(i - 1); });
    $('.lb-next', el).addEventListener('click', e => { e.stopPropagation(); show(i + 1); });
    $('.lb-close', el).addEventListener('click', e => { e.stopPropagation(); closeLightbox(); });
    img.addEventListener('click', e => e.stopPropagation());
    el.addEventListener('click', closeLightbox);
    let sx = null;
    el.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive: true });
    el.addEventListener('touchend', e => {
      if (sx === null || !many) return;
      const dx = e.changedTouches[0].clientX - sx;
      sx = null;
      if (Math.abs(dx) > 40) show(i + (dx < 0 ? 1 : -1));
    }, { passive: true });
    const onKey = e => {
      if (e.key === 'Escape') closeLightbox();
      else if (e.key === 'ArrowRight') show(i + 1);
      else if (e.key === 'ArrowLeft') show(i - 1);
    };
    addEventListener('keydown', onKey);
    lightbox = { el, onKey };
    document.body.append(el);
    show(i);
  }
  function closeLightbox() {
    if (!lightbox) return;
    removeEventListener('keydown', lightbox.onKey);
    lightbox.el.remove();
    lightbox = null;
  }
  panes4.addEventListener('click', e => {
    const img = e.target.closest && e.target.closest('.photos img');
    if (!img) return;
    e.stopPropagation();
    const imgs = $$('img', img.parentElement);
    openLightbox(imgs.map(m => m.currentSrc || m.src), imgs.indexOf(img));
  });

  // touch: one swipe = one step
  let touch = null;
  addEventListener('touchstart', e => {
    if (lightbox) { touch = null; return; }
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
    if (lightbox) { e.preventDefault(); return; }
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
    if (e.target === pw || lightbox) return;
    if (['ArrowDown', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); if (!canScroll(openPane(), 1)) onStep(1); }
    if (['ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); if (!canScroll(openPane(), -1)) onStep(-1); }
  });

  // ================================================================ start
  // ?scene=N jumps to a screen (the site sends a signed-in phone to ?scene=3). On the site a
  // visitor who is already signed in skips the password; anyone else starts at it.
  const asked = +new URLSearchParams(location.search).get('scene');
  loadContent().then(signedIn => {
    if (!signedIn) return;
    const jump = asked >= 2 && asked <= 5 ? asked : LIVE ? 3 : 0;
    if (jump) jumpTo(jump);
  });
  function jumpTo(jump) {
    hide(1);
    if (jump === 2) { reset02(); show(2); current = 2; run02(); }
    if (jump === 3) { busy = true; show(3); surface03(200); }
    if (jump === 4) { chrome(true); slideNav(1); restWorld('journey'); show(4); current = 4; busy = true; autoOpenFolder().then(() => { busy = false; }); }
    if (jump === 5) { chrome(true); slideNav(2); restWorld('wedding'); show(5); current = 5; busy = true; autoOpen5(); }
  }
})();
