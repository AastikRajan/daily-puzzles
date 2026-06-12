/**
 * Paint Rush SFX — zero assets, WebAudio synth.
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

/** Gate pass — paint splash chord */
export function sfxGate(): void {
  blip(480, 0.14, 'triangle', 0.16, 880);
  blip(720, 0.10, 'sine', 0.11, 1200);
}

/** Combo escalation pitch ladder */
export function sfxCombo(n: number): void {
  const mult = Math.min(2, Math.pow(1.05946, n));
  blip(440 * mult, 0.12, 'triangle', 0.16, 660 * mult);
}

/** Score countup tick (result screen) */
export function sfxTick(): void {
  blip(600, 0.04, 'sine', 0.08);
}

/** Finish fanfare — rising triumphant notes */
export function sfxFinish(): void {
  const a = ac();
  if (!a) return;
  [392, 523, 659, 784, 1047].forEach((f, i) => {
    setTimeout(() => blip(f, 0.14, 'triangle', 0.16), i * 80);
  });
}

/** Crash — thud + down sweep */
export function sfxCrash(): void {
  blip(180, 0.5, 'sawtooth', 0.18, 50);
  blip(90, 0.6, 'triangle', 0.14, 30);
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
