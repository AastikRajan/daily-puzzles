/**
 * Tiny WebAudio synth SFX — zero assets, ~1ms latency, mobile-safe.
 */
import { load, save } from './storage';

let ctx: AudioContext | null = null;
let muted = load<boolean>('swing-muted', false);

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
export function setMuted(m: boolean): void { muted = m; save('swing-muted', m); }

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

/** Latch click when rope attaches */
export function sfxLatch(): void {
  blip(880, 0.04, 'square', 0.12);
  blip(440, 0.06, 'triangle', 0.08);
}

/** Whoosh while swinging — called each frame when attached, gain tied to speed.
 *  speed: pixels/sec, max ~600 */
export function sfxSwingLoop(speed: number): void {
  const a = ac();
  if (!a) return;
  const vol = Math.min(0.06, (speed / 600) * 0.06);
  if (vol < 0.005) return;
  blip(120 + speed * 0.1, 0.06, 'sawtooth', vol, 80 + speed * 0.06);
}

/** Star chirp ladder — pitch rises with combo */
export function sfxStarChirp(n: number): void {
  const mult = Math.min(2, Math.pow(1.05946, n));
  blip(520 * mult, 0.12, 'triangle', 0.16, 780 * mult);
}

/** Splash death — low splashy down sweep */
export function sfxSplash(): void {
  blip(300, 0.4, 'sawtooth', 0.15, 60);
  blip(180, 0.5, 'triangle', 0.12, 40);
  blip(600, 0.15, 'sine', 0.08, 200);
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
