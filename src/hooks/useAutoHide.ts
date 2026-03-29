import { useState, useCallback, useEffect, useRef } from 'react'
import type { GameMode } from '../types'

const HIDE_DELAY_MS = 12000   // 12 s of inactivity before auto-hide

/**
 * Auto-hides the control bar after inactivity in reproduction (free) mode.
 * In master mode the bar is always visible.
 *
 * showBar  — call on any bar interaction (resets the timer)
 * hideNow  — call immediately (e.g. on scroll) to collapse without waiting
 */
export function useAutoHide(gameMode: GameMode) {
  const [barHidden, setBarHidden] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  const showBar = useCallback(() => {
    setBarHidden(false)
    clearTimeout(timerRef.current)
    if (gameMode === 'reproduction') {
      timerRef.current = setTimeout(() => setBarHidden(true), HIDE_DELAY_MS)
    }
  }, [gameMode])

  const hideNow = useCallback(() => {
    if (gameMode !== 'reproduction') return
    clearTimeout(timerRef.current)
    setBarHidden(true)
  }, [gameMode])

  useEffect(() => {
    clearTimeout(timerRef.current)
    if (gameMode !== 'reproduction') {
      setBarHidden(false)
      return
    }
    timerRef.current = setTimeout(() => setBarHidden(true), HIDE_DELAY_MS)
    return () => clearTimeout(timerRef.current)
  }, [gameMode])

  return { barHidden, showBar, hideNow }
}
