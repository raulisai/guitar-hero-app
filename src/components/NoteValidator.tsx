import { useGameStore } from '../store/useGameStore'
import { RESULT_COLORS, RESULT_TEXT } from '../utils/timingUtils'

interface NoteValidatorProps {
  isListening: boolean
  isRequesting: boolean
  error: string | null
  onToggleMic: () => void
}

export function NoteValidator({
  isListening,
  isRequesting,
  error,
  onToggleMic,
}: NoteValidatorProps) {
  const { detectedNote, expectedNote, attempts, score, gameState, gameMode } = useGameStore()
  const lastAttempt = attempts.at(-1)
  const matches = Boolean(
    detectedNote &&
    expectedNote &&
    (expectedNote.chordMidis?.includes(detectedNote.midi) ?? detectedNote.midi === expectedNote.midi)
  )
  const isActive = gameState === 'playing' || (gameMode === 'master' && gameState === 'paused')

  let status: string
  let state: 'idle' | 'listening' | 'match' | 'wrong' | 'error'

  if (error) {
    status = 'Revisa el permiso del micrófono'
    state = 'error'
  } else if (!isListening) {
    status = 'Activa el micrófono para validar'
    state = 'idle'
  } else if (!isActive || !expectedNote) {
    status = 'Micrófono listo'
    state = 'listening'
  } else if (!detectedNote) {
    status = 'Escuchando tu guitarra…'
    state = 'listening'
  } else if (matches) {
    status = 'Nota correcta'
    state = 'match'
  } else {
    status = 'Ajusta la nota'
    state = 'wrong'
  }

  const detail = expectedNote
    ? [
        expectedNote.stringNumber ? `cuerda ${expectedNote.stringNumber}` : null,
        expectedNote.fretNumber === 0 ? 'al aire' : expectedNote.fretNumber ? `traste ${expectedNote.fretNumber}` : null,
        expectedNote.fingerNumber ? `dedo ${expectedNote.fingerNumber}` : null,
      ].filter(Boolean).join(' · ')
    : 'La guía aparecerá al reproducir'

  return (
    <section className="note-validator" data-state={state} aria-live="polite">
      <button
        className="note-validator__mic"
        onClick={onToggleMic}
        disabled={isRequesting}
        aria-label={isListening ? 'Desactivar micrófono' : 'Activar micrófono'}
        title={isListening ? 'Desactivar micrófono' : 'Activar micrófono'}
      >
        <MicIcon />
        <span>{isRequesting ? '…' : isListening ? 'ON' : 'MIC'}</span>
      </button>

      <NoteValue label="debes tocar" value={expectedNote?.name ?? '—'} tone="expected" />

      <div className="note-validator__result">
        <span className="note-validator__signal">{matches ? '✓' : detectedNote ? '→' : '·'}</span>
        <strong>{status}</strong>
        <small>{error || detail}</small>
      </div>

      <NoteValue label="estás tocando" value={detectedNote?.name ?? '—'} tone={matches ? 'match' : 'heard'} />

      <div className="note-validator__score">
        {lastAttempt ? (
          <>
            <strong style={{ color: RESULT_COLORS[lastAttempt.result] }}>
              {RESULT_TEXT[lastAttempt.result]}
            </strong>
            <span>{score.accuracy}% · x{score.multiplier}</span>
          </>
        ) : (
          <>
            <strong>VALIDADOR</strong>
            <span>precisión en vivo</span>
          </>
        )}
      </div>
    </section>
  )
}

function NoteValue({ label, value, tone }: { label: string; value: string; tone: 'expected' | 'heard' | 'match' }) {
  return (
    <div className="note-validator__note" data-tone={tone}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2a4 4 0 0 1 4 4v5a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4Zm7 9a1 1 0 0 1 1 1 8 8 0 0 1-7 7.94V22h2a1 1 0 1 1 0 2H9a1 1 0 1 1 0-2h2v-2.06A8 8 0 0 1 4 12a1 1 0 1 1 2 0 6 6 0 0 0 12 0 1 1 0 0 1 1-1Z" />
    </svg>
  )
}
