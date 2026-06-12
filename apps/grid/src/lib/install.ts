import { create } from 'zustand';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface InstallState {
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

export function listenForInstall(): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
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
