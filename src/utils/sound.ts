import { useSettings } from '../store/settings';

let ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
  const AudioContextCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) return null;
  if (!ctx) ctx = new AudioContextCtor();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function canPlay(): AudioContext | null {
  if (!useSettings.getState().soundEnabled) return null;
  return getContext();
}

// Single oscillator with a short attack/decay envelope so tones click-free start and end.
function playTone(context: AudioContext, freq: number, startOffset: number, duration: number, type: OscillatorType, peakGain: number) {
  const osc = context.createOscillator();
  const env = context.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t0 = context.currentTime + startOffset;
  env.gain.setValueAtTime(0, t0);
  env.gain.linearRampToValueAtTime(peakGain, t0 + 0.012);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(env).connect(context.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

export function playSetComplete() {
  const context = canPlay();
  if (!context) return;
  playTone(context, 880, 0, 0.09, 'sine', 0.16);
}

export function playWorkoutComplete() {
  const context = canPlay();
  if (!context) return;
  // Rising arpeggio: C5 E5 G5 C6
  [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) =>
    playTone(context, freq, i * 0.09, 0.35, 'triangle', 0.18),
  );
}

export function playPR() {
  const context = canPlay();
  if (!context) return;
  // Bigger "level up" fanfare — a longer, brighter run topped with a sustained high note.
  [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((freq, i) =>
    playTone(context, freq, i * 0.08, 0.4, 'triangle', 0.16),
  );
  playTone(context, 261.63, 0, 0.55, 'sine', 0.12);
}
