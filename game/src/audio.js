// All of Nightwick's sound is synthesised at runtime with WebAudio: an oil-lamp drone, the
// crackle of the beam, and short bells and thumps for the things that happen. No audio files,
// so the game stays a handful of text files a browser can open offline.

let ctx = null;
let master = null;
let noiseBuffer = null;
let drone = null;
let burn = null;
let ready = false;

const VOLUME = 0.5;

function makeNoise(context) {
  const seconds = 2;
  const buffer = context.createBuffer(1, context.sampleRate * seconds, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

export function ensureAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try {
    ctx = new AC();
  } catch {
    return null;
  }
  master = ctx.createGain();
  master.gain.value = VOLUME;
  master.connect(ctx.destination);
  noiseBuffer = makeNoise(ctx);
  buildDrone();
  buildBurn();
  ready = true;
  return ctx;
}

function buildDrone() {
  const gain = ctx.createGain();
  gain.gain.value = 0;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 420;
  filter.Q.value = 0.7;

  const a = ctx.createOscillator();
  a.type = 'sine';
  a.frequency.value = 55;
  const b = ctx.createOscillator();
  b.type = 'triangle';
  b.frequency.value = 82.5;
  const c = ctx.createOscillator();
  c.type = 'sine';
  c.frequency.value = 110;
  c.detune.value = 6;

  const cGain = ctx.createGain();
  cGain.gain.value = 0.28;

  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.07;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 0.018;

  a.connect(filter);
  b.connect(filter);
  c.connect(cGain).connect(filter);
  filter.connect(gain).connect(master);
  lfo.connect(lfoGain).connect(gain.gain);

  a.start();
  b.start();
  c.start();
  lfo.start();
  drone = { gain, filter };
}

function buildBurn() {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 1600;
  filter.Q.value = 0.6;
  const gain = ctx.createGain();
  gain.gain.value = 0;
  src.connect(filter).connect(gain).connect(master);
  src.start();
  burn = { gain, filter };
}

export function setDrone(level) {
  if (!ready) return;
  const now = ctx.currentTime;
  drone.gain.gain.cancelScheduledValues(now);
  drone.gain.gain.setTargetAtTime(level * 0.09, now, 0.6);
}

export function setBurn(level, distance = 1) {
  if (!ready) return;
  const now = ctx.currentTime;
  const target = level * (0.05 + distance * 0.05);
  burn.gain.gain.setTargetAtTime(target, now, 0.05);
  burn.filter.frequency.setTargetAtTime(1200 + distance * 1400 + Math.sin(now * 23) * 120, now, 0.08);
}

function blip(type, frequency, duration, volume, when = 0, endFrequency = null) {
  if (!ready) return;
  const t = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, t);
  if (endFrequency) osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), t + duration);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(volume, t + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(gain).connect(master);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}

function thump(frequency, duration, volume) {
  if (!ready) return;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(900, t);
  filter.frequency.exponentialRampToValueAtTime(120, t + duration);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  src.connect(filter).connect(gain).connect(master);
  src.start(t);
  src.stop(t + duration + 0.02);
  blip('sine', frequency, duration * 0.9, volume * 0.5, 0, frequency * 0.5);
}

export const sfx = {
  kill() {
    thump(190, 0.16, 0.1);
    blip('triangle', 320, 0.1, 0.035, 0.01, 180);
  },
  bigKill() {
    thump(120, 0.34, 0.16);
    blip('sawtooth', 180, 0.18, 0.05, 0, 90);
  },
  flare() {
    thump(90, 0.5, 0.2);
    blip('sine', 120, 0.4, 0.08, 0, 40);
    blip('triangle', 880, 0.18, 0.03, 0.01, 520);
  },
  hurt() {
    thump(70, 0.42, 0.24);
    blip('square', 150, 0.2, 0.05, 0, 60);
  },
  pickup() {
    blip('sine', 1180, 0.07, 0.02, 0, 1500);
  },
  wave() {
    blip('sine', 392, 0.5, 0.05);
    blip('sine', 587, 0.5, 0.04, 0.06);
    blip('sine', 784, 0.7, 0.03, 0.12);
  },
  upgrade() {
    blip('triangle', 523, 0.35, 0.05);
    blip('triangle', 784, 0.45, 0.04, 0.08);
    blip('sine', 1046, 0.6, 0.03, 0.16);
  },
  win() {
    [523, 659, 784, 1046, 1318].forEach((f, i) => blip('sine', f, 0.9, 0.055, i * 0.13));
  },
  lose() {
    [392, 311, 233, 155].forEach((f, i) => blip('triangle', f, 0.8, 0.06, i * 0.16, f * 0.85));
  },
  ui() {
    blip('sine', 740, 0.05, 0.015);
  },
};

export function soundReady() {
  return ready && ctx && ctx.state === 'running';
}
