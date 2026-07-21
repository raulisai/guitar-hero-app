import { useCallback } from 'react'
import type { GameMode } from '../types'

/**
 * Keeps the transport stable. The previous inactivity timer and scroll handler
 * changed the entire bottom dock without an explicit user action, which was
 * especially confusing while playing on a phone.
 */
export function useAutoHide(gameMode: GameMode) {
  void gameMode
  const showBar = useCallback(() => undefined, [])
  const hideNow = useCallback(() => undefined, [])

  return { barHidden: false, showBar, hideNow }
}
