import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { DemoSong } from '../demoSongs'
import { HIGHWAY_HIT_LINE_PERCENT, layoutHighwayNotes } from '../game/highwayTimeline'
import { useGameStore } from '../store/useGameStore'

const STRINGS = [
  { number: 1, label: 'e', color: '#d65cff' },
  { number: 2, label: 'B', color: '#4aa3ff' },
  { number: 3, label: 'G', color: '#17e4db' },
  { number: 4, label: 'D', color: '#a7ef22' },
  { number: 5, label: 'A', color: '#ffc21a' },
  { number: 6, label: 'E', color: '#ff5b3d' },
]

export function GuitarHighway({ song }: { song: DemoSong }) {
  const {
    expectedNote, currentBeat, currentBar, gameState, gameMode, attempts,
    detectedNote, noteTimeline, playbackTick,
  } = useGameStore(useShallow((state) => ({
    expectedNote: state.expectedNote,
    currentBeat: state.currentBeat,
    currentBar: state.currentBar,
    gameState: state.gameState,
    gameMode: state.gameMode,
    attempts: state.attempts,
    detectedNote: state.detectedNote,
    noteTimeline: state.noteTimeline,
    playbackTick: state.playbackTick,
  })))
  const lastAttempt = attempts.at(-1)
  const isLive = gameState === 'playing' || (gameMode === 'master' && gameState === 'paused')
  const notes = useMemo(
    () => layoutHighwayNotes(noteTimeline, playbackTick),
    [noteTimeline, playbackTick],
  )
  const detectorMatches = Boolean(
    expectedNote && detectedNote &&
    (expectedNote.chordMidis?.includes(detectedNote.midi) ?? expectedNote.midi === detectedNote.midi)
  )

  return (
    <section
      className="guitar-highway game-card"
      data-live={isLive}
      data-result={lastAttempt?.result ?? 'idle'}
      aria-label={`Carril de notas de ${song.title}`}
    >
      <div className="highway-callout">¡TOCA AQUÍ!</div>
      <div className="highway-grid" aria-hidden="true">
        {Array.from({ length: 9 }, (_, index) => <i key={index} style={{ left: `${8 + index * 11.2}%` }} />)}
      </div>

      <div className="highway-playhead" style={{ left: `${HIGHWAY_HIT_LINE_PERCENT}%` }} aria-hidden="true">
        <span className={detectorMatches ? 'is-match' : ''} />
      </div>

      <div className="highway-lanes">
        {STRINGS.map((string) => (
          <div className="highway-lane" key={string.number} style={{ '--string-color': string.color } as React.CSSProperties}>
            <span className="highway-string-label">{string.label}</span>
            <div className="highway-string-line" aria-hidden="true">
              {Array.from({ length: 9 }, (_, marker) => <i key={marker} style={{ left: `${marker * 12.5}%` }} />)}
            </div>
            {notes.filter((note) => note.stringNumber === string.number).map((note) => {
              const expected = expectedNote?.bar === note.bar && expectedNote.beat === note.beat
              const current = expected || note.active
              const sustained = note.durationTicks >= 720
              return (
                <div
                  key={note.id}
                  className={`highway-note-rail${current ? ' is-current' : ''}${note.passed ? ' is-passed' : ''}${sustained ? ' is-sustained' : ''}`}
                  style={{
                    '--note-left': `${note.leftPercent}%`,
                    '--note-length': `${note.lengthPercent}%`,
                  } as React.CSSProperties}
                  aria-label={`${note.name}, traste ${note.fretNumber}, cuerda ${note.stringNumber}`}
                >
                  <i className="highway-note-tail" aria-hidden="true" />
                  <span className="highway-note-head"><b>{note.fretNumber}</b></span>
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {noteTimeline.length === 0 && (
        <div className="highway-loading" role="status"><i /> Preparando las notas de la partitura…</div>
      )}

      <footer className="highway-ruler">
        <span>COMPÁS {currentBar + 1}</span>
        {[1, 2, 3, 4].map((beat) => (
          <strong key={beat} className={currentBeat % 4 === beat - 1 ? 'is-current' : ''}>{beat}<small>y</small></strong>
        ))}
      </footer>

      <div className="highway-particles" aria-hidden="true">
        {Array.from({ length: 8 }, (_, index) => <i key={index} style={{ '--particle': index } as React.CSSProperties} />)}
      </div>
    </section>
  )
}
