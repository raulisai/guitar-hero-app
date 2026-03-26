// @refresh reset
import { useEffect, useRef } from 'react'
import { useGameStore } from '../store/useGameStore'

// ─── Tuneable constants ────────────────────────────────────────────────────
export const MASTER_NOTE_TIMEOUT = 3000 // ms — max wait per note in master mode

export function useGameLoop() {
  const masterTimeoutRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastEvaluatedKey    = useRef<string>('')
  const lastEvalTimestamp   = useRef<number>(0)   // wall-clock ms when last beat was evaluated

  const { gameState, gameMode, waitMode, expectedNote, evaluateNote } = useGameStore()

    // Free (reproduction) mode has no evaluation — music just plays through.
  // All scoring logic lives in master mode below.

  // ─── Master mode: timeout (miss if no note in time) ───────────────────────
  useEffect(() => {
    if (gameMode !== 'master') return
    if (gameState !== 'paused') return
    if (!expectedNote) return
    if (waitMode) return   // "Esperar" checked — wait indefinitely for user input

    const beatKey = `${expectedNote.bar}-${expectedNote.beat}`
    if (beatKey === lastEvaluatedKey.current) return

    const timeout = setTimeout(() => {
      // Only fire if this beat hasn't been evaluated yet (subscribe might have beaten us)
      if (lastEvaluatedKey.current === beatKey) return

      lastEvaluatedKey.current = beatKey
      lastEvalTimestamp.current = performance.now()
      evaluateNote()
      const state = useGameStore.getState()
      const lastResult = state.attempts.at(-1)?.result
      if (lastResult === 'wrong' || lastResult === 'miss') {
        state.markCurrentBeatFailed()
      }
      setTimeout(() => useGameStore.getState().resumePlayback?.(), 150)
    }, MASTER_NOTE_TIMEOUT)

    masterTimeoutRef.current = timeout

    return () => {
      clearTimeout(timeout)
      masterTimeoutRef.current = null
    }
  }, [expectedNote, gameState, gameMode, waitMode, evaluateNote])

  // ─── Master mode: real-time note detection ────────────────────────────────
  // Zustand v5: subscribe takes a single (state, prevState) => void listener.
  // We skip early if detectedNote didn't change to avoid re-processing.
  useEffect(() => {
    if (gameMode !== 'master') return

    const unsubscribe = useGameStore.subscribe((state, prevState) => {
      const detectedNote = state.detectedNote
      if (detectedNote === prevState.detectedNote) return   // no new detection

      // Read live state — not the closed-over snapshot
      const { gameState: gs, expectedNote: exp } = useGameStore.getState()
      if (gs !== 'paused') return
      if (!exp) return
      if (!detectedNote || detectedNote.clarity < 0.85) return
      // Reject stale sustain: onset must be well AFTER the previous beat was evaluated.
      // The 80ms cooldown gives the pitch detector buffer time to settle on the new
      // frequency after a note change — prevents the old note from lingering in the
      // buffer and being accepted with a fresh onset for the next beat.
      if (detectedNote.onset < lastEvalTimestamp.current + 80) return

      const beatKey = `${exp.bar}-${exp.beat}`
      if (lastEvaluatedKey.current === beatKey) return  // already evaluated this beat

      // Claim this beat before doing async work
      lastEvaluatedKey.current = beatKey
      lastEvalTimestamp.current = performance.now()
      if (masterTimeoutRef.current) {
        clearTimeout(masterTimeoutRef.current)
        masterTimeoutRef.current = null
      }

      evaluateNote()
      const freshState = useGameStore.getState()
      const lastResult = freshState.attempts.at(-1)?.result
      if (lastResult === 'wrong' || lastResult === 'miss') {
        freshState.markCurrentBeatFailed()
      }
      setTimeout(() => useGameStore.getState().resumePlayback?.(), 150)
    })

    return unsubscribe
  }, [gameMode, evaluateNote])

  // ─── Reset on song stop ────────────────────────────────────────────────────
  useEffect(() => {
    if (gameState === 'idle' || gameState === 'finished') {
      lastEvaluatedKey.current = ''
      lastEvalTimestamp.current = 0
    }
  }, [gameState])
}
