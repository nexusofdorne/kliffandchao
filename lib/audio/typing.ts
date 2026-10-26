// The terminal's key clicks: a few milliseconds of filtered noise per character, made with the
// Web Audio API so there is no sound file to load. The context has to be created inside a tap, so
// the gate calls `unlockTyping()` when Enter is pressed; before that (or if the browser refuses)
// the ticks are silent. The music button's mute state (localStorage `muted`) silences them too.

const MUTED_STORAGE_KEY = 'muted';
const PEAK = 0.05;

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
  if (!ctx || ctx.state !== 'running' || isMuted() || ch === ' ') return;
  noise ??= (() => {
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.03), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  })();
  const t = ctx.currentTime;
  const source = ctx.createBufferSource();
  source.buffer = noise;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 1800 + Math.random() * 1600;
  filter.Q.value = 1.2;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(PEAK * (0.7 + Math.random() * 0.6), t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.028);
  source.connect(filter).connect(gain).connect(ctx.destination);
  source.start(t);
  source.stop(t + 0.03);
}
