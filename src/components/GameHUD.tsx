import { useGameStore } from '../store/useGameStore'
import { useShallow } from 'zustand/react/shallow'
import { RESULT_COLORS, RESULT_TEXT } from '../utils/timingUtils'

function gradeForAccuracy(accuracy: number) {
  if (accuracy >= 98) return 'S'
  if (accuracy >= 92) return 'A'
  if (accuracy >= 82) return 'B'
  if (accuracy >= 70) return 'C'
  return 'D'
}

export function GameHUD() {
  const { score, attempts, gameState, gameMode } = useGameStore(useShallow((state) => ({
    score: state.score,
    attempts: state.attempts,
    gameState: state.gameState,
    gameMode: state.gameMode,
  })))
  const lastAttempt = attempts.at(-1)
  const hasScore = attempts.length > 0
  const active = gameState === 'playing' || (gameMode === 'master' && gameState === 'paused')
  const hits = score.perfect + score.good + score.late + score.early
  const errors = score.wrong + score.miss

  if (!active && !hasScore) return null

  const grade = hasScore ? gradeForAccuracy(score.accuracy) : '—'
  const feedbackColor = lastAttempt ? RESULT_COLORS[lastAttempt.result] : '#22c55e'

  return (
    <aside className="game-hud" aria-live="polite">
      <div className="game-hud__topline">
        <div>
          <span className="game-hud__eyebrow">PUNTUACIÓN</span>
          <strong className="game-hud__points">{score.points.toLocaleString('es-ES')}</strong>
        </div>
        <div className="game-hud__grade" data-grade={grade}>{grade}</div>
      </div>

      <div className="game-hud__accuracy-row">
        <strong>{score.accuracy}%</strong>
        <span>precisión</span>
        <i style={{ width: `${score.accuracy}%` }} />
      </div>

      <div className="game-hud__streak-row">
        <span className={score.streak >= 10 ? 'is-hot' : ''}>🔥 {score.streak} racha</span>
        <strong>x{score.multiplier}</strong>
      </div>

      <div className="game-hud__counts">
        <span><b>{hits}</b> aciertos</span>
        <span><b>{errors}</b> errores</span>
        <span><b>{attempts.length}</b> notas</span>
      </div>

      {lastAttempt && (
        <div className="game-hud__feedback" style={{ color: feedbackColor }} key={attempts.length}>
          {RESULT_TEXT[lastAttempt.result]}
          {lastAttempt.timeDiff > 0 && <small>{Math.round(lastAttempt.timeDiff)} ms</small>}
        </div>
      )}
    </aside>
  )
}
