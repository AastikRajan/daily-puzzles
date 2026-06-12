/** Vibration API wrapper — silently no-ops where unsupported. */
export function tap(): void {
  try { navigator.vibrate?.(10); } catch { /* unsupported */ }
}

export function holeIn(): void {
  try { navigator.vibrate?.([50, 30, 80, 30, 120]); } catch { /* unsupported */ }
}

export function sink(): void {
  try { navigator.vibrate?.([30, 60, 60]); } catch { /* unsupported */ }
}

export function win(): void {
  try { navigator.vibrate?.([30, 60, 30, 60, 90]); } catch { /* unsupported */ }
}
