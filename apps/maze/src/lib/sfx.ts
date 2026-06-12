/**
 * Tiny WebAudio synth SFX â€” zero assets, ~1ms latency, mobile-safe.
 * Sounds default ON (muting persists); context resumes on first gesture.
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

export function isMuted(): boolean {
  return muted;
}

export function setMuted(m: boolean): void {
  muted = m;
  save('muted', m);
}

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

/** picking something up â€” bright up-chirp */
export function sfxEat(): void {
  blip(420, 0.09, 'triangle', 0.18, 700);
}

/** big satisfying pop â€” layered chord */
export function sfxPop(size = 1): void {
  blip(300, 0.18, 'square', 0.12, 180);
  blip(520 + size * 40, 0.22, 'triangle', 0.2, 760 + size * 60);
  blip(1040, 0.12, 'sine', 0.1, 1400);
}

/** combo escalation â€” semitone pitch ladder (Ã—1.05946^n, capped at one octave) */
export function sfxCombo(n: number): void {
  const mult = Math.min(2, Math.pow(1.05946, n));
  blip(440 * mult, 0.12, 'triangle', 0.16, 660 * mult);
}

/** death â€” sad down sweep */
export function sfxDeath(): void {
  blip(380, 0.5, 'sawtooth', 0.16, 70);
  blip(190, 0.6, 'triangle', 0.12, 50);
}

/** UI tap */
export function sfxClick(): void {
  blip(660, 0.05, 'sine', 0.1);
}

/** game start fanfare â€” three quick rising notes */
export function sfxStart(): void {
  const a = ac();
  if (!a) return;
  [392, 523, 659].forEach((f, i) => {
    setTimeout(() => blip(f, 0.12, 'triangle', 0.16), i * 90);
  });
}

/** wall bump — short low thud */
export function sfxBump(): void {
  blip(140, 0.12, 'square', 0.16, 80);
}

/** echo pulse — sonar ping */
export function sfxEcho(): void {
  blip(880, 0.5, 'sine', 0.14, 440);
  blip(1320, 0.3, 'sine', 0.06, 660);
}