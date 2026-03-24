import { useRef, useEffect } from 'react'
import { useGameStore } from '../store/useGameStore'
import type { NoteResult } from '../types'

const RESULT_COLOR: Record<NoteResult, string> = {
  perfect: '#22c55e',
  good:    '#86efac',
  late:    '#f59e0b',
  early:   '#f59e0b',
  wrong:   '#ef4444',
  miss:    '#6b7280',
}

interface DebugLogProps {
  onClose: () => void
}

export function DebugLog({ onClose }: DebugLogProps) {
  const { attempts } = useGameStore()
  const listRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new attempts arrive
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [attempts.length])

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 480,
        maxHeight: 280,
        background: '#111',
        border: '1px solid #2a2a2a',
        borderBottom: 'none',
        borderRight: 'none',
        borderRadius: '8px 0 0 0',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 15,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 10px',
          borderBottom: '1px solid #1e1e1e',
          background: '#161616',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 600, color: '#888', letterSpacing: '0.05em' }}>
          DEBUG · {attempts.length} notas
        </span>
        <button
          onClick={onClose}
          style={{
            fontSize: 10, padding: '2px 8px', borderRadius: 4,
            background: 'transparent', color: '#555', border: '1px solid #2a2a2a',
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#aaa')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#555')}
        >
          ✕
        </button>
      </div>

      {/* Column headers */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '48px 52px 52px 52px 60px 52px',
          padding: '4px 10px',
          gap: 4,
          background: '#141414',
          borderBottom: '1px solid #1e1e1e',
          flexShrink: 0,
        }}
      >
        {['C·B', 'Esperada', 'Midi', 'Detectada', 'Resultado', 'ms'].map((h) => (
          <span key={h} style={{ fontSize: 9, color: '#444', fontWeight: 600, letterSpacing: '0.04em' }}>
            {h}
          </span>
        ))}
      </div>

      {/* Rows */}
      <div
        ref={listRef}
        style={{ overflowY: 'auto', flex: 1 }}
      >
        {attempts.length === 0 ? (
          <div style={{ padding: '16px 10px', fontSize: 11, color: '#333', textAlign: 'center' }}>
            Sin intentos aún — inicia la canción
          </div>
        ) : (
          attempts.map((attempt, i) => {
            const isHit = ['perfect', 'good', 'late', 'early'].includes(attempt.result)
            return (
              <div
                key={i}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '48px 52px 52px 52px 60px 52px',
                  padding: '3px 10px',
                  gap: 4,
                  borderBottom: '1px solid #161616',
                  background: i % 2 === 0 ? 'transparent' : '#0d0d0d',
                  alignItems: 'center',
                }}
              >
                {/* Bar·Beat */}
                <span style={{ fontSize: 10, color: '#555' }}>
                  {attempt.expected.bar + 1}·{attempt.expected.beat + 1}
                </span>

                {/* Expected note */}
                <span style={{ fontSize: 11, fontWeight: 600, color: '#3b82f6' }}>
                  {attempt.expected.name}
                </span>

                {/* Expected midi */}
                <span style={{ fontSize: 10, color: '#444' }}>
                  {attempt.expected.midi}
                </span>

                {/* Detected note */}
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: attempt.detected
                      ? isHit ? '#22c55e' : '#ef4444'
                      : '#444',
                  }}
                >
                  {attempt.detected ? attempt.detected.name : '—'}
                  {attempt.detected && (
                    <span style={{ fontSize: 9, color: '#555', fontWeight: 400, marginLeft: 2 }}>
                      ({attempt.detected.midi})
                    </span>
                  )}
                </span>

                {/* Result */}
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: RESULT_COLOR[attempt.result],
                    letterSpacing: '0.03em',
                  }}
                >
                  {attempt.result.toUpperCase()}
                </span>

                {/* Time diff */}
                <span style={{ fontSize: 10, color: '#555' }}>
                  {attempt.timeDiff !== 0
                    ? `${attempt.timeDiff > 0 ? '+' : ''}${attempt.timeDiff}ms`
                    : '—'}
                </span>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
