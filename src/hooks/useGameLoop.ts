// @refresh reset
import { useEffect, useRef } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useGameStore } from '../store/useGameStore'
import { isUsableDetection, matchesExpectedNote } from '../game/noteEvaluation'
import {
  getMasterTimeout,
  MASTER_NOTE_TIMEOUT_MS,
  shouldAdvanceMasterBeat,
} from '../game/masterProgression'

export const MASTER_NOTE_TIMEOUT = MASTER_NOTE_TIMEOUT_MS

export function useGameLoop() {
  const masterTimeoutRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastEvaluatedKey    = useRef<string>('')
  const lastEvalTimestamp   = useRef<number>(0)   // wall-clock ms when last beat was evaluated
  const freeTimeoutRef      = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { gameState, gameMode, waitMode, expectedNote, evaluateNote } = useGameStore(useShallow((state) => ({
    gameState: state.gameState,
    gameMode: state.gameMode,
    waitMode: state.waitMode,
    expectedNote: state.expectedNote,
    evaluateNote: state.evaluateNote,
  })))

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
      if (!isUsableDetection(detected)) return

      const live = useGameStore.getState()
      if (live.gameState !== 'playing' || !live.expectedNote) return

      const exp = live.expectedNote
      const beatKey = `${exp.bar}-${exp.beat}`
      if (lastEvaluatedKey.current === beatKey) return
      if (detected.onset < exp.timestamp - 220) return

      // A wrong transient should not steal the whole beat immediately. Give the
      // detector 120 ms to settle before recording a wrong note.
      const matches = matchesExpectedNote(exp, detected)
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
    const beatKey = `${expectedNote.bar}-${expectedNote.beat}`
    if (beatKey === lastEvaluatedKey.current) return

    const timeout = setTimeout(() => {
      // Only fire if this beat hasn't been evaluated yet (subscribe might have beaten us)
      if (lastEvaluatedKey.current === beatKey) return

      lastEvaluatedKey.current = beatKey
      lastEvalTimestamp.current = performance.now()
      // A timeout is always a miss. Never let a sustained note from the prior
      // beat score as a fresh hit simply because it remains in detector state.
      const attempt = evaluateNote(null)
      const state = useGameStore.getState()
      if (attempt?.result === 'wrong' || attempt?.result === 'miss') {
        state.markCurrentBeatFailed()
      }
      setTimeout(() => useGameStore.getState().advanceLesson?.(), 80)
    }, getMasterTimeout(waitMode))

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
      // Only a matching, newly plucked note can advance Master mode. Wrong
      // transients remain visible so the player can correct them on this beat.
      if (!shouldAdvanceMasterBeat(exp, detectedNote, lastEvalTimestamp.current)) return

      const beatKey = `${exp.bar}-${exp.beat}`
      if (lastEvaluatedKey.current === beatKey) return  // already evaluated this beat

      // Claim this beat before doing async work
      lastEvaluatedKey.current = beatKey
      lastEvalTimestamp.current = performance.now()
      if (masterTimeoutRef.current) {
        clearTimeout(masterTimeoutRef.current)
        masterTimeoutRef.current = null
      }

      const attempt = evaluateNote(detectedNote)
      const freshState = useGameStore.getState()
      if (attempt?.result === 'wrong' || attempt?.result === 'miss') {
        freshState.markCurrentBeatFailed()
      }
      setTimeout(() => useGameStore.getState().advanceLesson?.(), 80)
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
