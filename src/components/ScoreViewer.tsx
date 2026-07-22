import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import { useAlphaTab } from '../hooks/useAlphaTab'
import { NoteOverlay } from './NoteOverlay'
import { HitFeedback } from './HitFeedback'
import { useGameStore } from '../store/useGameStore'

export interface ScoreViewerHandle {
  play: () => void
  pause: () => void
  stop: () => void
  setTempo: (ratio: number) => void
}

interface ScoreViewerProps {
  file: File | string | null
  onScroll?: () => void
}

export const ScoreViewer = forwardRef<ScoreViewerHandle, ScoreViewerProps>(
  ({ file, onScroll }, ref) => {
    // scrollRef = outer container with overflow-x: auto (AlphaTab scrolls this)
    const scrollRef = useRef<HTMLDivElement>(null)
    // containerRef = AlphaTab render target
    const containerRef = useRef<HTMLDivElement>(null)

    const { initialize, play, pause, stop, setTempo } = useAlphaTab(containerRef, scrollRef)
    const isMaster = useGameStore(s => s.gameMode === 'master')

    useImperativeHandle(ref, () => ({ play, pause, stop, setTempo }), [play, pause, stop, setTempo])

    useEffect(() => {
      if (containerRef.current) {
        initialize(file ?? undefined)
      }
    }, [file]) // eslint-disable-line react-hooks/exhaustive-deps

    return (
      <div
        className="score-viewer"
      >
        <div ref={scrollRef} onScroll={onScroll} className="score-scroll">
          {/* Inner wrapper provides positioning context for the overlay */}
          <div className="score-canvas">
            {/* AlphaTab render target */}
            <div ref={containerRef} className="alphatab-target" />

            {/* Overlays and hit feedback — master mode only */}
            {isMaster && <NoteOverlay />}
            {isMaster && <HitFeedback />}
          </div>

          {/* Placeholder when no file */}
          {!file && (
            <div className="score-empty">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M9 3v10.55A4 4 0 1 0 11 17V7h4V3H9z" />
              </svg>
              <p>Carga un archivo .gp5 para comenzar</p>
            </div>
          )}
        </div>
      </div>
    )
  }
)
ScoreViewer.displayName = 'ScoreViewer'
