import { useState, useEffect, useRef } from 'react'
import { useGameStore } from '../store/useGameStore'
import type { NoteResult, BeatBounds } from '../types'

interface Particle {
  id: number
  result: NoteResult
  bounds: BeatBounds
}

const LABEL: Record<NoteResult, string> = {
  perfect: '✦ PERFECT',
  good:    '✓ GOOD',
  late:    '↓ TARDE',
  early:   '↑ PRONTO',
  wrong:   '✗ WRONG',
  miss:    '— MISS',
}

const COLOR: Record<NoteResult, string> = {
  perfect: '#22c55e',
  good:    '#86efac',
  late:    '#f59e0b',
  early:   '#f59e0b',
  wrong:   '#ef4444',
  miss:    '#6b7280',
}

let _nextId = 0

export function HitFeedback() {
  const [particles, setParticles] = useState<Particle[]>([])
  const { attempts } = useGameStore()
  const prevLenRef = useRef(0)

  useEffect(() => {
    const len = attempts.length
    if (len <= prevLenRef.current) {
      // Reset on game restart (attempts cleared)
      if (len === 0) prevLenRef.current = 0
      return
    }
    prevLenRef.current = len

    const latest = attempts[len - 1]
    // Capture bounds at evaluation time, before resumePlayback advances the cursor
    const { currentTabBounds, currentBeatBounds } = useGameStore.getState()
    const bounds = currentTabBounds ?? currentBeatBounds
    if (!bounds) return

    const id = _nextId++
    setParticles((prev) => [...prev, { id, result: latest.result, bounds }])

    setTimeout(() => {
      setParticles((prev) => prev.filter((p) => p.id !== id))
    }, 800)
  }, [attempts.length]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 6 }}>
      {particles.map(({ id, result, bounds }) => {
        const cx = bounds.x + bounds.w / 2
        const cy = bounds.y

        return (
          <div key={id}>
            {/* Expanding ring behind the note */}
            <div
              className="hit-ring"
              style={{
                position: 'absolute',
                left: bounds.x - 4,
                top: bounds.y - 4,
                width: bounds.w + 8,
                height: bounds.h + 8,
                borderRadius: 6,
                border: `2px solid ${COLOR[result]}`,
              }}
            />

            {/* Floating label */}
            <div
              className="hit-float"
              style={{
                position: 'absolute',
                left: cx,
                top: cy - 10,
                transform: 'translateX(-50%)',
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: '0.04em',
                color: COLOR[result],
                textShadow: `0 0 8px ${COLOR[result]}99`,
                whiteSpace: 'nowrap',
              }}
            >
              {LABEL[result]}
            </div>
          </div>
        )
      })}
    </div>
  )
}
