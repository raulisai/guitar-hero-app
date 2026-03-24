import { useGameStore } from '../store/useGameStore'

export function NoteOverlay() {
  const { currentBeatBounds, currentTabBounds, failedBeatOverlays, gameState, gameMode } = useGameStore()

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
      {/* Current beat — green column highlight over notation staff */}
      {isActive && currentBeatBounds && (
        <div
          style={{
            position: 'absolute',
            left: currentBeatBounds.x,
            top: currentBeatBounds.y,
            width: currentBeatBounds.w,
            height: currentBeatBounds.h,
            background: 'rgba(34, 197, 94, 0.18)',
            border: '1px solid rgba(34, 197, 94, 0.5)',
            borderRadius: 3,
            transition: 'all 0.15s ease-out',
          }}
        />
      )}

      {/* TAB fret highlight — solid square on the fret number */}
      {isActive && currentTabBounds && (
        <div
          style={{
            position: 'absolute',
            left: currentTabBounds.x,
            top: currentTabBounds.y,
            width: currentTabBounds.w,
            height: currentTabBounds.h,
            background: 'rgba(34, 197, 94, 0.35)',
            border: '2px solid rgba(34, 197, 94, 0.9)',
            borderRadius: 4,
            boxShadow: '0 0 8px rgba(34, 197, 94, 0.6)',
            transition: 'all 0.15s ease-out',
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
