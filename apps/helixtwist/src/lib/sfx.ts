/**
 * Helix Twist SFX — zero assets, WebAudio synth.
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

/** Gap fall whiff — pitch rises per combo */
export function sfxFall(combo: number): void {
  const mult = Math.min(2, Math.pow(1.05946, combo));
  blip(260 * mult, 0.09, 'sine', 0.14, 440 * mult);
}

/** Bounce tap on safe platform */
export function sfxBounce(): void {
  blip(320, 0.07, 'triangle', 0.12, 500);
}

/** Fire ignite — 3-chain reached */
export function sfxFireIgnite(): void {
  blip(440, 0.14, 'sawtooth', 0.15, 880);
  blip(660, 0.10, 'triangle', 0.12, 1320);
}

/** Danger plate death sweep */
export function sfxDeath(): void {
  blip(380, 0.5, 'sawtooth', 0.16, 70);
  blip(190, 0.6, 'triangle', 0.12, 50);
}

/** Tower cleared fanfare */
export function sfxWin(): void {
  const a = ac();
  if (!a) return;
  [392, 523, 659, 784].forEach((f, i) => {
    setTimeout(() => blip(f, 0.14, 'triangle', 0.16), i * 90);
  });
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
