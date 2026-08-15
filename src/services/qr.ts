import { Html5Qrcode, type Html5QrcodeResult } from 'html5-qrcode'

let instanceCounter = 0

export async function startScanner(
  onResult: (decodedText: string) => void,
  onError?: (error: string) => void,
): Promise<Html5Qrcode> {
  const id = `qr-reader-${++instanceCounter}`
  const qrCode = new Html5Qrcode(id)

  const config = {
    fps: 10,
    qrbox: { width: 250, height: 250 },
    aspectRatio: 1.0,
  }

  try {
    await qrCode.start(
      { facingMode: 'environment' },
      config,
      (decodedText: string) => {
        onResult(decodedText)
        qrCode.stop().catch(() => {})
      },
      (errorMessage: string) => {
        onError?.(errorMessage)
      },
    )
  } catch (e: any) {
    qrCode.stop().catch(() => {})
    throw e
  }

  return qrCode
}

export function parseQrData(raw: string): Record<string, unknown> | null {
  try {
    return JSON.parse(raw)
  } catch {
    try {
      return JSON.parse(atob(raw))
    } catch {
      return null
    }
  }
}

export { Html5Qrcode, type Html5QrcodeResult }
