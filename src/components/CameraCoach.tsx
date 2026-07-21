import { useCallback, useEffect, useRef, useState } from 'react'
import type { HandLandmarker, NormalizedLandmark } from '@mediapipe/tasks-vision'
import { useGameStore } from '../store/useGameStore'
import { FINGER_NAMES } from '../utils/fingeringUtils'

const WASM_ROOT = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm'
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'
const TARGET_FPS = 8
type VisionTasksModule = typeof import('@mediapipe/tasks-vision')

const FINGER_LANDMARKS: Record<number, { mcp: number; pip: number; tip: number }> = {
  1: { mcp: 5, pip: 6, tip: 8 },
  2: { mcp: 9, pip: 10, tip: 12 },
  3: { mcp: 13, pip: 14, tip: 16 },
  4: { mcp: 17, pip: 18, tip: 20 },
}

function jointAngle(a: NormalizedLandmark, b: NormalizedLandmark, c: NormalizedLandmark) {
  const ab = { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }
  const cb = { x: c.x - b.x, y: c.y - b.y, z: c.z - b.z }
  const dot = ab.x * cb.x + ab.y * cb.y + ab.z * cb.z
  const mag = Math.hypot(ab.x, ab.y, ab.z) * Math.hypot(cb.x, cb.y, cb.z)
  return Math.acos(Math.max(-1, Math.min(1, dot / Math.max(mag, 1e-6)))) * (180 / Math.PI)
}

export function CameraCoach() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const landmarkerRef = useRef<HandLandmarker | null>(null)
  const visionModuleRef = useRef<VisionTasksModule | null>(null)
  const frameRef = useRef(0)
  const lastInferenceRef = useRef(0)
  const mountedRef = useRef(true)

  const [active, setActive] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [handFound, setHandFound] = useState(false)
  const [fingerReady, setFingerReady] = useState(false)

  const expected = useGameStore((state) => state.expectedNote)
  const detected = useGameStore((state) => state.detectedNote)
  const finger = expected?.fingerNumber ?? 1
  const audioMatches = !!(expected && detected && (expected.chordMidis?.includes(detected.midi) ?? detected.midi === expected.midi))

  const stop = useCallback(() => {
    cancelAnimationFrame(frameRef.current)
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    if (mountedRef.current) {
      setActive(false)
      setHandFound(false)
      setFingerReady(false)
    }
  }, [])

  const drawAndCoach = useCallback((landmarks: NormalizedLandmark[]) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const visionModule = visionModuleRef.current
    if (!visionModule) return
    const drawing = new visionModule.DrawingUtils(ctx)
    drawing.drawConnectors(landmarks, visionModule.HandLandmarker.HAND_CONNECTIONS, { color: '#525252', lineWidth: 2 })
    drawing.drawLandmarks(landmarks, { color: '#a3a3a3', radius: 2 })

    if (finger > 0) {
      const ids = FINGER_LANDMARKS[finger]
      const selected = [landmarks[ids.mcp], landmarks[ids.pip], landmarks[ids.tip]]
      drawing.drawLandmarks(selected, { color: '#22c55e', fillColor: '#22c55e', radius: 5 })
      const angle = jointAngle(...selected as [NormalizedLandmark, NormalizedLandmark, NormalizedLandmark])
      setFingerReady(angle < 158)
    } else {
      setFingerReady(true)
    }
  }, [finger])

  const loop = useCallback(() => {
    const run = () => {
      frameRef.current = requestAnimationFrame(run)
      const now = performance.now()
      if (document.hidden || now - lastInferenceRef.current < 1000 / TARGET_FPS) return
      const video = videoRef.current
      const canvas = canvasRef.current
      const landmarker = landmarkerRef.current
      if (!video || !canvas || !landmarker || video.readyState < 2) return

      lastInferenceRef.current = now
      canvas.width = video.videoWidth || 640
      canvas.height = video.videoHeight || 360
      const ctx = canvas.getContext('2d')
      ctx?.clearRect(0, 0, canvas.width, canvas.height)

      const result = landmarker.detectForVideo(video, now)
      const landmarks = result.landmarks[0]
      setHandFound(!!landmarks)
      if (landmarks) drawAndCoach(landmarks)
      else setFingerReady(false)
    }
    frameRef.current = requestAnimationFrame(run)
  }, [drawAndCoach])

  const start = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('La cámara requiere HTTPS o localhost.')

      if (!landmarkerRef.current) {
        const visionTasks = await import('@mediapipe/tasks-vision')
        visionModuleRef.current = visionTasks
        const vision = await visionTasks.FilesetResolver.forVisionTasks(WASM_ROOT)
        try {
          landmarkerRef.current = await visionTasks.HandLandmarker.createFromOptions(vision, {
            baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
            runningMode: 'VIDEO',
            numHands: 1,
            minHandDetectionConfidence: 0.55,
            minHandPresenceConfidence: 0.55,
            minTrackingConfidence: 0.55,
          })
        } catch {
          landmarkerRef.current = await visionTasks.HandLandmarker.createFromOptions(vision, {
            baseOptions: { modelAssetPath: MODEL_URL, delegate: 'CPU' },
            runningMode: 'VIDEO',
            numHands: 1,
          })
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 640, max: 960 },
          height: { ideal: 360, max: 540 },
          frameRate: { ideal: 15, max: 24 },
        },
        audio: false,
      })
      streamRef.current = stream
      if (!videoRef.current) return
      videoRef.current.srcObject = stream
      await videoRef.current.play()
      if (!mountedRef.current) return
      setActive(true)
      loop()
    } catch (err) {
      const message = (err as Error).name === 'NotAllowedError'
        ? 'Permiso de cámara denegado.'
        : (err as Error).message || 'No se pudo iniciar el coach de cámara.'
      setError(message)
      stop()
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [loop, stop])

  useEffect(() => () => {
    mountedRef.current = false
    stop()
    landmarkerRef.current?.close()
  }, [stop])

  const coachMessage = !expected
    ? 'Reproduce una canción para comenzar'
    : !handFound
      ? 'Coloca la mano del mástil frente a la cámara'
      : audioMatches && fingerReady
        ? '¡Posición y nota correctas!'
        : !fingerReady
          ? `Curva el dedo ${finger}: ${FINGER_NAMES[finger]}`
          : 'Postura lista · ahora toca la nota'

  return (
    <div className="camera-coach">
      <div className="camera-coach__preview">
        <video ref={videoRef} muted playsInline />
        <canvas ref={canvasRef} />
        {!active && <div className="camera-coach__empty">La cámara está apagada</div>}
      </div>

      <div className="camera-coach__info">
        <span className={`camera-coach__status ${audioMatches && fingerReady ? 'is-correct' : ''}`}>{coachMessage}</span>
        <strong>
          {expected
            ? `${expected.fretNumber === 0 ? 'Al aire' : `Dedo ${finger} · ${FINGER_NAMES[finger]}`} · traste ${expected.fretNumber} · cuerda ${expected.stringNumber}`
            : 'Coach de digitación'}
        </strong>
        <small>Procesamiento local, 8 FPS. La cámara no se graba ni se envía.</small>
        {error && <span className="camera-coach__error">{error}</span>}
        <button onClick={active ? stop : start} disabled={loading}>
          {loading ? 'Cargando modelo…' : active ? 'Apagar cámara' : 'Activar cámara'}
        </button>
      </div>
    </div>
  )
}
