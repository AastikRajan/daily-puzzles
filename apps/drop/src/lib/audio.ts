/** Tiny WebAudio synth — blips on merge/land. Silently no-ops when AudioContext unavailable. */
let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (ctx) return ctx;
  try {
    ctx = new AudioContext();
    return ctx;
  } catch {
    return null;
  }
}

function blip(freq: number, duration: number, gain: number): void {
  const ac = getCtx();
  if (!ac) return;
  try {
    const osc = ac.createOscillator();
    const gainNode = ac.createGain();
    osc.connect(gainNode);
    gainNode.connect(ac.destination);
    osc.frequency.setValueAtTime(freq, ac.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.7, ac.currentTime + duration);
    gainNode.gain.setValueAtTime(gain, ac.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
    osc.start(ac.currentTime);
    osc.stop(ac.currentTime + duration);
  } catch {
    // AudioContext suspended or unavailable
  }
}

/** Called when two orbs merge — pitch scales with tier. */
export function playMerge(tier: number): void {
  // tier 1-11 maps to 300-1200 Hz
  const freq = 300 + (tier - 1) * 90;
  blip(freq, 0.12, 0.18);
}

/** Called when an orb lands on the stack. */
export function playLand(): void {
  blip(180, 0.08, 0.1);
}
