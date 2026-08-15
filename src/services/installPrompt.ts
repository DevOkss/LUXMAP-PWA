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

let deferredPrompt: BeforeInstallPromptEvent | null = null

export function hasInstallPrompt(): boolean {
  return deferredPrompt !== null
}

export function getDeferredPrompt(): BeforeInstallPromptEvent | null {
  return deferredPrompt
}

export function attachInstallPromptListener(): void {
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
    return choice.outcome === 'accepted'
  } catch {
    return false
  }
}

export function attachInstalledListener(onInstalled: () => void): void {
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    onInstalled()
  })
}
