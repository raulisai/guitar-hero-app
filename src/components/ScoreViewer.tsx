import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import { useAlphaTab } from '../hooks/useAlphaTab'
import { NoteOverlay } from './NoteOverlay'
import { HitFeedback } from './HitFeedback'

export interface ScoreViewerHandle {
  play: () => void
  pause: () => void
  stop: () => void
  setTempo: (ratio: number) => void
}

interface ScoreViewerProps {
  file: File | string | null
}

export const ScoreViewer = forwardRef<ScoreViewerHandle, ScoreViewerProps>(
  ({ file }, ref) => {
    // scrollRef = outer container with overflow-x: auto (AlphaTab scrolls this)
    const scrollRef = useRef<HTMLDivElement>(null)
    // containerRef = AlphaTab render target
    const containerRef = useRef<HTMLDivElement>(null)

    const { initialize, play, pause, stop, setTempo } = useAlphaTab(containerRef, scrollRef)

    useImperativeHandle(ref, () => ({ play, pause, stop, setTempo }), [play, pause, stop, setTempo])

    useEffect(() => {
      if (containerRef.current) {
        initialize(file ?? undefined)
      }
    }, [file]) // eslint-disable-line react-hooks/exhaustive-deps

    return (
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowX: 'auto',
          overflowY: 'hidden',
          background: '#111',
          position: 'relative',
        }}
      >
        {/* Inner wrapper provides positioning context for the overlay */}
        <div style={{ position: 'relative', minWidth: '100%' }}>
          {/* AlphaTab render target */}
          <div ref={containerRef} style={{ minHeight: '200px' }} />

          {/* Note highlight overlay — same coordinate space as AlphaTab canvas */}
          <NoteOverlay />
          {/* Hit feedback particles — same coordinate space */}
          <HitFeedback />
        </div>

        {/* Placeholder when no file */}
        {!file && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              pointerEvents: 'none',
              color: '#444',
            }}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 64, height: 64, opacity: 0.3 }}>
              <path d="M9 3v10.55A4 4 0 1 0 11 17V7h4V3H9z" />
            </svg>
            <p style={{ color: '#555', fontSize: 18, margin: 0 }}>
              Carga un archivo .gp5 para comenzar
            </p>
          </div>
        )}
      </div>
    )
  }
)
ScoreViewer.displayName = 'ScoreViewer'
