/**
 * Merge Drop WebAudio SFX — zero assets, ~1ms latency, mobile-safe.
 * Sounds default ON; mute persists via localStorage.
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

/** Resume AudioContext on first user gesture */
export function resumeCtx(): void {
  ac(); // creates + resumes ctx
}

function blip(freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number): void {
  const a = ac();
  if (!a) return;
  try {
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, a.currentTime);
    if (slideTo != null) o.frequency.exponentialRampToValueAtTime(slideTo, a.currentTime + dur);
    g.gain.setValueAtTime(vol, a.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
    o.connect(g).connect(a.destination);
    o.start();
    o.stop(a.currentTime + dur);
  } catch {
    // AudioContext suspended or unavailable
  }
}

/** Merge pop — chord with semitone combo ladder */
export function sfxMerge(tier: number, comboN = 1): void {
  const base = 300 + tier * 80;
  const slide = 500 + tier * 60;
  blip(base, 0.14, 'triangle', 0.18, slide);
  blip(base * 1.25, 0.10, 'sine', 0.10, slide * 1.2);
  if (comboN > 1) {
    const mult = Math.min(2, Math.pow(1.05946, comboN));
    blip(base * mult, 0.12, 'square', 0.08, slide * mult);
  }
}

/** Soft drop thip */
export function sfxDrop(): void {
  blip(220, 0.06, 'sine', 0.08);
}

/** Death — sad down sweep */
export function sfxDeath(): void {
  blip(380, 0.5, 'sawtooth', 0.16, 70);
  blip(190, 0.6, 'triangle', 0.12, 50);
}

/** Game start fanfare — three rising notes */
export function sfxStart(): void {
  const a = ac();
  if (!a) return;
  [392, 523, 659].forEach((f, i) => {
    setTimeout(() => blip(f, 0.12, 'triangle', 0.16), i * 90);
  });
}

/** UI click tap */
export function sfxClick(): void {
  blip(660, 0.05, 'sine', 0.1);
}
