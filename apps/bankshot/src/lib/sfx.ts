/**
 * Bank Shot SFX — zero assets, WebAudio synth.
 * Sounds default ON; muting persists via localStorage.
 */
import { load, save } from './storage';

let ctx: AudioContext | null = null;
let muted = load<boolean>('muted', false);

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
export function setMuted(m: boolean): void { muted = m; save('muted', m); }

function blip(freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number): void {
  const a = ac();
  if (!a) return;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, a.currentTime);
  if (slideTo !== undefined) o.frequency.exponentialRampToValueAtTime(slideTo, a.currentTime + dur);
  g.gain.setValueAtTime(vol, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
  o.connect(g).connect(a.destination);
  o.start();
  o.stop(a.currentTime + dur);
}

/** Shot fired — crack */
export function sfxShot(): void {
  blip(220, 0.06, 'sawtooth', 0.18, 80);
  blip(440, 0.05, 'square', 0.10, 200);
}

/** Wall bounce tick — pitch rises per bounce count */
export function sfxBounce(bounceCount: number): void {
  const base = 400;
  const mult = Math.min(2.5, 1 + bounceCount * 0.25);
  blip(base * mult, 0.07, 'triangle', 0.12, base * mult * 1.3);
}

/** Target hit pop chord */
export function sfxHit(): void {
  blip(600, 0.14, 'triangle', 0.16, 900);
  blip(900, 0.10, 'sine', 0.12, 1400);
  blip(1200, 0.08, 'sine', 0.08, 1800);
}

/** Level clear fanfare */
export function sfxClear(): void {
  const a = ac();
  if (!a) return;
  [523, 659, 784, 1047].forEach((f, i) => {
    setTimeout(() => blip(f, 0.16, 'triangle', 0.16), i * 90);
  });
}

/** Star stamp — rising pitch per star (call with starIndex 0,1,2) */
export function sfxStar(starIndex: number): void {
  const freqs = [523, 659, 784];
  const f = freqs[starIndex] ?? 784;
  blip(f, 0.18, 'triangle', 0.18, f * 1.5);
}

/** Bullet fizzle (missed all targets) */
export function sfxFizzle(): void {
  blip(280, 0.3, 'sawtooth', 0.10, 60);
}

/** UI click */
export function sfxClick(): void {
  blip(660, 0.05, 'sine', 0.10);
}

/** Game start fanfare */
export function sfxStart(): void {
  const a = ac();
  if (!a) return;
  [392, 523, 659].forEach((f, i) => {
    setTimeout(() => blip(f, 0.12, 'triangle', 0.16), i * 90);
  });
}
