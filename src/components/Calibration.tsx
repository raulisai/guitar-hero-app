import { useState, useRef, useCallback, useEffect } from 'react'
import * as Tone from 'tone'
import { calculateLatencyOffset } from '../utils/calibrationUtils'
import { useGameStore } from '../store/useGameStore'
import { useAudioDetection } from '../hooks/useAudioDetection'
import { hzToCents, OPEN_STRINGS } from '../utils/noteUtils'

const CALIBRATION_BEATS = 10
const BPM = 60

interface CalibrationProps {
  onComplete: () => void
}

type Tab = 'tuner' | 'latency'

// ─── Tuner needle ─────────────────────────────────────────────────────────────
function TunerNeedle({ cents }: { cents: number }) {
  const clamped = Math.max(-50, Math.min(50, cents))
  const pct = (clamped + 50) / 100           // 0..1
  const color =
    Math.abs(cents) <= 10 ? '#22c55e'
    : Math.abs(cents) <= 25 ? '#f59e0b'
    : '#ef4444'

  return (
    <div className="relative w-full" style={{ height: 28 }}>
      {/* Background track */}
      <div
        className="absolute inset-0 rounded-full"
        style={{ background: '#2a2a2a', top: 10, height: 8 }}
      />
      {/* Green center zone ±10 cents */}
      <div
        className="absolute rounded-full"
        style={{
          background: '#22c55e22',
          border: '1px solid #22c55e44',
          left: '40%',
          width: '20%',
          top: 10,
          height: 8,
        }}
      />
      {/* Center line */}
      <div
        className="absolute"
        style={{ left: '50%', top: 6, width: 1, height: 16, background: '#555' }}
      />
      {/* Needle */}
      <div
        className="absolute transition-all duration-75"
        style={{
          left: `calc(${pct * 100}% - 5px)`,
          top: 4,
          width: 10,
          height: 20,
          borderRadius: 3,
          background: color,
          boxShadow: `0 0 6px ${color}88`,
        }}
      />
      {/* Labels */}
      <div className="absolute flex justify-between w-full" style={{ top: 20, fontSize: 9, color: '#555' }}>
        <span>-50¢</span>
        <span style={{ color: '#22c55e' }}>♦</span>
        <span>+50¢</span>
      </div>
    </div>
  )
}

// ─── String indicators ────────────────────────────────────────────────────────
function StringIndicators({ detectedMidi }: { detectedMidi: number | null }) {
  return (
    <div className="flex gap-2 justify-center">
      {OPEN_STRINGS.map((s) => {
        const diff = detectedMidi !== null ? Math.abs(detectedMidi - s.midi) : 99
        const active = diff <= 3
        return (
          <div
            key={s.string}
            className="flex flex-col items-center gap-0.5"
            style={{ opacity: active ? 1 : 0.35 }}
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all"
              style={{
                background: active ? '#22c55e22' : '#1e1e1e',
                border: `1px solid ${active ? '#22c55e' : '#333'}`,
                color: active ? '#22c55e' : '#555',
                boxShadow: active ? '0 0 8px #22c55e44' : 'none',
              }}
            >
              {s.string}
            </div>
            <span style={{ fontSize: 9, color: active ? '#22c55e' : '#444' }}>{s.name}</span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Signal meter ─────────────────────────────────────────────────────────────
function SignalMeter({ rms, noiseFloor }: { rms: number; noiseFloor: number }) {
  const MAX_RMS = 0.3
  const pct = Math.min(rms / MAX_RMS, 1) * 100
  const floorPct = Math.min(noiseFloor / MAX_RMS, 1) * 100
  const color = rms > noiseFloor * 2 ? '#22c55e' : rms > noiseFloor ? '#f59e0b' : '#444'

  return (
    <div className="relative w-full rounded-full overflow-hidden" style={{ height: 6, background: '#1e1e1e' }}>
      <div
        className="absolute left-0 top-0 h-full rounded-full transition-all duration-75"
        style={{ width: `${pct}%`, background: color }}
      />
      {/* Noise floor marker */}
      <div
        className="absolute top-0 h-full"
        style={{ left: `${floorPct}%`, width: 2, background: '#ef4444aa' }}
      />
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export function Calibration({ onComplete }: CalibrationProps) {
  const [tab, setTab] = useState<Tab>('tuner')
  const [latencyPhase, setLatencyPhase] = useState<'idle' | 'recording' | 'done'>('idle')
  const [clickCount, setClickCount] = useState(0)
  const [measuredLatency, setMeasuredLatency] = useState<number | null>(null)
  const [rms, setRms] = useState(0)
  const [calibratingNoise, setCalibratingNoise] = useState(false)
  const [noiseCountdown, setNoiseCountdown] = useState(3)

  const samplesRef = useRef<{ expectedTime: number; detectedTime: number }[]>([])
  const lastDetectedTimeRef = useRef<number>(0)
  const rmsFrameRef = useRef<number>(0)

  const { setLatencyOffset, setNoiseFloor, noiseFloor, latencyOffset, isCalibrated, detectedNote } = useGameStore()
  const { isListening, startListening, analyserRef, measureAmbientRms } = useAudioDetection()

  // Track latest detected timestamp for latency sampling
  useEffect(() => {
    if (detectedNote) lastDetectedTimeRef.current = detectedNote.timestamp
  }, [detectedNote])

  // Live RMS meter loop
  useEffect(() => {
    if (!isListening) { setRms(0); return }

    const tick = () => {
      const analyser = analyserRef.current
      if (!analyser) { rmsFrameRef.current = requestAnimationFrame(tick); return }
      const buf = new Float32Array(analyser.fftSize)
      analyser.getFloatTimeDomainData(buf)
      let sum = 0
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i]
      setRms(Math.sqrt(sum / buf.length))
      rmsFrameRef.current = requestAnimationFrame(tick)
    }
    rmsFrameRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rmsFrameRef.current)
  }, [isListening, analyserRef])

  // Start mic on mount
  useEffect(() => {
    if (!isListening) startListening()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Tuner data ─────────────────────────────────────────────────────────────
  const tunerData = detectedNote?.frequency ? hzToCents(detectedNote.frequency) : null

  // ── Noise calibration ─────────────────────────────────────────────────────
  const handleCalibrateNoise = useCallback(async () => {
    if (!isListening) await startListening()
    setCalibratingNoise(true)
    setNoiseCountdown(3)

    // Countdown
    for (let i = 3; i > 0; i--) {
      setNoiseCountdown(i)
      await new Promise((r) => setTimeout(r, 1000))
    }

    const avgRms = await measureAmbientRms(2000)
    // Set floor = ambient + 50% headroom, minimum 0.005
    const floor = Math.max(0.005, avgRms * 1.5)
    setNoiseFloor(Math.round(floor * 1000) / 1000)
    setCalibratingNoise(false)
  }, [isListening, startListening, measureAmbientRms, setNoiseFloor])

  // ── Latency calibration ───────────────────────────────────────────────────
  const startLatencyCalibration = useCallback(async () => {
    if (!isListening) await startListening()
    setLatencyPhase('recording')
    setClickCount(0)
    samplesRef.current = []
    let beat = 0

    await Tone.start()
    Tone.getTransport().bpm.value = BPM

    const loop = new Tone.Loop((time) => {
      const synth = new Tone.Synth({
        oscillator: { type: 'square' },
        envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.1 },
      }).toDestination()
      synth.triggerAttackRelease('C5', '16n', time)

      const expectedTime = Tone.now() * 1000

      setTimeout(() => {
        if (lastDetectedTimeRef.current > 0) {
          samplesRef.current.push({ expectedTime, detectedTime: lastDetectedTimeRef.current })
        }
        beat++
        setClickCount(beat)

        if (beat >= CALIBRATION_BEATS) {
          loop.stop()
          Tone.getTransport().stop()
          const offset = calculateLatencyOffset(samplesRef.current)
          setLatencyOffset(offset)
          setMeasuredLatency(offset)
          setLatencyPhase('done')
          setTimeout(onComplete, 2500)
        }
      }, 500)
    }, '4n')

    loop.start(0)
    Tone.getTransport().start()
  }, [isListening, startListening, setLatencyOffset, onComplete])

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      className="flex flex-col"
      style={{
        width: 480,
        background: '#161616',
        borderRadius: 12,
        border: '1px solid #2a2a2a',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3"
        style={{ borderBottom: '1px solid #222' }}
      >
        <span className="font-bold text-sm" style={{ color: '#e5e5e5' }}>
          Calibración
        </span>
        <button
          onClick={onComplete}
          className="text-xs px-3 py-1 rounded transition-colors"
          style={{ color: '#666', border: '1px solid #2a2a2a' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#ccc')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#666')}
        >
          Cerrar
        </button>
      </div>

      {/* Tabs */}
      <div className="flex" style={{ borderBottom: '1px solid #222' }}>
        {(['tuner', 'latency'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-5 py-2.5 text-xs font-medium transition-colors"
            style={{
              color: tab === t ? '#22c55e' : '#555',
              borderBottom: tab === t ? '2px solid #22c55e' : '2px solid transparent',
              background: 'transparent',
            }}
          >
            {t === 'tuner' ? 'Afinador' : 'Latencia'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-5" style={{ minHeight: 320 }}>
        {tab === 'tuner' && (
          <div className="flex flex-col gap-5">
            {/* Mic status */}
            <div className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full"
                style={{ background: isListening ? '#22c55e' : '#444', boxShadow: isListening ? '0 0 6px #22c55e' : 'none' }}
              />
              <span className="text-xs" style={{ color: '#555' }}>
                {isListening ? 'Micrófono activo' : 'Micrófono inactivo'}
              </span>
            </div>

            {/* Detected note */}
            <div className="flex flex-col items-center gap-1">
              <div
                className="text-6xl font-bold transition-all"
                style={{ color: tunerData ? '#e5e5e5' : '#2a2a2a', letterSpacing: '-2px' }}
              >
                {tunerData?.name ?? '—'}
              </div>
              {detectedNote?.frequency ? (
                <div className="text-xs" style={{ color: '#555' }}>
                  {detectedNote.frequency.toFixed(1)} Hz
                  {tunerData && (
                    <span style={{ color: Math.abs(tunerData.cents) <= 10 ? '#22c55e' : '#f59e0b', marginLeft: 8 }}>
                      {tunerData.cents >= 0 ? '+' : ''}{tunerData.cents}¢
                    </span>
                  )}
                </div>
              ) : (
                <div className="text-xs" style={{ color: '#333' }}>Toca una nota…</div>
              )}
            </div>

            {/* Cents needle */}
            <TunerNeedle cents={tunerData?.cents ?? 0} />

            {/* Open string indicators */}
            <StringIndicators detectedMidi={tunerData?.midi ?? null} />

            {/* Signal meter */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-xs" style={{ color: '#444' }}>
                <span>Señal</span>
                <span>Umbral ruido: {noiseFloor.toFixed(3)}</span>
              </div>
              <SignalMeter rms={rms} noiseFloor={noiseFloor} />
            </div>

            {/* Noise calibration */}
            <div
              className="rounded-lg p-3 flex items-center justify-between gap-3"
              style={{ background: '#1e1e1e', border: '1px solid #2a2a2a' }}
            >
              <div>
                <div className="text-xs font-medium" style={{ color: '#ccc' }}>
                  Calibrar ruido de fondo
                </div>
                <div className="text-xs" style={{ color: '#444' }}>
                  No toques nada y pulsa el botón
                </div>
              </div>
              <button
                onClick={handleCalibrateNoise}
                disabled={calibratingNoise}
                className="text-xs px-3 py-1.5 rounded font-medium transition-colors shrink-0 disabled:opacity-50"
                style={{ background: '#22c55e22', color: '#22c55e', border: '1px solid #22c55e44' }}
              >
                {calibratingNoise ? `${noiseCountdown}s…` : 'Auto'}
              </button>
            </div>
          </div>
        )}

        {tab === 'latency' && (
          <div className="flex flex-col gap-5">
            {latencyPhase === 'idle' && (
              <>
                <div className="text-center">
                  <div className="text-xs" style={{ color: '#555', marginBottom: 12, lineHeight: 1.6 }}>
                    Escucharás {CALIBRATION_BEATS} clicks a {BPM} BPM.<br />
                    Toca cualquier nota en tu guitarra con cada click lo más exacto posible.<br />
                    Esto compensa el retraso del micrófono.
                  </div>

                  {isCalibrated && (
                    <div
                      className="rounded-lg p-3 mb-4 text-xs"
                      style={{ background: '#22c55e11', border: '1px solid #22c55e33', color: '#22c55e' }}
                    >
                      Latencia actual: <strong>{latencyOffset} ms</strong>
                    </div>
                  )}

                  <button
                    onClick={startLatencyCalibration}
                    className="px-5 py-2.5 rounded-lg font-bold text-sm transition-colors"
                    style={{ background: '#22c55e', color: '#000' }}
                  >
                    Comenzar calibración
                  </button>
                </div>

                {/* Signal meter in latency tab too */}
                <div className="flex flex-col gap-1 mt-2">
                  <div className="flex justify-between text-xs" style={{ color: '#444' }}>
                    <span>Señal micrófono</span>
                  </div>
                  <SignalMeter rms={rms} noiseFloor={noiseFloor} />
                  <div className="text-xs text-center mt-1" style={{ color: '#333' }}>
                    {isListening ? (rms > noiseFloor ? 'Detectando señal ✓' : 'Sin señal — toca una nota') : 'Micrófono inactivo'}
                  </div>
                </div>
              </>
            )}

            {latencyPhase === 'recording' && (
              <div className="flex flex-col items-center gap-5">
                <div className="text-3xl">🎸</div>
                <p className="text-sm font-semibold" style={{ color: '#e5e5e5' }}>
                  ¡Toca con cada click!
                </p>
                <div className="flex gap-2 flex-wrap justify-center">
                  {Array.from({ length: CALIBRATION_BEATS }).map((_, i) => (
                    <div
                      key={i}
                      className="w-4 h-4 rounded-full transition-colors"
                      style={{ background: i < clickCount ? '#22c55e' : '#2a2a2a' }}
                    />
                  ))}
                </div>
                <div className="text-xs" style={{ color: '#555' }}>
                  {clickCount} / {CALIBRATION_BEATS}
                </div>
                <SignalMeter rms={rms} noiseFloor={noiseFloor} />
              </div>
            )}

            {latencyPhase === 'done' && (
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="text-4xl">✅</div>
                <p className="font-bold" style={{ color: '#22c55e' }}>
                  ¡Calibración completa!
                </p>
                <div
                  className="rounded-lg px-4 py-3 text-sm"
                  style={{ background: '#22c55e11', border: '1px solid #22c55e33', color: '#ccc' }}
                >
                  Latencia compensada: <strong style={{ color: '#22c55e' }}>{measuredLatency} ms</strong>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
