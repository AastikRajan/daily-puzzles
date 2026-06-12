export function tap(): void {
  try { navigator.vibrate?.(10); } catch { /* unsupported */ }
}

export function hit(): void {
  try { navigator.vibrate?.([20, 10, 20]); } catch { /* unsupported */ }
}

export function clear(): void {
  try { navigator.vibrate?.([30, 20, 50, 20, 80]); } catch { /* unsupported */ }
}

export function fizzle(): void {
  try { navigator.vibrate?.([40, 40, 40]); } catch { /* unsupported */ }
}
