/**
 * Tiny WebAudio synth SFX — zero assets, ~1ms latency, mobile-safe.
 */
import { load, save } from './storage';

let ctx: AudioContext | null = null;
let muted = load<boolean>('flock-muted', false);

function ac(): AudioContext | null {
  if (muted) return null;
  try {
    if (!ctx) ctx = new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

export function isMuted(): boolean { return muted; }
export function setMuted(m: boolean): void { muted = m; save('flock-muted', m); }

function blip(freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number): void {
  const a = ac();
  if (!a) return;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, a.currentTime);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, a.currentTime + dur);
  g.gain.setValueAtTime(vol, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
  o.connect(g).connect(a.destination);
  o.start();
  o.stop(a.currentTime + dur);
}

/** Gate trigger — three-note chord */
export function sfxGateTrigger(): void {
  blip(330, 0.18, 'triangle', 0.14, 440);
  blip(495, 0.16, 'triangle', 0.1, 660);
  blip(660, 0.12, 'sine', 0.08, 880);
}

/** Delivery chirp ladder — pitch rises with each delivery batch */
export function sfxDelivery(n: number): void {
  const mult = Math.min(2, Math.pow(1.05946, n));
  blip(520 * mult, 0.14, 'triangle', 0.18, 780 * mult);
}

/** Predator gulp — low thud */
export function sfxGulp(): void {
  blip(80, 0.25, 'sawtooth', 0.18, 40);
  blip(160, 0.15, 'triangle', 0.1, 60);
}

/** Level fanfare */
export function sfxFanfare(): void {
  const a = ac();
  if (!a) return;
  [392, 494, 587, 784].forEach((f, i) => {
    setTimeout(() => blip(f, 0.14, 'triangle', 0.16), i * 80);
  });
}

/** Death sweep */
export function sfxDeath(): void {
  blip(380, 0.5, 'sawtooth', 0.16, 70);
  blip(190, 0.6, 'triangle', 0.12, 50);
}

/** UI click */
export function sfxClick(): void {
  blip(660, 0.05, 'sine', 0.1);
}

/** game start fanfare */
export function sfxStart(): void {
  const a = ac();
  if (!a) return;
  [392, 523, 659].forEach((f, i) => {
    setTimeout(() => blip(f, 0.12, 'triangle', 0.16), i * 90);
  });
}
