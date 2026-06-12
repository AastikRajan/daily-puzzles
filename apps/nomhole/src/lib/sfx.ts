import { load, save } from './storage';

let ctx: AudioContext | null = null;
let muted = load<boolean>('muted', false);

function ac(): AudioContext | null {
  if (muted) return null;
  try {
    if (!ctx) ctx = new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch { return null; }
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

/** gulp — pitch DROPS as hole tier grows (1.05946^-tier) */
export function sfxGulp(tier: number, combo: number): void {
  const basePitch = 520 * Math.pow(1.05946, -tier * 2);
  const comboPitch = basePitch * Math.min(2, Math.pow(1.05946, combo));
  blip(comboPitch, 0.14, 'triangle', 0.2, comboPitch * 0.6);
  blip(comboPitch * 1.5, 0.1, 'sine', 0.12);
}

/** round end fanfare */
export function sfxRoundEnd(): void {
  const a = ac();
  if (!a) return;
  [523, 659, 784, 1047].forEach((f, i) => {
    setTimeout(() => blip(f, 0.18, 'triangle', 0.18), i * 110);
  });
}

/** start fanfare */
export function sfxStart(): void {
  const a = ac();
  if (!a) return;
  [392, 523, 659].forEach((f, i) => {
    setTimeout(() => blip(f, 0.12, 'triangle', 0.16), i * 90);
  });
}

/** UI click */
export function sfxClick(): void {
  blip(660, 0.05, 'sine', 0.1);
}
