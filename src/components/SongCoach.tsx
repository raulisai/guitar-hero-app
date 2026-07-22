import { useShallow } from 'zustand/react/shallow'
import type { DemoSong } from '../demoSongs'
import { getSongPresentation } from '../game/songPresentation'
import { useGameStore } from '../store/useGameStore'
import { FINGER_NAMES } from '../utils/fingeringUtils'

interface SongCoachProps {
  song: DemoSong
}

export function SongCoach({ song }: SongCoachProps) {
  const { expectedNote, songBpm, score } = useGameStore(useShallow((state) => ({
    expectedNote: state.expectedNote,
    songBpm: state.songBpm,
    score: state.score,
  })))
  const presentation = getSongPresentation(song, songBpm)
  const goal = expectedNote ?? presentation.goal
  const finger = goal.fingerNumber ?? 0
  const fretText = goal.fretNumber === 0 ? 'al aire' : `${goal.fretNumber}° traste`
  const stringText = `${goal.stringNumber}ª cuerda`

  return (
    <>
      <section className="song-overview game-card">
        <div className="song-cover-wrap">
          <img className="song-cover" src={presentation.cover} alt={`Arte original para ${presentation.title}`} />
          <span className="song-cover-glow" aria-hidden="true" />
        </div>
        <div className="song-overview__copy">
          <small className="song-overview__kicker">LECCIÓN EN CURSO</small>
          <h1>{presentation.title}</h1>
          <p>{presentation.artist}</p>
          <div className="song-meta">
            <span>{presentation.tuning}</span>
            <i />
            <span>{presentation.bpm} BPM</span>
            <b>·</b>
            <span>{presentation.timeSignature}</span>
          </div>
        </div>
        <div className="song-objective">
          <span>TU OBJETIVO</span>
          <strong>{goal.name}</strong>
          <small>{fretText} – {stringText}</small>
          <i aria-label={`${score.accuracy}% de precisión`}>{score.accuracy || 'i'}</i>
        </div>
      </section>

      <section className="note-coach game-card" aria-live="polite">
        <div className="note-coach__image">
          <img src="/game-assets/finger-guide.webp" alt="Posición de la mano sobre el diapasón" />
        </div>
        <div className="note-coach__note">
          <span>Toca ahora:</span>
          <strong>{goal.name}</strong>
        </div>
        <div className="note-coach__position">
          <span>{stringText}</span>
          <span>{fretText}</span>
          <strong className="finger-chip">
            {finger === 0 ? 'Cuerda al aire' : `Dedo ${finger} · ${FINGER_NAMES[finger]}`}
          </strong>
        </div>
        <div className="note-coach__tip">
          <strong><TargetIcon /> Consejo</strong>
          <span>{goal.fretNumber === 0 ? 'Deja vibrar la cuerda sin tocar el mástil' : 'Presiona firme y cerca del traste'}</span>
        </div>
      </section>
    </>
  )
}

function TargetIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2" /><path d="m15 9 5-5M17 4h3v3" />
    </svg>
  )
}
