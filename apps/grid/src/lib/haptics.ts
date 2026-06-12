/** Vibration API wrapper — silently no-ops where unsupported (iOS Safari). */
export function tap(): void {
  try { navigator.vibrate?.(10); } catch { /* unsupported */ }
}

export function win(): void {
  try { navigator.vibrate?.([30, 60, 30, 60, 90]); } catch { /* unsupported */ }
}

export function error(): void {
  try { navigator.vibrate?.([40, 40, 40]); } catch { /* unsupported */ }
}
