// The terminal's sounds, played while something happens (`startTerminalSound` /
// `stopTerminalSound`): `keys` while a line types, `progress` while the bar fills, `glitch`
// while the screen tears. A recorded file (`loadTerminalSounds`) is looped; with none, the
// progress bar and the glitch are made here with the Web Audio API: a patter of quiet, randomly
// pitched data blips over a faint hum, and crackling bursts of static over a low mains buzz.
// With no `keys` recording, each key gets a click instead (`typingTick`): a sharp
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
/** What is sounding now, and how to stop it (with a short fade). */
const voices: Partial<Record<TerminalSound, () => void>> = {};

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

/** Starts a sound looping until `stopTerminalSound`: the recording if one is loaded, otherwise
 *  the made-up progress patter or static (the keys have their per-key click instead). */
export function startTerminalSound(name: TerminalSound) {
  if (!canPlay(ctx) || voices[name]) return;
  const sample = samples[name];
  if (sample) voices[name] = loopSample(ctx, sample);
  else if (name === 'progress') voices[name] = progressPatter(ctx);
  else if (name === 'glitch') voices[name] = staticCrackle(ctx);
}

export function stopTerminalSound(name: TerminalSound) {
  const stop = voices[name];
  if (!stop) return;
  delete voices[name];
  stop();
}

/** A gain for one voice, and how to fade it out and end it. */
function voiceOut(
  audio: AudioContext,
  level: number,
  onEnd: (at: number) => void,
) {
  const out = audio.createGain();
  out.gain.value = level;
  out.connect(audio.destination);
  const stop = () => {
    const t = audio.currentTime;
    out.gain.setValueAtTime(out.gain.value, t);
    out.gain.linearRampToValueAtTime(0, t + FADE_SECONDS);
    onEnd(t + FADE_SECONDS + 0.02);
  };
  return { out, stop };
}

function loopSample(audio: AudioContext, sample: AudioBuffer) {
  const source = audio.createBufferSource();
  source.buffer = sample;
  source.loop = true;
  const { out, stop } = voiceOut(audio, LEVEL, (at) => source.stop(at));
  source.connect(out);
  source.start();
  return stop;
}

function noiseBuffer(audio: AudioContext) {
  noise ??= (() => {
    const buffer = audio.createBuffer(
      1,
      Math.ceil(audio.sampleRate * 0.25),
      audio.sampleRate,
    );
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  })();
  return noise;
}

/** A blip of tone or a burst of noise, with a quick attack and a short tail. */
function envelope(
  audio: AudioContext,
  node: AudioScheduledSourceNode,
  into: AudioNode,
  peak: number,
  length: number,
) {
  const t = audio.currentTime + 0.005;
  const gain = audio.createGain();
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(peak, t + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0005, t + length);
  node.connect(gain).connect(into);
  node.start(t);
  node.stop(t + length + 0.02);
}

// an old computer reading data: quiet square blips on a pentatonic scale, about 14 a second,
// over a faint low hum
const PATTER_NOTES = [784, 880, 1047, 1175, 1319, 1568, 1760];
function progressPatter(audio: AudioContext) {
  const hum = audio.createOscillator();
  hum.type = 'triangle';
  hum.frequency.value = 98;
  const { out, stop } = voiceOut(audio, LEVEL, (at) => {
    clearInterval(timer);
    hum.stop(at);
  });
  const soft = audio.createBiquadFilter();
  soft.type = 'lowpass';
  soft.frequency.value = 2600;
  soft.connect(out);
  const humGain = audio.createGain();
  humGain.gain.value = 0.05;
  hum.connect(humGain).connect(out);
  hum.start();
  const timer = window.setInterval(() => {
    if (Math.random() < 0.25) return;
    const blip = audio.createOscillator();
    blip.type = 'square';
    blip.frequency.value =
      PATTER_NOTES[Math.floor(Math.random() * PATTER_NOTES.length)];
    envelope(audio, blip, soft, 0.07, 0.035 + Math.random() * 0.03);
  }, 70);
  return stop;
}

// the picture tearing: crackling bursts of band-passed static at random pitches and lengths,
// over a low mains buzz that drops in and out
function staticCrackle(audio: AudioContext) {
  const buzz = audio.createOscillator();
  buzz.type = 'sawtooth';
  buzz.frequency.value = 55;
  const { out, stop } = voiceOut(audio, LEVEL, (at) => {
    clearInterval(timer);
    buzz.stop(at);
  });
  const buzzTone = audio.createBiquadFilter();
  buzzTone.type = 'lowpass';
  buzzTone.frequency.value = 420;
  const buzzGain = audio.createGain();
  buzzGain.gain.value = 0.08;
  buzz.connect(buzzTone).connect(buzzGain).connect(out);
  buzz.start();
  const timer = window.setInterval(() => {
    buzzGain.gain.setTargetAtTime(
      Math.random() < 0.3 ? 0 : 0.06 + Math.random() * 0.08,
      audio.currentTime,
      0.01,
    );
    if (Math.random() < 0.35) return;
    const burst = audio.createBufferSource();
    burst.buffer = noiseBuffer(audio);
    burst.playbackRate.value = 0.6 + Math.random() * 0.8;
    const band = audio.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 400 + Math.random() * 3600;
    band.Q.value = 0.7 + Math.random() * 1.5;
    band.connect(out);
    envelope(
      audio,
      burst,
      band,
      0.25 + Math.random() * 0.35,
      0.03 + Math.random() * 0.12,
    );
  }, 50);
  return stop;
}

/** One key's click, unless a recorded `keys` sound is loaded (that one loops per line instead). */
export function typingTick(ch: string) {
  if (!canPlay(ctx) || samples.keys) return;
  const space = ch === ' ';
  const vary = 0.85 + Math.random() * 0.3;
  const audio = ctx;

  const t = audio.currentTime + 0.001;

  const tick = audio.createBufferSource();
  tick.buffer = noiseBuffer(audio);
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
