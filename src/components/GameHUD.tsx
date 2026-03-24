import { useGameStore } from '../store/useGameStore'
import { RESULT_COLORS } from '../utils/timingUtils'
import type { NoteResult } from '../types'

const HUD_ROWS: { key: NoteResult; label: string }[] = [
  { key: 'perfect', label: '¡Perfecto!' },
  { key: 'good', label: 'Bien' },
  { key: 'late', label: 'Tarde' },
  { key: 'early', label: 'Pronto' },
  { key: 'wrong', label: 'Incorrecto' },
  { key: 'miss', label: 'Fallada' },
]

export function GameHUD() {
  const { score, currentBar, currentBeat } = useGameStore()

  return (
    <div className="fixed top-4 right-4 w-48 bg-black/80 text-white rounded-xl p-3 backdrop-blur-sm z-50">
      {/* Accuracy */}
      <div className="text-center mb-3">
        <span className="text-4xl font-bold">{score.accuracy}%</span>
        <p className="text-xs text-gray-400">precisión</p>
      </div>

      {/* Streak */}
      {score.streak > 2 && (
        <div className="text-center mb-3 text-yellow-400 font-bold">
          🔥 x{score.streak}
        </div>
      )}

      {/* Breakdown */}
      <div className="space-y-1 text-xs">
        {HUD_ROWS.map(({ key, label }) => (
          <div key={key} className="flex justify-between">
            <span style={{ color: RESULT_COLORS[key] }}>{label}</span>
            <span>{score[key]}</span>
          </div>
        ))}
      </div>

      {/* Song position */}
      <div className="mt-3 pt-2 border-t border-gray-700 text-xs text-gray-400 text-center">
        Compás {currentBar + 1} &middot; Beat {currentBeat + 1}
      </div>
    </div>
  )
}
