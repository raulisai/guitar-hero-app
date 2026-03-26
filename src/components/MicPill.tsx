import { useEffect, useRef } from 'react'
import { useGameStore } from '../store/useGameStore'

interface MicPillProps {
  analyserRef: React.RefObject<AnalyserNode | null>
  error: string | null
}

const W = 72
const H = 18
const BUF = 512

export function MicPill({ analyserRef, error }: MicPillProps) {
  const { detectedNote, expectedNote } = useGameStore()
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const frameRef   = useRef<number>(0)
  const dataRef    = useRef(new Float32Array(BUF))
  const colorRef   = useRef('#444')

  const matches = !!(
    detectedNote &&
    expectedNote &&
    detectedNote.midi === expectedNote.midi
  )

  // Keep color ref fresh so the draw loop uses the latest state
  colorRef.current = matches
    ? '#22c55e'
    : detectedNote ? '#e5e5e5' : '#444'

  // Waveform RAF loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const draw = () => {
      frameRef.current = requestAnimationFrame(draw)
      const analyser = analyserRef.current
      if (!analyser) return
      analyser.getFloatTimeDomainData(dataRef.current)

      ctx.clearRect(0, 0, W, H)
      ctx.strokeStyle = colorRef.current
      ctx.lineWidth = 1.2
      ctx.beginPath()
      const step = BUF / W
      for (let i = 0; i < W; i++) {
        const s = dataRef.current[Math.floor(i * step)] ?? 0
        const y = ((s + 1) / 2) * H
        i === 0 ? ctx.moveTo(i, y) : ctx.lineTo(i, y)
      }
      ctx.stroke()
    }
    draw()
    return () => cancelAnimationFrame(frameRef.current)
  }, [analyserRef])

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 80,   // sits just above the 52px bar + 14px gap
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(13,13,13,0.97)',
        border: `1px solid ${matches ? '#22c55e55' : '#252525'}`,
        borderRadius: 12,
        boxShadow: matches
          ? '0 0 14px rgba(34,197,94,0.18)'
          : '0 4px 20px rgba(0,0,0,0.55)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0 12px',
        height: 40,
        zIndex: 99,
        transition: 'border-color 0.2s, box-shadow 0.2s',
        whiteSpace: 'nowrap',
      }}
    >
      {error ? (
        <span style={{ fontSize: 10, color: '#ef4444', maxWidth: 220 }}>{error}</span>
      ) : (
        <>
          {/* Expected note */}
          <NoteCell label="espera" name={expectedNote?.name ?? '—'} color="#3b82f6" />

          {/* Match arrow */}
          <span style={{
            fontSize: 13,
            color: matches ? '#22c55e' : '#2a2a2a',
            transition: 'color 0.15s',
            lineHeight: 1,
          }}>
            {matches ? '✓' : '→'}
          </span>

          {/* Detected note */}
          <NoteCell
            label="tocando"
            name={detectedNote?.name ?? '—'}
            color={matches ? '#22c55e' : detectedNote ? '#e5e5e5' : '#444'}
          />

          {/* Divider */}
          <div style={{ width: 1, height: 22, background: '#222', flexShrink: 0 }} />

          {/* Mini waveform */}
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            style={{
              display: 'block',
              borderRadius: 3,
              background: '#080808',
              flexShrink: 0,
            }}
          />
        </>
      )}
    </div>
  )
}

function NoteCell({ name, label, color }: { name: string; label: string; color: string }) {
  return (
    <div style={{ textAlign: 'center', minWidth: 26 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color, lineHeight: 1 }}>{name}</div>
      <div style={{ fontSize: 8, color: '#3a3a3a', marginTop: 2, letterSpacing: '0.04em' }}>{label}</div>
    </div>
  )
}
