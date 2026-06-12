import { create } from 'zustand';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface InstallState {
  /** Chromium: captured beforeinstallprompt event, ready to fire. */
  deferred: BeforeInstallPromptEvent | null;
  installed: boolean;
  setDeferred: (e: BeforeInstallPromptEvent | null) => void;
  setInstalled: () => void;
}

export const useInstall = create<InstallState>((set) => ({
  deferred: null,
  installed: false,
  setDeferred: (deferred) => set({ deferred }),
  setInstalled: () => set({ installed: true, deferred: null }),
}));

/** Call once at startup (before React renders) so the event isn't missed. */
export function listenForInstall(): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // suppress the mini-infobar; we offer our own button
    useInstall.getState().setDeferred(e as BeforeInstallPromptEvent);
  });
  window.addEventListener('appinstalled', () => useInstall.getState().setInstalled());
}

export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as { standalone?: boolean }).standalone === true
  );
}

/** iOS Safari has no install prompt — we show Share→Add-to-Home-Screen steps. */
export function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export async function promptInstall(): Promise<boolean> {
  const { deferred } = useInstall.getState();
  if (!deferred) return false;
  await deferred.prompt();
  const choice = await deferred.userChoice;
  useInstall.getState().setDeferred(null);
  return choice.outcome === 'accepted';
}
