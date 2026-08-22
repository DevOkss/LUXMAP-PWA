/**
 * Capture the browser's PWA install prompt (`beforeinstallprompt`) so we can
 * offer an "Install" action from inside the app. The prompt only fires on the
 * PWA's own origin, so the landing page navigates here first and the app
 * surfaces the install UI directly.
 */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

const STORAGE_KEY = 'luxmap-install-state'

let deferredPrompt: BeforeInstallPromptEvent | null = null
let listenerAttached = false

type InstallState = 'installed' | 'dismissed'

function readStoredState(): InstallState | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value === 'installed' || value === 'dismissed' ? value : null
  } catch {
    return null
  }
}

function writeStoredState(state: InstallState): void {
  try {
    localStorage.setItem(STORAGE_KEY, state)
  } catch {
    /* storage unavailable (private mode) — banner just re-shows */
  }
}

/** True when the app is running as an installed PWA (Android/Chrome). */
export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
  )
}

/** True when a previous session already recorded an install or dismissal. */
export function isMarkedInstalled(): boolean {
  return readStoredState() !== null
}

export function markInstalled(): void {
  writeStoredState('installed')
}

export function markDismissed(): void {
  writeStoredState('dismissed')
}

export function hasInstallPrompt(): boolean {
  return deferredPrompt !== null
}

export function getDeferredPrompt(): BeforeInstallPromptEvent | null {
  return deferredPrompt
}

/**
 * Attach the capture listener as early as possible (module import time) so the
 * `beforeinstallprompt` event is never missed before Vue mounts.
 */
export function attachInstallPromptListener(): void {
  if (listenerAttached) return
  listenerAttached = true
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferredPrompt = event as unknown as BeforeInstallPromptEvent
  })
}

export function clearInstallPrompt(): void {
  deferredPrompt = null
}

export async function promptInstall(): Promise<boolean> {
  if (!deferredPrompt) return false
  const prompt = deferredPrompt
  deferredPrompt = null
  try {
    await prompt.prompt()
    const choice = await prompt.userChoice
    if (choice.outcome === 'accepted') {
      writeStoredState('installed')
      return true
    }
    writeStoredState('dismissed')
    return false
  } catch {
    return false
  }
}

export function attachInstalledListener(onInstalled: () => void): void {
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    writeStoredState('installed')
    onInstalled()
  })
}
