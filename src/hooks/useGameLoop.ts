// @refresh reset
import { useEffect, useRef } from 'react'
import { useGameStore } from '../store/useGameStore'

// ─── Tuneable constants ────────────────────────────────────────────────────
export const MASTER_NOTE_TIMEOUT = 3000 // ms — max wait per note in master mode

export function useGameLoop() {
  const masterTimeoutRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastEvaluatedKey    = useRef<string>('')
  const lastEvalTimestamp   = useRef<number>(0)   // wall-clock ms when last beat was evaluated
  const freeTimeoutRef      = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { gameState, gameMode, waitMode, expectedNote, evaluateNote } = useGameStore()

  // ─── Reproduction mode: score continuously without stopping playback ───────
  useEffect(() => {
    if (gameMode !== 'reproduction' || gameState !== 'playing' || !expectedNote) return

    const beatKey = `${expectedNote.bar}-${expectedNote.beat}`
    const bpm = useGameStore.getState().songBpm || 100
    const noteWindowMs = Math.max(260, Math.min(850, (60_000 / bpm) * 0.9))

    freeTimeoutRef.current = setTimeout(() => {
      if (lastEvaluatedKey.current === beatKey) return
      lastEvaluatedKey.current = beatKey
      evaluateNote()
    }, noteWindowMs)

    return () => {
      if (freeTimeoutRef.current) clearTimeout(freeTimeoutRef.current)
      freeTimeoutRef.current = null
    }
  }, [expectedNote, gameMode, gameState, evaluateNote])

  useEffect(() => {
    if (gameMode !== 'reproduction') return

    return useGameStore.subscribe((state, prevState) => {
      const detected = state.detectedNote
      if (detected === prevState.detectedNote || !detected) return
      if (detected.clarity < 0.82 || detected.stableFrames < 2) return

      const live = useGameStore.getState()
      if (live.gameState !== 'playing' || !live.expectedNote) return

      const exp = live.expectedNote
      const beatKey = `${exp.bar}-${exp.beat}`
      if (lastEvaluatedKey.current === beatKey) return
      if (detected.onset < exp.timestamp - 220) return

      // A wrong transient should not steal the whole beat immediately. Give the
      // detector 120 ms to settle before recording a wrong note.
      const matches = exp.chordMidis?.includes(detected.midi) ?? detected.midi === exp.midi
      if (!matches && performance.now() - exp.timestamp < 120) return

      lastEvaluatedKey.current = beatKey
      if (freeTimeoutRef.current) clearTimeout(freeTimeoutRef.current)
      evaluateNote()
    })
  }, [gameMode, evaluateNote])

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
      if (!detectedNote || detectedNote.clarity < 0.82 || detectedNote.stableFrames < 2) return
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
