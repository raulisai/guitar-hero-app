import { useGameStore } from '../store/useGameStore'

export function NoteOverlay() {
  const { currentBeatBounds, failedBeatOverlays, gameState, gameMode } = useGameStore()

  const isActive = gameState === 'playing' || (gameMode === 'master' && gameState === 'paused')

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 5,
      }}
    >
      {/* Current note — green highlight */}
      {isActive && currentBeatBounds && (
        <div
          style={{
            position: 'absolute',
            left: currentBeatBounds.x,
            top: currentBeatBounds.y,
            width: currentBeatBounds.w,
            height: currentBeatBounds.h,
            background: 'rgba(34, 197, 94, 0.28)',
            border: '1px solid rgba(34, 197, 94, 0.6)',
            borderRadius: 3,
            boxShadow: '0 0 6px rgba(34, 197, 94, 0.4)',
          }}
        />
      )}

      {/* Failed notes — semi-transparent dark overlay so note looks faded */}
      {failedBeatOverlays.map(({ key, bounds }) => (
        <div
          key={key}
          style={{
            position: 'absolute',
            left: bounds.x,
            top: bounds.y,
            width: bounds.w,
            height: bounds.h,
            background: 'rgba(239, 68, 68, 0.22)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: 3,
            opacity: 0.65,
          }}
        />
      ))}
    </div>
  )
}
