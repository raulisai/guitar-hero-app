import { useState, useRef, useCallback, useEffect } from 'react'
import * as Tone from 'tone'
import { calculateLatencyOffset } from '../utils/calibrationUtils'
import { useGameStore } from '../store/useGameStore'
import { useAudioDetection } from '../hooks/useAudioDetection'

const CALIBRATION_BEATS = 10
const BPM = 60

interface CalibrationProps {
  onComplete: () => void
}

export function Calibration({ onComplete }: CalibrationProps) {
  const [phase, setPhase] = useState<'instructions' | 'recording' | 'done'>('instructions')
  const [clickCount, setClickCount] = useState(0)

  const samplesRef = useRef<{ expectedTime: number; detectedTime: number }[]>([])
  const lastDetectedTimeRef = useRef<number>(0)

  const { setLatencyOffset, detectedNote } = useGameStore()
  const { startListening } = useAudioDetection()

  // Track the latest detected note timestamp for calibration sampling
  useEffect(() => {
    if (detectedNote) {
      lastDetectedTimeRef.current = detectedNote.timestamp
    }
  }, [detectedNote])

  const startCalibration = useCallback(async () => {
    await startListening()
    setPhase('recording')
    samplesRef.current = []
    let beat = 0

    await Tone.start()
    Tone.getTransport().bpm.value = BPM

    const loop = new Tone.Loop((time) => {
      // Click sound
      const synth = new Tone.Synth({
        oscillator: { type: 'square' },
        envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.1 },
      }).toDestination()
      synth.triggerAttackRelease('C5', '16n', time)

      const expectedTime = Tone.now() * 1000

      // Wait 500ms then record the guitarist's response
      setTimeout(() => {
        if (lastDetectedTimeRef.current > 0) {
          samplesRef.current.push({
            expectedTime,
            detectedTime: lastDetectedTimeRef.current,
          })
        }

        beat++
        setClickCount(beat)

        if (beat >= CALIBRATION_BEATS) {
          loop.stop()
          Tone.getTransport().stop()

          const offset = calculateLatencyOffset(samplesRef.current)
          setLatencyOffset(offset)
          setPhase('done')

          setTimeout(onComplete, 2000)
        }
      }, 500)
    }, '4n')

    loop.start(0)
    Tone.getTransport().start()
  }, [startListening, setLatencyOffset, onComplete])

  if (phase === 'instructions') {
    return (
      <div className="max-w-md mx-auto p-6 text-center">
        <h2 className="text-xl font-bold mb-4">Calibración de latencia</h2>
        <p className="text-gray-600 mb-6">
          Escucharás {CALIBRATION_BEATS} clicks. Toca cualquier nota en tu guitarra con cada
          click lo más exacto posible. Esto compensa el retraso de tu micrófono.
        </p>
        <button
          onClick={startCalibration}
          className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-bold transition-colors"
        >
          Comenzar calibración
        </button>
      </div>
    )
  }

  if (phase === 'recording') {
    return (
      <div className="max-w-md mx-auto p-6 text-center">
        <div className="text-5xl mb-4">🎸</div>
        <p className="text-xl mb-6 font-semibold">¡Toca con cada click!</p>
        <div className="flex gap-2 justify-center flex-wrap">
          {Array.from({ length: CALIBRATION_BEATS }).map((_, i) => (
            <div
              key={i}
              className={`w-5 h-5 rounded-full transition-colors ${
                i < clickCount ? 'bg-green-500' : 'bg-gray-300'
              }`}
            />
          ))}
        </div>
        <p className="text-sm text-gray-500 mt-4">
          {clickCount} / {CALIBRATION_BEATS}
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto p-6 text-center">
      <div className="text-5xl mb-4">✅</div>
      <p className="text-xl font-bold text-green-600">¡Calibración completa!</p>
    </div>
  )
}
