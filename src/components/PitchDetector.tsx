import { useAudioDetection } from '../hooks/useAudioDetection'
import { useGameStore } from '../store/useGameStore'
import { RESULT_COLORS, RESULT_TEXT } from '../utils/timingUtils'

export function PitchDetector() {
  const { isListening, error, startListening, stopListening } = useAudioDetection()
  const { detectedNote, expectedNote, attempts } = useGameStore()

  const lastAttempt = attempts[attempts.length - 1]

  return (
    <div className="p-4 bg-gray-900 text-white rounded-xl">
      {/* Mic status */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div
            className={`w-3 h-3 rounded-full ${
              isListening ? 'bg-green-400 animate-pulse' : 'bg-gray-500'
            }`}
          />
          <span className="text-sm">{isListening ? 'Escuchando...' : 'Micrófono apagado'}</span>
        </div>
        <button
          onClick={isListening ? stopListening : startListening}
          className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
            isListening ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
          }`}
        >
          {isListening ? 'Detener' : 'Activar micrófono'}
        </button>
      </div>

      {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

      {/* Detected vs expected note */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-gray-800 rounded-lg p-3">
          <p className="text-xs text-gray-400 mb-1">Tocando ahora</p>
          <p className="text-3xl font-bold">{detectedNote ? detectedNote.name : '—'}</p>
          {detectedNote && (
            <p className="text-xs text-gray-400">
              {detectedNote.frequency.toFixed(1)} Hz &middot; clarity:{' '}
              {(detectedNote.clarity * 100).toFixed(0)}%
            </p>
          )}
        </div>

        <div className="bg-gray-800 rounded-lg p-3">
          <p className="text-xs text-gray-400 mb-1">Nota esperada</p>
          <p className="text-3xl font-bold text-blue-400">
            {expectedNote ? expectedNote.name : '—'}
          </p>
          {expectedNote && (
            <p className="text-xs text-gray-400">
              Compás {expectedNote.bar + 1} &middot; Beat {expectedNote.beat + 1}
            </p>
          )}
        </div>
      </div>

      {/* Last attempt feedback */}
      {lastAttempt && (
        <div
          className="rounded-lg p-3 text-center text-lg font-bold"
          style={{
            backgroundColor: RESULT_COLORS[lastAttempt.result] + '33',
            color: RESULT_COLORS[lastAttempt.result],
          }}
        >
          {RESULT_TEXT[lastAttempt.result]}
          {lastAttempt.timeDiff !== 0 && (
            <span className="text-sm font-normal ml-2">
              ({lastAttempt.timeDiff > 0 ? '+' : ''}
              {lastAttempt.timeDiff}ms)
            </span>
          )}
        </div>
      )}
    </div>
  )
}
