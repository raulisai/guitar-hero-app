import { useGameStore } from '../store/useGameStore'
import { RESULT_COLORS, RESULT_TEXT } from '../utils/timingUtils'

interface BottomBarProps {
  onPlay: () => void
  onPause: () => void
  onStop: () => void
  onTempoChange: (ratio: number) => void
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  hasFile: boolean
  tempo: number
  onTempoInput: (v: number) => void
  showDebugLog: boolean
  onToggleDebugLog: () => void
}

export function BottomBar({
  onPlay,
  onPause,
  onStop,
  onTempoChange,
  onFileUpload,
  hasFile,
  tempo,
  onTempoInput,
  showDebugLog,
  onToggleDebugLog,
}: BottomBarProps) {
  const { gameState, gameMode, score, currentBar, currentBeat, attempts, waitMode, setWaitMode, resetGame } = useGameStore()
  const isPlaying = gameState === 'playing'
  const lastAttempt = attempts[attempts.length - 1]

  return (
    <div
      className="flex items-center gap-4 px-4 h-14 border-t select-none shrink-0"
      style={{ background: '#1a1a1a', borderColor: '#333' }}
    >
      {/* Transport controls */}
      <div className="flex items-center gap-1">
        {isPlaying ? (
          <button
            onClick={onPause}
            title="Pausar"
            className="w-9 h-9 rounded-full flex items-center justify-center transition-colors"
            style={{ background: '#22c55e', color: '#000' }}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          </button>
        ) : (
          <button
            onClick={onPlay}
            disabled={!hasFile}
            title="Reproducir"
            className="w-9 h-9 rounded-full flex items-center justify-center transition-colors disabled:opacity-30"
            style={{ background: '#22c55e', color: '#000' }}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 ml-0.5">
              <polygon points="5,3 19,12 5,21" />
            </svg>
          </button>
        )}

        <button
          onClick={onStop}
          disabled={!hasFile}
          title="Detener"
          className="w-8 h-8 rounded flex items-center justify-center transition-colors disabled:opacity-30"
          style={{ color: '#999' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#999')}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
            <rect x="4" y="4" width="16" height="16" rx="2" />
          </svg>
        </button>

        {/* Reset — clears all logs and error overlays */}
        <button
          onClick={() => { onStop(); resetGame() }}
          disabled={!hasFile}
          title="Reiniciar — limpia logs y errores"
          className="w-8 h-8 rounded flex items-center justify-center transition-colors disabled:opacity-30"
          style={{ color: '#666' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#666')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </svg>
        </button>
      </div>

      {/* Divider */}
      <div className="w-px h-6" style={{ background: '#333' }} />

      {/* Speed */}
      <div className="flex items-center gap-2">
        <span className="text-xs" style={{ color: '#888' }}>VELOCIDAD</span>
        <input
          type="range"
          min={50}
          max={200}
          value={tempo}
          step={5}
          onChange={(e) => {
            const v = Number(e.target.value)
            onTempoInput(v)
            onTempoChange(v / 100)
          }}
          className="w-20 h-1 rounded appearance-none cursor-pointer"
          style={{ accentColor: '#22c55e' }}
        />
        <span className="text-xs w-9 text-right" style={{ color: '#22c55e' }}>
          {tempo}%
        </span>
      </div>

      {/* Divider */}
      <div className="w-px h-6" style={{ background: '#333' }} />

      {/* Position */}
      <div className="text-xs" style={{ color: '#888' }}>
        Compás <span style={{ color: '#ccc' }}>{currentBar + 1}</span>
        {' · '}
        Beat <span style={{ color: '#ccc' }}>{currentBeat + 1}</span>
      </div>

      {/* Last result badge */}
      {lastAttempt && isPlaying && (
        <>
          <div className="w-px h-6" style={{ background: '#333' }} />
          <div
            className="text-xs font-bold px-2 py-0.5 rounded"
            style={{
              color: RESULT_COLORS[lastAttempt.result],
              background: RESULT_COLORS[lastAttempt.result] + '22',
            }}
          >
            {RESULT_TEXT[lastAttempt.result]}
          </div>
        </>
      )}

      {/* Accuracy */}
      {(score.perfect + score.good + score.miss + score.wrong) > 0 && (
        <>
          <div className="w-px h-6" style={{ background: '#333' }} />
          <div className="text-xs" style={{ color: '#888' }}>
            Precisión{' '}
            <span
              className="font-bold"
              style={{ color: score.accuracy >= 80 ? '#22c55e' : score.accuracy >= 50 ? '#f59e0b' : '#ef4444' }}
            >
              {score.accuracy}%
            </span>
          </div>
          {score.streak > 2 && (
            <span className="text-xs font-bold" style={{ color: '#f59e0b' }}>
              🔥 x{score.streak}
            </span>
          )}
        </>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Debug log toggle */}
      <button
        onClick={onToggleDebugLog}
        title="Mostrar/ocultar log de notas"
        className="text-xs px-2.5 py-1 rounded transition-colors font-mono"
        style={{
          background: showDebugLog ? '#22c55e22' : 'transparent',
          color: showDebugLog ? '#22c55e' : '#444',
          border: `1px solid ${showDebugLog ? '#22c55e44' : '#2a2a2a'}`,
        }}
        onMouseEnter={(e) => { if (!showDebugLog) e.currentTarget.style.color = '#888' }}
        onMouseLeave={(e) => { if (!showDebugLog) e.currentTarget.style.color = '#444' }}
      >
        LOG
      </button>

      {/* Wait mode toggle — only in master mode */}
      {gameMode === 'master' && (
        <label
          className="flex items-center gap-1.5 cursor-pointer select-none text-xs"
          style={{ color: waitMode ? '#22c55e' : '#666' }}
        >
          <input
            type="checkbox"
            checked={waitMode}
            onChange={(e) => setWaitMode(e.target.checked)}
            className="w-3.5 h-3.5 cursor-pointer"
            style={{ accentColor: '#22c55e' }}
          />
          Esperar
        </label>
      )}

      {/* Upload */}
      <label
        className="text-xs px-3 py-1.5 rounded cursor-pointer transition-colors font-medium"
        style={{ background: '#2a2a2a', color: '#aaa', border: '1px solid #444' }}
        onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
        onMouseLeave={(e) => (e.currentTarget.style.color = '#aaa')}
      >
        Cargar .gp5
        <input
          type="file"
          accept=".gp,.gp3,.gp4,.gp5,.gpx"
          onChange={onFileUpload}
          className="hidden"
        />
      </label>
    </div>
  )
}
