export function tap(): void {
  try { navigator.vibrate?.(10); } catch { /* noop */ }
}

export function win(): void {
  try { navigator.vibrate?.([30, 60, 30, 60, 90]); } catch { /* noop */ }
}

export function error(): void {
  try { navigator.vibrate?.([40, 40, 40]); } catch { /* noop */ }
}
