export function tap(): void {
  try { navigator.vibrate?.(10); } catch { /* unsupported */ }
}

export function shatter(): void {
  try { navigator.vibrate?.([15, 10, 15]); } catch { /* unsupported */ }
}

export function death(): void {
  try { navigator.vibrate?.([40, 40, 80]); } catch { /* unsupported */ }
}
