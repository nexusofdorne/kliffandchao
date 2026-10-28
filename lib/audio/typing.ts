// The terminal's key clicks, made with the Web Audio API so there is no sound file to load:
// a sharp tick (a few milliseconds of high-passed noise) over a short low "thock" (a falling
// triangle tone), a little different every key; the space bar is deeper. A click peaks around
// -10 dBFS, clearly audible on laptop speakers but under the song.
// The context has to be created inside a tap, so the gate calls `unlockTyping()` when Enter is
// pressed; before that (or if the browser refuses) the clicks are silent. The music button's
// mute state (localStorage `muted`) silences them too.

const MUTED_STORAGE_KEY = 'muted';
const LEVEL = 0.5;

let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;

export function unlockTyping() {
  try {
    ctx ??= new AudioContext();
    void ctx.resume();
  } catch {
    ctx = null;
  }
}

function isMuted() {
  try {
    return window.localStorage.getItem(MUTED_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function typingTick(ch: string) {
  if (!ctx || ctx.state !== 'running' || isMuted()) return;
  const space = ch === ' ';
  const vary = 0.85 + Math.random() * 0.3;
  noise ??= (() => {
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.04), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  })();
  const t = ctx.currentTime + 0.001;

  const tick = ctx.createBufferSource();
  tick.buffer = noise;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = (space ? 900 : 1700) * vary;
  const tickGain = ctx.createGain();
  tickGain.gain.setValueAtTime(0, t);
  tickGain.gain.linearRampToValueAtTime((space ? 0.35 : 0.5) * LEVEL * vary, t + 0.0008);
  tickGain.gain.exponentialRampToValueAtTime(0.0005, t + (space ? 0.03 : 0.016));
  tick.connect(hp).connect(tickGain).connect(ctx.destination);
  tick.start(t);
  tick.stop(t + 0.04);

  const body = ctx.createOscillator();
  body.type = 'triangle';
  body.frequency.setValueAtTime((space ? 120 : 200) * vary, t);
  body.frequency.exponentialRampToValueAtTime((space ? 80 : 140) * vary, t + 0.04);
  const bodyGain = ctx.createGain();
  bodyGain.gain.setValueAtTime(0, t);
  bodyGain.gain.linearRampToValueAtTime((space ? 0.4 : 0.28) * LEVEL, t + 0.002);
  bodyGain.gain.exponentialRampToValueAtTime(0.0005, t + (space ? 0.06 : 0.04));
  body.connect(bodyGain).connect(ctx.destination);
  body.start(t);
  body.stop(t + 0.07);
}
