import { useEffect, useRef, useCallback } from 'react'
import { useGameStore } from '../store/useGameStore'

const EVALUATION_WINDOW = 150   // ms — reproduction mode
const MASTER_TIMEOUT = 6000     // ms — max time to play the note in master mode

export function useGameLoop() {
  const evaluationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const masterTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastEvaluatedKey = useRef<string>('')
  const masterWaitActive = useRef(false)

  const { gameState, gameMode, expectedNote, detectedNote, evaluateNote } =
    useGameStore()

  // Clears timers, evaluates, marks failed beats, and resumes AlphaTab
  const advanceMaster = useCallback(() => {
    masterWaitActive.current = false
    if (masterTimeoutRef.current) {
      clearTimeout(masterTimeoutRef.current)
      masterTimeoutRef.current = null
    }
    evaluateNote()
    const state = useGameStore.getState()
    const lastResult = state.attempts.at(-1)?.result
    if (lastResult === 'wrong' || lastResult === 'miss') {
      state.markCurrentBeatFailed()
    }
    setTimeout(() => useGameStore.getState().resumePlayback?.(), 300)
  }, [evaluateNote])

  // Helper: evaluate current note and, in master mode, resume playback
  const evaluateAndResume = useCallback((isMaster: boolean) => {
    if (isMaster && !masterWaitActive.current) return
    advanceMaster()
  }, [advanceMaster])

  // ─── Reproduction mode ────────────────────────────────────────────────────
  useEffect(() => {
    if (gameMode !== 'reproduction') return
    if (gameState !== 'playing') return
    if (!expectedNote) return

    const beatKey = `${expectedNote.bar}-${expectedNote.beat}`
    if (beatKey === lastEvaluatedKey.current) return

    if (evaluationTimerRef.current) clearTimeout(evaluationTimerRef.current)

    evaluationTimerRef.current = setTimeout(() => {
      lastEvaluatedKey.current = beatKey
      evaluateNote()
    }, EVALUATION_WINDOW)

    return () => {
      if (evaluationTimerRef.current) clearTimeout(evaluationTimerRef.current)
    }
  }, [expectedNote, gameState, gameMode, evaluateNote])

  // ─── Master mode: start wait window on new note ───────────────────────────
  useEffect(() => {
    if (gameMode !== 'master') return
    if (gameState !== 'paused') return
    if (!expectedNote) return

    const beatKey = `${expectedNote.bar}-${expectedNote.beat}`
    if (beatKey === lastEvaluatedKey.current) return

    masterWaitActive.current = true
    lastEvaluatedKey.current = beatKey

    masterTimeoutRef.current = setTimeout(() => {
      evaluateAndResume(true)
    }, MASTER_TIMEOUT)

    return () => {
      if (masterTimeoutRef.current) clearTimeout(masterTimeoutRef.current)
    }
  }, [expectedNote, gameState, gameMode, evaluateAndResume])

  // ─── Master mode: detect note during wait ────────────────────────────────
  useEffect(() => {
    if (gameMode !== 'master') return
    if (gameState !== 'paused') return
    if (!masterWaitActive.current) return
    if (!detectedNote || detectedNote.clarity < 0.85) return
    if (!expectedNote) return

    const isMatch = Math.abs(detectedNote.midi - expectedNote.midi) <= 1
    if (isMatch) {
      // Correct note → advance immediately
      advanceMaster()
    } else {
      // Wrong note → lock out re-entry, show feedback 500 ms then advance with fail
      masterWaitActive.current = false
      if (masterTimeoutRef.current) clearTimeout(masterTimeoutRef.current)
      masterTimeoutRef.current = setTimeout(() => {
        masterTimeoutRef.current = null
        advanceMaster()
      }, 500)
    }
  }, [detectedNote, gameMode, gameState, expectedNote, advanceMaster])

  // ─── Reset on song stop ────────────────────────────────────────────────────
  useEffect(() => {
    if (gameState === 'idle' || gameState === 'finished') {
      lastEvaluatedKey.current = ''
      masterWaitActive.current = false
    }
  }, [gameState])
}
