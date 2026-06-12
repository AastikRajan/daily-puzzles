export function tap(): void {
  try { navigator.vibrate?.(10); } catch { /* unsupported */ }
}

export function pop(): void {
  try { navigator.vibrate?.([15, 20, 15]); } catch { /* unsupported */ }
}
