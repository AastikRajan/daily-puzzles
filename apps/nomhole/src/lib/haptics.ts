export function tap(): void {
  try { navigator.vibrate?.(10); } catch { /* unsupported */ }
}

export function gulp(): void {
  try { navigator.vibrate?.([15, 10, 25]); } catch { /* unsupported */ }
}

export function roundEnd(): void {
  try { navigator.vibrate?.([40, 30, 60]); } catch { /* unsupported */ }
}
