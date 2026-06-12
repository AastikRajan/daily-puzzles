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
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, a.currentTime + dur);
  g.gain.setValueAtTime(vol, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
  o.connect(g).connect(a.destination);
  o.start();
  o.stop(a.currentTime + dur);
}

/** plate shatter — noise burst, pitch rises with streak */
export function sfxShatter(streak: number): void {
  const pitch = 180 + streak * 60;
  blip(pitch, 0.08, 'sawtooth', 0.15, pitch * 2.5);
  blip(pitch * 1.5, 0.06, 'square', 0.1);
}

/** fireball ignite — whoosh */
export function sfxFireball(): void {
  blip(120, 0.35, 'sawtooth', 0.18, 800);
  blip(400, 0.2, 'triangle', 0.12, 1200);
}

/** death sweep */
export function sfxDeath(): void {
  blip(380, 0.5, 'sawtooth', 0.16, 70);
  blip(190, 0.6, 'triangle', 0.12, 50);
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
