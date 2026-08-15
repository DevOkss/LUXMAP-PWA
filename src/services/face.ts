import * as faceapi from '@vladmandic/face-api'
import api from '@/services/api'

export type FaceDescriptor = number[]

const MODEL_URI = '/models'
const EAR_OPEN_THRESHOLD = 0.16
const EAR_CLOSED_RATIO = 0.65
const EAR_MIN_CLOSED = 0.12
const EAR_BASELINE_MIN = 0.12
const EAR_BASELINE_DECAY = 0.99
const EAR_DIP_RATIO = 0.90
const EAR_DROP_DELTA = 0.04
const DISTANCE_HOLD_FRAMES = 4
const MATCH_DISTANCE = 0.55
const MIN_BLINKS = 1
const BURST_MS = 9000
const ENROLL_SAMPLES = 2
const LANDMARKS_INPUT_SIZE = 160

const DBG = (...args: unknown[]) => console.log('[FACE]', ...args)

export interface FaceEnrollmentRecord {
  user_id: number
  descriptors: FaceDescriptor[]
  enrolled_at: string
}

export function euclideanDistance(a: FaceDescriptor, b: FaceDescriptor): number {
  let sum = 0
  const len = Math.min(a.length, b.length)
  for (let i = 0; i < len; i++) {
    const d = a[i] - b[i]
    sum += d * d
  }
  return Math.sqrt(sum)
}

let modelsPromise: Promise<void> | null = null

export function areModelsLoaded(): boolean {
  return (
    faceapi.nets.tinyFaceDetector.isLoaded &&
    faceapi.nets.faceLandmark68Net.isLoaded &&
    faceapi.nets.faceRecognitionNet.isLoaded
  )
}

export function ensureModels(): Promise<void> {
  if (areModelsLoaded()) {
    DBG('models already loaded')
    return Promise.resolve()
  }
  if (modelsPromise) return modelsPromise
  modelsPromise = (async () => {
    DBG('loading models from', MODEL_URI)
    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URI)
    DBG('tinyFaceDetector loaded')
    await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URI)
    DBG('faceLandmark68Net loaded')
    await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URI)
    DBG('faceRecognitionNet loaded')
  })().catch((e) => {
    DBG('model load FAILED', e)
    modelsPromise = null
    throw e
  })
  return modelsPromise
}

async function openFaceStore(): Promise<IDBDatabase> {
  const request = indexedDB.open('soms_face_db', 1)
  return new Promise<IDBDatabase>((resolve, reject) => {
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('face_data')) {
        request.result.createObjectStore('face_data', { keyPath: 'user_id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function saveFaceEnrollmentLocal(
  userId: number,
  descriptors: FaceDescriptor[],
): Promise<void> {
  const dbHandle = await openFaceStore()
  return new Promise((resolve, reject) => {
    const tx = dbHandle.transaction('face_data', 'readwrite')
    tx.objectStore('face_data').put({
      user_id: userId,
      descriptors,
      enrolled_at: new Date().toISOString(),
    })
    tx.oncomplete = () => {
      dbHandle.close()
      resolve()
    }
    tx.onerror = () => reject(tx.error)
  })
}

export async function getFaceEnrollmentLocal(userId: number): Promise<FaceEnrollmentRecord | null> {
  const dbHandle = await openFaceStore()
  return new Promise((resolve, reject) => {
    const req = dbHandle.transaction('face_data').objectStore('face_data').get(userId)
    req.onsuccess = () => {
      const record = (req.result as FaceEnrollmentRecord | undefined) ?? null
      dbHandle.close()
      resolve(record)
    }
    req.onerror = () => reject(req.error)
  })
}

export async function clearFaceEnrollmentLocal(userId: number): Promise<void> {
  const dbHandle = await openFaceStore()
  return new Promise((resolve, reject) => {
    const tx = dbHandle.transaction('face_data', 'readwrite')
    tx.objectStore('face_data').delete(userId)
    tx.oncomplete = () => {
      dbHandle.close()
      resolve()
    }
    tx.onerror = () => reject(tx.error)
  })
}

export async function isFaceEnrolled(userId: number): Promise<boolean> {
  const local = await getFaceEnrollmentLocal(userId)
  return !!local && local.descriptors.length > 0
}

export async function uploadFaceEnrollment(
  userId: number,
  descriptors: FaceDescriptor[],
): Promise<void> {
  await api.post('/face/enroll', { user_id: `${userId}`, descriptors })
}

export async function fetchServerFaceEnrollment(
  userId: number,
): Promise<FaceDescriptor[] | null> {
  const response = await api.get('/face/enrollment')
  return response.data?.descriptors?.length ? response.data.descriptors : null
}

export async function clearServerFaceEnrollment(): Promise<void> {
  await api.delete('/face/enrollment')
}

interface LandmarkDet extends faceapi.WithFaceDescriptor<
  faceapi.WithFaceLandmarks<faceapi.WithFaceDetection<Record<string, unknown>>>
> {}

interface LandmarkOnly extends faceapi.WithFaceLandmarks<
  faceapi.WithFaceDetection<Record<string, unknown>>
> {}

interface EyePoint {
  x: number
  y: number
}

function computeEar(result: LandmarkOnly): number | null {
  const leftEye = result.landmarks.getLeftEye()
  const rightEye = result.landmarks.getRightEye()
  if (leftEye.length < 6 || rightEye.length < 6) return null

  const ear = (eye: EyePoint[]) => {
    const a = Math.hypot(eye[1].x - eye[5].x, eye[1].y - eye[5].y)
    const b = Math.hypot(eye[2].x - eye[4].x, eye[2].y - eye[4].y)
    const c = Math.hypot(eye[0].x - eye[3].x, eye[0].y - eye[3].y)
    return (a + b) / (2 * c)
  }

  const left = ear(leftEye as EyePoint[])
  const right = ear(rightEye as EyePoint[])

  // Use the minimum of the two eyes. A blink is bilateral, but landmark noise
  // and head pose can make one eye's EAR respond better than the other; the
  // smaller value is the more reliable "eyes are closing" signal and avoids
  // the blink being averaged away on a perfectly frontal face.
  return Math.min(left, right)
}

/**
 * Fast per-frame pass: detection + landmarks only (no descriptor). Used inside
 * the blink loop so frames are processed quickly enough to actually catch a
 * blink (a full descriptor pass is ~2-4x slower and routinely misses the brief
 * closed-eye moment). A smaller inputSize trades a little accuracy for speed,
 * which is what lets us observe the closed-eye frame at all.
 */
async function detectFaceLandmarks(video: HTMLVideoElement): Promise<LandmarkOnly | null> {
  try {
    const detection = await faceapi
      .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: LANDMARKS_INPUT_SIZE }))
      .withFaceLandmarks()
    if (!detection) {
      DBG('no face detected this frame')
    }
    return detection ?? null
  } catch (e) {
    DBG('detectFaceLandmarks error', e)
    return null
  }
}

/**
 * Full pass (detection + landmarks + descriptor). Only run once a blink has
 * been detected, so the expensive descriptor work never slows the blink loop.
 *
 * Tries progressively smaller detector input sizes. TinyFaceDetector misses
 * very large faces at bigger inputSizes, and a straight, centered face fills
 * the frame — so we start at 320 but fall back to 224 then 160 (which is what
 * the blink loop uses) rather than failing on an otherwise-perfect face.
 */
async function detectFaceDescriptor(video: HTMLVideoElement): Promise<LandmarkDet | null> {
  for (const inputSize of [320, 224, 160]) {
    try {
      const detection = await faceapi
        .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize }))
        .withFaceLandmarks()
        .withFaceDescriptor()
      if (detection) return detection
    } catch (e) {
      DBG(`detectFaceDescriptor error (inputSize=${inputSize})`, e)
    }
  }
  DBG('detectFaceDescriptor found no face at any inputSize')
  return null
}

export interface FaceCaptureResult {
  success: boolean
  reason: string
  descriptors: FaceDescriptor[]
  blinksDetected: number
}

export async function waitForVideo(video: HTMLVideoElement, timeoutMs = 10000): Promise<void> {
  if (video.readyState >= 2) return
  const started = Date.now()
  await new Promise<void>((resolve, reject) => {
    const check = () => {
      if (video.readyState >= 2) resolve()
      else if (Date.now() - started > timeoutMs) reject(new Error('Camera feed did not start in time'))
      else setTimeout(check, 100)
    }
    check()
  })
}

function matchesEnrolled(descriptor: FaceDescriptor, enrolled: FaceDescriptor[]): boolean {
  if (enrolled.length === 0) return false
  const distance = Math.min(...enrolled.map((e) => euclideanDistance(e, descriptor)))
  return distance <= MATCH_DISTANCE
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export type FaceDistance = 'none' | 'close' | 'far' | 'ok'

/**
 * Runs a blink-liveness burst against the live video feed.
 *
 *  - enroll: requires at least one blink and returns the best open-eye
 *    descriptor of the sole person on-screen. Persists it locally and uploads
 *    it to the server when online.
 *  - verify: additionally requires the captured descriptor to match the given
 *    enrolled template before reporting success.
 */
export async function runFaceBurst(
  video: HTMLVideoElement,
  options: {
    mode: 'enroll' | 'verify'
    userId: number
    enrolled: FaceDescriptor[]
    onStatus?: (message: string) => void
    onDistance?: (state: FaceDistance) => void
  },
): Promise<FaceCaptureResult> {
  await ensureModels()
  await waitForVideo(video)

  const { mode, userId, enrolled, onStatus, onDistance } = options

  let wasOpen = false
  let blinksDetected = 0
  let lastMatch = false
  let faceFramed = false
  let lastDistance: FaceDistance = 'none'
  let earBaseline = 0
  let prevEar: number | null = null
  let pendingDistance: FaceDistance = 'none'
  let pendingDistanceFrames = 0

  const reportDistance = (landmarks: LandmarkOnly | null): void => {
    if (!landmarks || !onDistance) return
    const width = video.videoWidth || 640
    const faceWidth = landmarks.detection.box.width
    const ratio = width > 0 ? faceWidth / width : 0
    // Recalibrated to the on-screen oval (≈58% of frame width): the intended
    // distance leaves a little breathing room, so "close" starts at 0.62 and
    // "far" at 0.28. (The old far bound of 0.18 was unreachable — such a tiny
    // face is usually not detected at all.)
    const state: FaceDistance = ratio > 0.62 ? 'close' : ratio < 0.28 ? 'far' : 'ok'
    // Hysteresis: a candidate state must hold for several consecutive frames
    // before it is committed, so jitter around a threshold can't flicker the UI.
    if (state === pendingDistance) {
      pendingDistanceFrames++
    } else {
      pendingDistance = state
      pendingDistanceFrames = 1
    }
    if (pendingDistanceFrames >= DISTANCE_HOLD_FRAMES && pendingDistance !== lastDistance) {
      lastDistance = pendingDistance
      DBG(`distance=${lastDistance} ratio=${ratio.toFixed(2)}`)
      onDistance(lastDistance)
    }
  }

  const started = Date.now()
  let framesProcessed = 0
  DBG(`runFaceBurst mode=${mode} userId=${userId} enrolled=${enrolled.length} burstMs=${BURST_MS}`)

  while (Date.now() - started < BURST_MS) {
    const landmarks = await detectFaceLandmarks(video)
    framesProcessed++

    if (!landmarks) {
      faceFramed = false
      if (lastDistance !== 'none') {
        lastDistance = 'none'
        pendingDistance = 'none'
        pendingDistanceFrames = 0
        onDistance?.('none')
      }
      onStatus?.('Look at the camera')
      continue
    }

    faceFramed = true
    reportDistance(landmarks)
    const ear = computeEar(landmarks)
    let isOpen = false
    let isClosed = false

    if (ear !== null) {
      // Track a decaying "open eyes" baseline so the blink thresholds adapt to
      // distance and lighting instead of relying on fixed EAR numbers.
      if (ear > earBaseline) {
        earBaseline = ear
      } else {
        earBaseline *= EAR_BASELINE_DECAY
      }

      const openThreshold = Math.max(EAR_OPEN_THRESHOLD, earBaseline * 0.78)
      const closedThreshold = Math.max(EAR_MIN_CLOSED, earBaseline * EAR_CLOSED_RATIO)
      const dipThreshold = earBaseline * EAR_DIP_RATIO
      isOpen = ear > openThreshold
      isClosed = ear < closedThreshold
      const isDip = ear < dipThreshold
      // A sharp drop between consecutive samples is the most reliable blink
      // signal: with a fast (~10-20fps) loop a blink is usually caught mid-way
      // as a big EAR decrease, even if the fully-closed frame is never seen.
      const sharpDrop = prevEar !== null && ear < prevEar - EAR_DROP_DELTA

      if (ear < 0.36 || isClosed || isDip) {
        DBG(`ear=${ear.toFixed(3)} baseline=${earBaseline.toFixed(3)} dipThr=${dipThreshold.toFixed(3)} closedThr=${closedThreshold.toFixed(3)} open=${isOpen} closed=${isClosed} dip=${isDip} drop=${sharpDrop} wasOpen=${wasOpen} blinks=${blinksDetected}`)
      }

      // Blink = eyes were clearly open (either flagged open this session, or
      // the adaptive baseline says the eyes are wide enough), then the eye
      // open-ness drops sharply. A "dip" (partial closure) or a big drop
      // between frames counts too, because at the loop's sampling rate a blink
      // is often only half-caught and never reaches the absolute closed floor.
      const healthyOpen = wasOpen || earBaseline >= EAR_BASELINE_MIN
      if ((isClosed || isDip || sharpDrop) && healthyOpen) {
        blinksDetected++
        DBG(`BLINK #${blinksDetected} detected (ear=${ear.toFixed(3)})`)
        onStatus?.(`Blink detected (${blinksDetected}/${MIN_BLINKS}) — hold still`)
        wasOpen = false
      } else if (isOpen) {
        wasOpen = true
      }

      prevEar = ear
    } else {
      prevEar = null
    }

    if (blinksDetected >= MIN_BLINKS) {
      // Blink confirmed — now run the expensive descriptor pass once and
      // finish, instead of computing a descriptor on every frame.
      DBG('blink confirmed — running descriptor pass')
      onStatus?.('Face captured — verifying…')
      const full = await detectFaceDescriptor(video)

      if (full) {
        const raw = Array.from(full.descriptor)
        if (mode === 'verify') {
          lastMatch = matchesEnrolled(raw, enrolled)
          DBG(`verify match=${lastMatch} (distance vs enrolled computed)`)
          if (lastMatch) {
            DBG('VERIFY SUCCESS')
            return {
              success: true,
              reason: 'Verified',
              descriptors: [raw],
              blinksDetected,
            }
          }
          onStatus?.('Face did not match — hold still')
          await sleep(100)
        } else {
          DBG('capturing enrollment samples')
          onStatus?.('Face captured — saving…')
          const samples: FaceDescriptor[] = [raw]
          const extraStart = Date.now()
          while (samples.length < ENROLL_SAMPLES && Date.now() - extraStart < 1500) {
            const d = await detectFaceDescriptor(video)
            if (d) {
              samples.push(Array.from(d.descriptor))
            }
            await sleep(80)
          }
          DBG(`saving ${samples.length} descriptors locally`)
          await saveFaceEnrollmentLocal(userId, samples)
          try {
            await uploadFaceEnrollment(userId, samples)
            DBG('uploaded enrollment to server')
          } catch (e) {
            DBG('upload FAILED (offline ok)', e)
          }
          DBG('ENROLL SUCCESS')
          return {
            success: true,
            reason: 'Face enrolled',
            descriptors: samples,
            blinksDetected,
          }
        }
      } else {
        DBG('descriptor pass found no face')
        onStatus?.('Face lost — keep your face in the oval')
        await sleep(100)
      }
    }

    onStatus?.(
      faceFramed
        ? isClosed
          ? 'Open your eyes, then blink'
          : blinksDetected > 0
            ? 'Hold still…'
            : 'Blink now to confirm'
        : 'Look at the camera',
    )
  }

  DBG(`burst ended after ${Date.now() - started}ms: frames=${framesProcessed} blinks=${blinksDetected} faceFramed=${faceFramed} lastMatch=${lastMatch}`)

  if (mode === 'enroll') {
    return {
      success: false,
      reason:
        blinksDetected < MIN_BLINKS
          ? faceFramed
            ? 'Blink was not detected. Keep your eyes open, then blink clearly — try again.'
            : 'No face was detected. Center your face in the oval and try again.'
          : 'Enrollment interrupted — try again',
      descriptors: [],
      blinksDetected,
    }
  }

  return {
    success: false,
    reason: blinksDetected < MIN_BLINKS
      ? 'Blink was not detected. Keep your eyes open, then blink clearly — try again.'
      : 'Face did not match',
    descriptors: [],
    blinksDetected,
  }
}
