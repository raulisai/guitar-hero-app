import { useEffect, useRef } from 'react'
import { useAudioDetection } from '../hooks/useAudioDetection'
import { useGameStore } from '../store/useGameStore'

const W = 180  // waveform canvas width
const H = 36   // waveform canvas height

export function PitchOverlay() {
  const { isListening, isRequesting, error, startListening, stopListening, analyserRef } = useAudioDetection()
  const { detectedNote, expectedNote } = useGameStore()

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const waveFrameRef = useRef<number>(0)
  // Ref so draw loop always sees latest detection state without re-registering
  const waveColorRef = useRef('#444')

  const matches =
    detectedNote &&
    expectedNote &&
    Math.abs(detectedNote.midi - expectedNote.midi) <= 1

  // Keep color ref in sync with detection state
  waveColorRef.current = matches ? '#22c55e' : detectedNote ? '#e5e5e5' : '#444'

  // Waveform draw loop — starts/stops with listening state
  useEffect(() => {
    if (!isListening) {
      cancelAnimationFrame(waveFrameRef.current)
      // Clear canvas when mic stops
      const canvas = canvasRef.current
      if (canvas) {
        const ctx = canvas.getContext('2d')
        ctx?.clearRect(0, 0, W, H)
      }
      return
    }

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const data = new Float32Array(BUFFER_SIZE_FOR_DISPLAY)

    const draw = () => {
      waveFrameRef.current = requestAnimationFrame(draw)

      const analyser = analyserRef.current
      if (!analyser) return

      // Grab time-domain data for waveform display
      const bufLen = Math.min(analyser.fftSize, data.length)
      analyser.getFloatTimeDomainData(data)

      ctx.clearRect(0, 0, W, H)

      // Draw center line
      ctx.strokeStyle = '#222'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, H / 2)
      ctx.lineTo(W, H / 2)
      ctx.stroke()

      // Draw waveform
      ctx.strokeStyle = waveColorRef.current
      ctx.lineWidth = 1.5
      ctx.beginPath()

      const step = bufLen / W
      for (let i = 0; i < W; i++) {
        const sample = data[Math.floor(i * step)] ?? 0
        const y = ((sample + 1) / 2) * H
        if (i === 0) ctx.moveTo(i, y)
        else ctx.lineTo(i, y)
      }
      ctx.stroke()
    }

    draw()
    return () => cancelAnimationFrame(waveFrameRef.current)
  }, [isListening, analyserRef])

  return (
    <div
      style={{
        background: 'rgba(15,15,15,0.92)',
        border: '1px solid #2a2a2a',
        borderRadius: 10,
        padding: '8px 10px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        minWidth: W + 20,
      }}
    >
      {/* Top row: mic button + note info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Mic toggle */}
        <button
          onClick={isListening ? stopListening : startListening}
          disabled={isRequesting}
          title={isListening ? 'Desactivar micrófono' : 'Activar micrófono'}
          style={{
            width: 28, height: 28, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: isListening ? '#22c55e' : isRequesting ? '#2a2a2a' : '#2a2a2a',
            color: isListening ? '#000' : isRequesting ? '#555' : '#888',
            border: 'none', cursor: isRequesting ? 'default' : 'pointer', flexShrink: 0,
            transition: 'background 0.15s',
            opacity: isRequesting ? 0.6 : 1,
          }}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 14, height: 14 }}>
            <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm0 2a2 2 0 0 0-2 2v6a2 2 0 0 0 4 0V5a2 2 0 0 0-2-2z" />
            <path d="M19 11a1 1 0 0 1 1 1 8 8 0 0 1-7 7.94V22h2a1 1 0 0 1 0 2H9a1 1 0 0 1 0-2h2v-2.06A8 8 0 0 1 4 12a1 1 0 0 1 2 0 6 6 0 0 0 12 0 1 1 0 0 1 1-1z" />
          </svg>
        </button>

        {error ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 10, color: '#ef4444', maxWidth: 120, lineHeight: 1.3 }}>{error}</span>
            <button
              onClick={startListening}
              style={{
                fontSize: 10, padding: '2px 8px', borderRadius: 4,
                background: '#2a2a2a', color: '#aaa', border: '1px solid #444',
                cursor: 'pointer',
              }}
            >
              Reintentar
            </button>
          </div>
        ) : isRequesting ? (
          <span style={{ fontSize: 11, color: '#888' }}>Solicitando acceso…</span>
        ) : isListening ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Detected note */}
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: 16, fontWeight: 700, lineHeight: 1,
                color: matches ? '#22c55e' : detectedNote ? '#fff' : '#444',
              }}>
                {detectedNote ? detectedNote.name : '—'}
              </div>
              <div style={{ fontSize: 10, color: '#555', marginTop: 2 }}>tocando</div>
            </div>

            <div style={{ color: '#333', fontSize: 12 }}>→</div>

            {/* Expected note */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1, color: '#3b82f6' }}>
                {expectedNote ? expectedNote.name : '—'}
              </div>
              <div style={{ fontSize: 10, color: '#555', marginTop: 2 }}>esperada</div>
            </div>
          </div>
        ) : (
          <span style={{ fontSize: 11, color: '#555' }}>Mic apagado</span>
        )}
      </div>

      {/* Waveform canvas */}
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        style={{
          display: 'block',
          borderRadius: 4,
          background: '#0a0a0a',
          border: '1px solid #1a1a1a',
        }}
      />
    </div>
  )
}

// How many samples to read for the waveform display
const BUFFER_SIZE_FOR_DISPLAY = 4096
