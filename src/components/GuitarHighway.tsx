import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { DemoSong } from '../demoSongs'
import { getSongPresentation } from '../game/songPresentation'
import { useGameStore } from '../store/useGameStore'

const STRINGS = [
  { number: 1, label: 'e', color: '#d65cff' },
  { number: 2, label: 'B', color: '#4aa3ff' },
  { number: 3, label: 'G', color: '#17e4db' },
  { number: 4, label: 'D', color: '#a7ef22' },
  { number: 5, label: 'A', color: '#ffc21a' },
  { number: 6, label: 'E', color: '#ff5b3d' },
]

interface HighwayNote {
  id: string
  stringNumber: number
  fret: number
  left: number
  current?: boolean
}

export function GuitarHighway({ song }: { song: DemoSong }) {
  const { expectedNote, currentBeat, currentBar, gameState, gameMode, attempts, detectedNote, songBpm } = useGameStore(useShallow((state) => ({
    expectedNote: state.expectedNote,
    currentBeat: state.currentBeat,
    currentBar: state.currentBar,
    gameState: state.gameState,
    gameMode: state.gameMode,
    attempts: state.attempts,
    detectedNote: state.detectedNote,
    songBpm: state.songBpm,
  })))
  const preview = getSongPresentation(song, songBpm).goal
  const active = expectedNote ?? preview
  const activeString = active.stringNumber ?? preview.stringNumber
  const activeFret = active.fretNumber ?? preview.fretNumber
  const lastAttempt = attempts.at(-1)
  const isLive = gameState === 'playing' || (gameMode === 'master' && gameState === 'paused')

  const notes = useMemo<HighwayNote[]>(() => {
    const positions = [20, 43, 61, 82]
    const strings = [activeString, Math.max(1, activeString - 1), Math.max(1, activeString - 2), Math.min(6, activeString + 1)]
    const frets = [activeFret, Math.min(17, activeFret + 3), Math.min(17, activeFret + 5), Math.min(17, activeFret + 3)]
    return positions.map((left, index) => ({
      id: `${currentBar}-${currentBeat}-${index}`,
      stringNumber: strings[index],
      fret: frets[index],
      left,
      current: index === 0,
    }))
  }, [activeFret, activeString, currentBar, currentBeat])

  const detectorMatches = Boolean(
    expectedNote && detectedNote &&
    (expectedNote.chordMidis?.includes(detectedNote.midi) ?? expectedNote.midi === detectedNote.midi)
  )

  return (
    <section
      className="guitar-highway game-card"
      data-live={isLive}
      data-result={lastAttempt?.result ?? 'idle'}
      aria-label="Carril de notas de guitarra"
    >
      <div className="highway-callout">¡TOCA AQUÍ!</div>
      <div className="highway-grid" aria-hidden="true">
        {Array.from({ length: 9 }, (_, index) => <i key={index} style={{ left: `${8 + index * 11.2}%` }} />)}
      </div>

      <div className="highway-playhead" aria-hidden="true">
        <span className={detectorMatches ? 'is-match' : ''} />
      </div>

      <div className="highway-lanes">
        {STRINGS.map((string) => (
          <div className="highway-lane" key={string.number} style={{ '--string-color': string.color } as React.CSSProperties}>
            <span className="highway-string-label">{string.label}</span>
            <div className="highway-string-line">
              {Array.from({ length: 9 }, (_, marker) => <i key={marker} style={{ left: `${marker * 12.5}%` }} />)}
            </div>
            {notes.filter((note) => note.stringNumber === string.number).map((note) => (
              <div
                key={note.id}
                className={`highway-note${note.current ? ' is-current' : ''}`}
                style={{ left: `${note.left}%` }}
              >
                <span>{note.fret}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      <footer className="highway-ruler">
        <span>COMPÁS</span>
        {[1, 2, 3, 4].map((beat) => (
          <strong key={beat} className={currentBeat % 4 === beat - 1 ? 'is-current' : ''}>{beat}<small>y</small></strong>
        ))}
      </footer>

      <div className="highway-particles" aria-hidden="true">
        {Array.from({ length: 12 }, (_, index) => <i key={index} style={{ '--particle': index } as React.CSSProperties} />)}
      </div>
    </section>
  )
}
