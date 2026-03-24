import { useEffect, useRef, useCallback } from 'react'
import { useGameStore } from '../store/useGameStore'

const EVALUATION_WINDOW = 150   // ms — reproduction mode
const MASTER_TIMEOUT = 5000     // ms — max wait per note
const MASTER_WRONG_DELAY = 600  // ms — brief pause after wrong note
const NOTE_TOLERANCE = 1        // semitones — ±1 accepted as match
const STABLE_FRAMES = 2         // consecutive frames required before accepting note

export function useGameLoop() {
  const evaluationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const masterTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastEvaluatedKey = useRef<string>('')
  const masterWaitActive = useRef(false)
  const stableCountRef = useRef(0)
  const lastDetectedMidiRef = useRef<number | null>(null)

  const { gameState, gameMode, expectedNote, evaluateNote } = useGameStore()

  // Evaluate result, mark failed beats, and resume AlphaTab
  const evaluateAndResume = useCallback(() => {
    masterWaitActive.current = false
    stableCountRef.current = 0
    lastDetectedMidiRef.current = null
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

  // ─── Master mode: start wait window on new beat ───────────────────────────
  useEffect(() => {
    if (gameMode !== 'master') return
    if (gameState !== 'paused') return
    if (!expectedNote) return

    const beatKey = `${expectedNote.bar}-${expectedNote.beat}`
    if (beatKey === lastEvaluatedKey.current) return

    masterWaitActive.current = true
    lastEvaluatedKey.current = beatKey
    stableCountRef.current = 0
    lastDetectedMidiRef.current = null

    masterTimeoutRef.current = setTimeout(() => {
      if (masterWaitActive.current) evaluateAndResume()
    }, MASTER_TIMEOUT)

    return () => {
      if (masterTimeoutRef.current) {
        clearTimeout(masterTimeoutRef.current)
        masterTimeoutRef.current = null
      }
    }
  }, [expectedNote, gameState, gameMode, evaluateAndResume])

  // ─── Master mode: real-time note detection via Zustand subscribe ──────────
  // Uses subscribe instead of useEffect to bypass React batching and avoid
  // stale gameState timing issues. Fires on every detectedNote change.
  useEffect(() => {
    if (gameMode !== 'master') return

    const unsubscribe = useGameStore.subscribe(
      (state) => state.detectedNote,
      (detectedNote) => {
        if (!masterWaitActive.current) return
        const { expectedNote: expected } = useGameStore.getState()
        if (!expected) return
        if (!detectedNote || detectedNote.clarity < 0.85) return

        // Require STABLE_FRAMES consecutive frames of the same MIDI before accepting
        if (detectedNote.midi === lastDetectedMidiRef.current) {
          stableCountRef.current++
        } else {
          lastDetectedMidiRef.current = detectedNote.midi
          stableCountRef.current = 1
        }
        if (stableCountRef.current < STABLE_FRAMES) return

        const isMatch = Math.abs(detectedNote.midi - expected.midi) <= NOTE_TOLERANCE
        if (isMatch) {
          evaluateAndResume()
        } else {
          // Wrong note — lock out re-entry, show feedback then advance with fail
          masterWaitActive.current = false
          if (masterTimeoutRef.current) clearTimeout(masterTimeoutRef.current)
          masterTimeoutRef.current = setTimeout(() => {
            masterTimeoutRef.current = null
            evaluateAndResume()
          }, MASTER_WRONG_DELAY)
        }
      }
    )

    return unsubscribe
  }, [gameMode, evaluateAndResume])

  // ─── Reset on song stop ────────────────────────────────────────────────────
  useEffect(() => {
    if (gameState === 'idle' || gameState === 'finished') {
      lastEvaluatedKey.current = ''
      masterWaitActive.current = false
      stableCountRef.current = 0
      lastDetectedMidiRef.current = null
    }
  }, [gameState])
}
