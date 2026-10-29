// The terminal's sounds. Recorded ones are loaded with `loadTerminalSounds` and played as
// loops while something happens (`startTerminalSound` / `stopTerminalSound`): `keys` while a
// line types, `progress` while the bar fills, `glitch` while the screen tears. With no `keys`
// recording, each key gets a click made with the Web Audio API instead (`typingTick`): a sharp
// tick (a few milliseconds of high-passed noise) over a short low "thock" (a falling triangle
// tone), a little different every key; the space bar is deeper. Sounds peak around -10 dBFS,
// clearly audible on laptop speakers but under the song.
// The context has to be created inside a tap, so the gate calls `unlockTyping()` when Enter is
// pressed; before that (or if the browser refuses) everything is silent. The music button's
// mute state (localStorage `muted`) silences them too.

const MUTED_STORAGE_KEY = 'muted';
const LEVEL = 0.5;
const FADE_SECONDS = 0.12;

export type TerminalSound = 'keys' | 'progress' | 'glitch';

let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;
const samples: Partial<Record<TerminalSound, AudioBuffer>> = {};
const voices: Partial<
  Record<TerminalSound, { source: AudioBufferSourceNode; gain: GainNode }>
> = {};

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

const canPlay = (audio: AudioContext | null): audio is AudioContext =>
  !!audio && audio.state === 'running' && !isMuted();

async function decode(url: string): Promise<AudioBuffer | null> {
  if (!ctx) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${response.status}`);
    return await ctx.decodeAudioData(await response.arrayBuffer());
  } catch (error) {
    console.warn('terminal sound not loaded', url, error);
    return null;
  }
}

/** Loads the recorded terminal sounds that are configured (an empty path is skipped). Call after `unlockTyping`. */
export async function loadTerminalSounds(
  sources: Partial<Record<TerminalSound, string>>,
) {
  await Promise.all(
    (Object.entries(sources) as [TerminalSound, string][]).map(
      async ([name, url]) => {
        if (!url || samples[name]) return;
        const buffer = await decode(url);
        if (buffer) samples[name] = buffer;
      },
    ),
  );
}

/** Starts a recorded sound looping, until `stopTerminalSound`. Silent if it isn't loaded. */
export function startTerminalSound(name: TerminalSound) {
  const sample = samples[name];
  if (!canPlay(ctx) || !sample || voices[name]) return;
  const source = ctx.createBufferSource();
  source.buffer = sample;
  source.loop = true;
  const gain = ctx.createGain();
  gain.gain.value = LEVEL;
  source.connect(gain).connect(ctx.destination);
  source.start();
  voices[name] = { source, gain };
}

export function stopTerminalSound(name: TerminalSound) {
  const voice = voices[name];
  if (!ctx || !voice) return;
  delete voices[name];
  const t = ctx.currentTime;
  voice.gain.gain.setValueAtTime(voice.gain.gain.value, t);
  voice.gain.gain.linearRampToValueAtTime(0, t + FADE_SECONDS);
  voice.source.stop(t + FADE_SECONDS + 0.02);
}

/** One key's click, unless a recorded `keys` sound is loaded (that one loops per line instead). */
export function typingTick(ch: string) {
  if (!canPlay(ctx) || samples.keys) return;
  const space = ch === ' ';
  const vary = 0.85 + Math.random() * 0.3;
  const audio = ctx;
  noise ??= (() => {
    const buffer = audio.createBuffer(
      1,
      Math.ceil(audio.sampleRate * 0.04),
      audio.sampleRate,
    );
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  })();
  const t = audio.currentTime + 0.001;

  const tick = audio.createBufferSource();
  tick.buffer = noise;
  const hp = audio.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = (space ? 900 : 1700) * vary;
  const tickGain = audio.createGain();
  tickGain.gain.setValueAtTime(0, t);
  tickGain.gain.linearRampToValueAtTime(
    (space ? 0.35 : 0.5) * LEVEL * vary,
    t + 0.0008,
  );
  tickGain.gain.exponentialRampToValueAtTime(
    0.0005,
    t + (space ? 0.03 : 0.016),
  );
  tick.connect(hp).connect(tickGain).connect(audio.destination);
  tick.start(t);
  tick.stop(t + 0.04);

  const body = audio.createOscillator();
  body.type = 'triangle';
  body.frequency.setValueAtTime((space ? 120 : 200) * vary, t);
  body.frequency.exponentialRampToValueAtTime(
    (space ? 80 : 140) * vary,
    t + 0.04,
  );
  const bodyGain = audio.createGain();
  bodyGain.gain.setValueAtTime(0, t);
  bodyGain.gain.linearRampToValueAtTime(
    (space ? 0.4 : 0.28) * LEVEL,
    t + 0.002,
  );
  bodyGain.gain.exponentialRampToValueAtTime(0.0005, t + (space ? 0.06 : 0.04));
  body.connect(bodyGain).connect(audio.destination);
  body.start(t);
  body.stop(t + 0.07);
}
