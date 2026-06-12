/**
 * Tiny WebAudio synth SFX for Orbit Hop — zero assets, ~1ms latency, mobile-safe.
 * Sounds default ON (muting persists); context resumes on first gesture.
 */
import { load, save } from './storage';

let ctx: AudioContext | null = null;
let muted = load<boolean>('orbit-muted', false);

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
  save('orbit-muted', m);
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

/** star collect — rising chirp with semitone ladder, base 520 Hz */
export function sfxStarCollect(combo: number): void {
  const mult = Math.min(2, Math.pow(1.05946, combo));
  blip(520 * mult, 0.12, 'triangle', 0.16, 780 * mult);
}

/** hop whoosh — short triangle sweep 300→600 Hz, 0.12s */
export function sfxHopWhoosh(): void {
  blip(300, 0.12, 'triangle', 0.13, 600);
}

/** slingshot charge — rising sine 200→800 Hz, 0.35s, low vol */
export function sfxSlingshotCharge(): void {
  blip(200, 0.35, 'sine', 0.09, 800);
}

/** death — down sweep sawtooth + triangle */
export function sfxDeath(): void {
  blip(380, 0.5, 'sawtooth', 0.16, 70);
  blip(190, 0.6, 'triangle', 0.12, 50);
}

/** game start fanfare — three quick rising notes */
export function sfxStart(): void {
  const a = ac();
  if (!a) return;
  [392, 523, 659].forEach((f, i) => {
    setTimeout(() => blip(f, 0.12, 'triangle', 0.16), i * 90);
  });
}

/** UI tap */
export function sfxClick(): void {
  blip(660, 0.05, 'sine', 0.1);
}
